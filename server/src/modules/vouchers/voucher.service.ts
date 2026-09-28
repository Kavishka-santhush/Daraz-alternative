import { Prisma, VoucherStatus, VoucherScope } from '@prisma/client';
import crypto from 'crypto';
import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';
import { paginated } from '../../utils/pagination';
import type { Request } from 'express';

export interface VoucherInput {
  code?: string;
  name: string;
  description?: string;
  type: 'PERCENT' | 'FIXED' | 'FREE_SHIPPING';
  scope: 'PLATFORM' | 'SELLER';
  percentOff?: number;
  fixedOff?: number;
  maxDiscount?: number;
  minOrderAmount?: number;
  categoryIds?: string[];
  productIds?: string[];
  newBuyersOnly?: boolean;
  oneTimePerUser?: boolean;
  usageLimit?: number;
  startsAt: string;
  expiresAt: string;
  targetUrl?: string;
}

function randomCode(prefix = 'SAVE'): string {
  return `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

async function ensureCodeFree(code: string) {
  const upper = code.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-_]{2,24}$/.test(upper)) throw ApiError.badRequest('Code must be 3-25 letters, digits, dash or underscore');
  if (await prisma.voucher.findUnique({ where: { code: upper } })) throw ApiError.conflict('That voucher code already exists');
  return upper;
}

function toData(input: VoucherInput, staffId?: string, ownerId?: string): Prisma.VoucherUncheckedCreateInput {
  if (input.type === 'PERCENT' && !input.percentOff) throw ApiError.badRequest('percentOff is required for a percentage voucher');
  if (input.type === 'FIXED' && !input.fixedOff) throw ApiError.badRequest('fixedOff is required for a fixed-amount voucher');
  const startsAt = new Date(input.startsAt);
  const expiresAt = new Date(input.expiresAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(expiresAt.getTime())) throw ApiError.badRequest('Invalid start or expiry date');
  if (expiresAt <= startsAt) throw ApiError.badRequest('Voucher must expire after it starts');
  return {
    code: input.code ? input.code.toUpperCase() : randomCode(input.type === 'FREE_SHIPPING' ? 'SHIP' : 'SAVE'),
    name: input.name,
    description: input.description,
    scope: input.scope as VoucherScope,
    type: input.type as never,
    ownerId: ownerId ?? null,
    createdByStaffId: staffId ?? null,
    percentOff: input.percentOff != null ? new Prisma.Decimal(input.percentOff) : null,
    fixedOff: input.fixedOff != null ? new Prisma.Decimal(input.fixedOff) : null,
    maxDiscount: input.maxDiscount != null ? new Prisma.Decimal(input.maxDiscount) : null,
    minOrderAmount: input.minOrderAmount != null ? new Prisma.Decimal(input.minOrderAmount) : null,
    applicableProducts: input.productIds ?? [],
    newBuyersOnly: input.newBuyersOnly ?? false,
    oneTimePerUser: input.oneTimePerUser ?? true,
    usageLimit: input.usageLimit ?? null,
    status: startsAt > new Date() ? VoucherStatus.SCHEDULED : VoucherStatus.ACTIVE,
    startsAt,
    expiresAt,
    targetUrl: input.targetUrl,
  };
}

export async function createPlatformVoucher(staffId: string, input: VoucherInput) {
  const data = toData({ ...input, scope: 'PLATFORM' }, staffId);
  if (data.code) data.code = await ensureCodeFree(data.code);
  const voucher = await prisma.voucher.create({ data });
  if (input.categoryIds?.length) {
    await prisma.voucher.update({ where: { id: voucher.id }, data: { applicableCategories: { connect: input.categoryIds.map((id) => ({ id })) } } });
  }
  await prisma.auditLog.create({ data: { actorId: staffId, action: 'voucher:create', entityType: 'VOUCHER', entityId: voucher.id, after: { code: voucher.code } as Prisma.InputJsonValue } });
  return prisma.voucher.findUnique({ where: { id: voucher.id }, include: { applicableCategories: { select: { id: true, name: true, slug: true } } } });
}

/** Sellers may only run vouchers scoped to their own shop. */
export async function createSellerVoucher(sellerUserId: string, input: Omit<VoucherInput, 'scope'>) {
  const shop = await prisma.shop.findFirst({ where: { seller: { userId: sellerUserId } }, select: { id: true, sellerId: true, isActive: true } });
  if (!shop) throw ApiError.forbidden('Approved shop required');
  const data = toData({ ...input, scope: 'SELLER' }, undefined, shop.sellerId);
  data.code = await ensureCodeFree(data.code!);
  const voucher = await prisma.voucher.create({ data });
  if (input.categoryIds?.length) {
    await prisma.voucher.update({ where: { id: voucher.id }, data: { applicableCategories: { connect: input.categoryIds.map((id) => ({ id })) } } });
  }
  return { ...voucher, shopId: shop.id };
}

export async function listVouchers(req: Request, opts: { staff?: boolean; ownerId?: string } = {}) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const where: Prisma.VoucherWhereInput = {};
  if (opts.ownerId) where.ownerId = opts.ownerId;
  if (!opts.staff) {
    where.status = VoucherStatus.ACTIVE;
    where.startsAt = { lte: new Date() };
    where.expiresAt = { gt: new Date() };
    if (!opts.ownerId) where.scope = VoucherScope.PLATFORM;
  } else if (req.query.status) where.status = req.query.status as VoucherStatus;
  if (req.query.q) where.OR = [{ code: { contains: String(req.query.q), mode: 'insensitive' } }, { name: { contains: String(req.query.q), mode: 'insensitive' } }];
  const [items, total] = await prisma.$transaction([
    prisma.voucher.findMany({ where, include: { applicableCategories: { select: { id: true, name: true, slug: true } }, owner: { select: { id: true } }, _count: { select: { usages: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.voucher.count({ where }),
  ]);
  return paginated(items.map((v) => ({ ...v, usedCount: v._count.usages })), total, page, limit);
}

export async function updateVoucherStatus(staffId: string, id: string, status: VoucherStatus) {
  await prisma.voucher.update({ where: { id }, data: { status } });
  await prisma.auditLog.create({ data: { actorId: staffId, action: `voucher:${status.toLowerCase()}`, entityType: 'VOUCHER', entityId: id } });
  return { ok: true, status };
}

/** Editable only while nobody has redeemed it yet (keeps accounting honest). */
export async function updateVoucher(staffId: string, id: string, input: Partial<VoucherInput>) {
  const voucher = await prisma.voucher.findUnique({ where: { id }, include: { _count: { select: { usages: true } } } });
  if (!voucher) throw ApiError.notFound('Voucher not found');
  if (voucher._count.usages > 0) throw ApiError.conflict('A redeemed voucher cannot be edited — deactivate it and create a new one');
  const merged = toData({ ...voucher, ...input, percentOff: input.percentOff ?? (voucher.percentOff != null ? Number(voucher.percentOff) : undefined), fixedOff: input.fixedOff ?? (voucher.fixedOff != null ? Number(voucher.fixedOff) : undefined), maxDiscount: input.maxDiscount ?? (voucher.maxDiscount != null ? Number(voucher.maxDiscount) : undefined), minOrderAmount: input.minOrderAmount ?? (voucher.minOrderAmount != null ? Number(voucher.minOrderAmount) : undefined), startsAt: (input.startsAt ?? voucher.startsAt).toISOString(), expiresAt: (input.expiresAt ?? voucher.expiresAt).toISOString(), code: input.code ?? voucher.code, scope: voucher.scope as 'PLATFORM' | 'SELLER', type: voucher.type as never, productIds: input.productIds ?? voucher.applicableProducts } as VoucherInput, staffId);
  delete (merged as Record<string, unknown>).code;
  delete (merged as Record<string, unknown>).ownerId;
  const updated = await prisma.voucher.update({ where: { id }, data: merged as Prisma.VoucherUncheckedUpdateInput });
  if (input.categoryIds) {
    await prisma.voucher.update({ where: { id }, data: { applicableCategories: { set: input.categoryIds.map((cid) => ({ id: cid })) } } });
  }
  return updated;
}

export async function deleteVoucher(staffId: string, id: string) {
  const voucher = await prisma.voucher.findUnique({ where: { id }, include: { _count: { select: { usages: true } } } });
  if (!voucher) throw ApiError.notFound('Voucher not found');
  if (voucher._count.usages > 0) return updateVoucherStatus(staffId, id, VoucherStatus.DEACTIVATED);
  await prisma.voucher.delete({ where: { id } });
  await prisma.auditLog.create({ data: { actorId: staffId, action: 'voucher:delete', entityType: 'VOUCHER', entityId: id } });
  return { ok: true };
}

export async function voucherReport(staffId: string, id: string) {
  const voucher = await prisma.voucher.findUnique({ where: { id }, include: { applicableCategories: { select: { id: true, name: true } }, usages: { include: { user: { select: { id: true, name: true, email: true } } }, take: 200, orderBy: { usedAt: 'desc' } } } });
  if (!voucher) throw ApiError.notFound('Voucher not found');
  void staffId;
  const totalDiscount = voucher.usages.reduce((sum, u) => sum + Number(u.discountApplied), 0);
  return {
    code: voucher.code,
    name: voucher.name,
    status: voucher.status,
    usageLimit: voucher.usageLimit,
    redemptions: voucher.usages.length,
    totalDiscountGiven: Number(totalDiscount.toFixed(2)),
    remaining: voucher.usageLimit != null ? Math.max(0, voucher.usageLimit - voucher.usages.length) : null,
    recent: voucher.usages.map((u) => ({ userId: u.user.id, name: u.user.name, email: u.user.email, discount: Number(u.discountApplied), at: u.usedAt })),
  };
}
