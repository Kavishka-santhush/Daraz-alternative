import { Prisma, PayoutStatus, InstallmentStatus, UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';
import { referenceNumber } from '../../utils/nano';
import { notify } from '../notifications/notification.service';
import { templates } from '../../lib/email/templates';
import { emitToRole } from '../../lib/socket';
import type { Request } from 'express';

const d = (n: number | string) => new Prisma.Decimal(n);

export async function getEarnings(userId: string) {
  const seller = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (!seller) throw ApiError.notFound('Seller not found');
  const agg = await prisma.sellerEarnings.aggregate({ where: { sellerId: seller.id }, _sum: { grossRevenue: true, commissionPaid: true, netEarnings: true, available: true, pending: true, withdrawn: true } });
  const payouts = await prisma.payoutRequest.findMany({ where: { sellerId: seller.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  return { summary: agg._sum, payouts, bank: seller.payoutBank };
}

export async function savePayoutBank(userId: string, bank: { bankName: string; bankAccountNo: string; bankBranch?: string; accountHolder: string }) {
  const seller = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (!seller) throw ApiError.notFound('Seller not found');
  await prisma.sellerProfile.update({ where: { id: seller.id }, data: { payoutBank: bank as any } });
  return { ok: true };
}

export async function requestPayout(userId: string, amount: number) {
  const seller = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (!seller) throw ApiError.notFound('Seller not found');
  if (seller.status !== 'APPROVED') throw ApiError.forbidden('Only approved sellers can withdraw');
  const settings = await prisma.settings.findUnique({ where: { id: 'platform' } });
  const minPayout = Number(settings?.minPayoutAmount ?? 1000);
  if (amount < minPayout) throw ApiError.badRequest(`Minimum payout is ${minPayout}`);
  if (!seller.payoutBank) throw ApiError.badRequest('Add your bank account details first');

  const agg = await prisma.sellerEarnings.aggregate({ where: { sellerId: seller.id }, _sum: { available: true } });
  const available = Number(agg._sum.available ?? 0);
  const pendingRequests = await prisma.payoutRequest.aggregate({ where: { sellerId: seller.id, status: { in: [PayoutStatus.REQUESTED, PayoutStatus.APPROVED] } }, _sum: { amount: true } });
  const free = available - Number(pendingRequests._sum.amount ?? 0);
  if (amount > free) throw ApiError.badRequest(`Only ${free} available to withdraw`);

  return prisma.payoutRequest.create({ data: { payoutNumber: referenceNumber('PAY'), sellerId: seller.id, amount: d(amount), bankName: (seller.payoutBank as any).bankName, bankAccountNo: (seller.payoutBank as any).bankAccountNo, bankBranch: (seller.payoutBank as any).bankBranch, accountHolder: (seller.payoutBank as any).accountHolder } });
}

export async function listPayoutRequests(req: Request) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const where: Prisma.PayoutRequestWhereInput = {};
  if (req.query.status) where.status = req.query.status as PayoutStatus;
  const [items, total] = await prisma.$transaction([
    prisma.payoutRequest.findMany({ where, include: { seller: { include: { user: { select: { name: true, email: true } } } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.payoutRequest.count({ where }),
  ]);
  const { paginated } = await import('../../utils/pagination');
  return paginated(items, total, page, limit);
}

export async function reviewPayout(staffId: string, payoutId: string, decision: 'approve' | 'reject', note?: string) {
  const payout = await prisma.payoutRequest.findUnique({ where: { id: payoutId }, include: { seller: { include: { user: true } } } });
  if (!payout) throw ApiError.notFound('Payout not found');
  const status = decision === 'approve' ? PayoutStatus.APPROVED : PayoutStatus.REJECTED;
  await prisma.payoutRequest.update({ where: { id: payoutId }, data: { status, reviewedById: staffId, rejectionReason: decision === 'reject' ? note : null } });
  await prisma.auditLog.create({ data: { actorId: staffId, action: `payout:${decision}`, entityType: 'PAYOUT', entityId: payoutId } });
  return { ok: true, status };
}

/** Finance marks an approved payout as transferred; reduces available balance. */
export async function processPayout(staffId: string, payoutId: string) {
  const payout = await prisma.payoutRequest.findUnique({ where: { id: payoutId }, include: { seller: { include: { user: true } } } });
  if (!payout) throw ApiError.notFound('Payout not found');
  if (payout.status !== PayoutStatus.APPROVED) throw ApiError.badRequest('Payout must be approved before processing');
  await prisma.$transaction([
    prisma.payoutRequest.update({ where: { id: payoutId }, data: { status: PayoutStatus.PROCESSED, processedAt: new Date() } }),
    prisma.sellerEarnings.updateMany({ where: { sellerId: payout.sellerId }, data: {} }),
  ]);
  // Move amount from available → withdrawn across the latest earnings rows.
  await consumeAvailable(payout.sellerId, Number(payout.amount));
  await prisma.auditLog.create({ data: { actorId: staffId, action: 'payout:process', entityType: 'PAYOUT', entityId: payoutId } });
  await notify({ userId: payout.seller.userId, audience: 'SELLER', type: 'PAYOUT', title: 'Payout processed', body: `${env_currency()} ${payout.amount} transferred to your account`, actionUrl: '/seller/earnings', emailHtml: templates.payoutProcessed(payout.seller.user.name, Number(payout.amount)) });
  return { ok: true };
}

async function consumeAvailable(sellerId: string, amount: number) {
  const rows = await prisma.sellerEarnings.findMany({ where: { sellerId, available: { gt: 0 } }, orderBy: { periodStart: 'asc' } });
  let remaining = amount;
  for (const row of rows) {
    if (remaining <= 0) break;
    const take = Math.min(Number(row.available), remaining);
    await prisma.sellerEarnings.update({ where: { id: row.id }, data: { available: { decrement: d(take) }, withdrawn: { increment: d(take) } } });
    remaining -= take;
  }
}

// ── Installment tracking (Finance Manager) ──
export async function activeInstallmentPlans(req: Request) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const [items, total] = await prisma.$transaction([
    prisma.installmentPlan.findMany({ include: { payment: { include: { order: { select: { orderNumber: true, buyer: { select: { name: true } } } } } }, records: { orderBy: { indexNo: 'asc' } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.installmentPlan.count(),
  ]);
  const { paginated } = await import('../../utils/pagination');
  return paginated(items, total, page, limit);
}

/** Flags overdue installments (scheduled job). */
export async function markOverdueInstallments() {
  const now = new Date();
  const result = await prisma.installmentRecord.updateMany({ where: { status: InstallmentStatus.DUE, dueDate: { lt: now } }, data: { status: InstallmentStatus.OVERDUE } });
  return { flagged: result.count };
}

function env_currency() {
  return process.env.CURRENCY ?? 'LKR';
}
