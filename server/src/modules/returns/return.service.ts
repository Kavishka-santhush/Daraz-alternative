import { Prisma, ReturnStatus, DisputeStatus, OrderStatus, ReferenceEntityType, StockChangeType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';
import { referenceNumber } from '../../utils/nano';
import { notify } from '../notifications/notification.service';
import { templates } from '../../lib/email/templates';
import { toPublicUrl } from '../../lib/upload';
import type { Request } from 'express';

/** Buyer raises a return within the window on a delivered sub-order. */
export async function createReturn(buyerId: string, input: { subOrderId: string; reason: string; description?: string; items: { orderItemId: string; quantity: number }[] }) {
  const sub = await prisma.sellerSubOrder.findFirst({ where: { id: input.subOrderId, order: { buyerId } }, include: { items: true, order: { include: { buyer: true } }, shop: { include: { seller: { include: { user: true } } } } } });
  if (!sub) throw ApiError.notFound('Order not found');
  if (sub.status !== OrderStatus.DELIVERED) throw ApiError.badRequest('Only delivered orders can be returned');
  const daysSinceDelivery = sub.deliveredAt ? (Date.now() - sub.deliveredAt.getTime()) / 86400000 : Infinity;
  const windowDays = sub.shop?.seller ? 7 : 7;
  if (daysSinceDelivery > windowDays) throw ApiError.badRequest(`Return window (${windowDays} days) has passed`);

  const requestedRefund = input.items.reduce((sum, it) => {
    const oi = sub.items.find((x) => x.id === it.orderItemId);
    return sum + (oi ? Number(oi.unitPrice) * it.quantity : 0);
  }, 0);

  const created = await prisma.returnRequest.create({
    data: {
      returnNumber: referenceNumber('RET'),
      subOrderId: sub.id,
      buyerId,
      reason: input.reason,
      description: input.description,
      requestedRefund: new Prisma.Decimal(requestedRefund),
      status: ReturnStatus.REQUESTED,
      items: { create: input.items.map((it) => { const oi = sub.items.find((x) => x.id === it.orderItemId)!; return { orderItemId: it.orderItemId, productId: oi.productId, quantity: it.quantity, reason: input.reason }; }) },
      events: { create: { status: ReturnStatus.REQUESTED, note: input.reason, actorType: 'BUYER', actorId: buyerId } },
    },
    include: { items: true },
  });
  await prisma.sellerSubOrder.update({ where: { id: sub.id }, data: { status: OrderStatus.RETURN_REQUESTED } });
  if (sub.shop?.seller?.user) notify({ userId: sub.shop.seller.userId ? sub.shop.seller.user.id : '', audience: 'SELLER', type: 'RETURN_REQUEST', title: 'Return requested', body: `Return ${created.returnNumber} submitted`, actionUrl: '/seller/returns', emailHtml: templates.generic(sub.shop.seller.user.name, 'Return requested', `A return was requested for ${sub.subOrderNumber}.`) }).catch(() => {});
  return created;
}

export async function addReturnProof(returnId: string, buyerId: string, file: Express.Multer.File) {
  const ret = await prisma.returnRequest.findFirst({ where: { id: returnId, buyerId } });
  if (!ret) throw ApiError.notFound('Return not found');
  const url = toPublicUrl(file.path);
  const evidence = (Array.isArray(ret.evidence) ? (ret.evidence as string[]) : []);
  await prisma.returnRequest.update({ where: { id: returnId }, data: { evidence: [...evidence, url] } });
  return { url, evidence: [...evidence, url] };
}

export async function sellerDecision(sellerUserId: string, returnId: string, decision: 'approve' | 'reject', note?: string) {
  const ret = await prisma.returnRequest.findUnique({ where: { id: returnId }, include: { subOrder: { include: { shop: { include: { seller: { include: { user: true } } } } } } } });
  if (!ret) throw ApiError.notFound('Return not found');
  const seller = ret.subOrder.shop.seller;
  if (seller.userId !== sellerUserId) throw ApiError.forbidden('Not your return request');
  if (ret.status !== ReturnStatus.REQUESTED) throw ApiError.badRequest('Decision already made');
  const status = decision === 'approve' ? ReturnStatus.APPROVED : ReturnStatus.REJECTED;
  await prisma.returnRequest.update({ where: { id: returnId }, data: { status, sellerNote: note, approvedRefund: decision === 'approve' ? ret.requestedRefund : null, sellerDecidedAt: new Date() } });
  await prisma.returnEvent.create({ data: { returnId, status, note, actorType: 'SELLER', actorId: sellerUserId } });
  const buyer = await prisma.user.findUnique({ where: { id: ret.buyerId! } });
  if (buyer) notify({ userId: ret.buyerId!, type: 'RETURN_UPDATE', title: `Return ${decision === 'approve' ? 'approved' : 'rejected'}`, body: `Return ${ret.returnNumber}`, emailHtml: templates.returnUpdate(buyer.name, ret.returnNumber, status) }).catch(() => {});
  return { ok: true, status };
}

/** Marks items returned + initiates the refund via payments. */
export async function completeRefund(actorId: string, returnId: string, refundMethod: 'ORIGINAL' | 'WALLET') {
  const ret = await prisma.returnRequest.findUnique({ where: { id: returnId, }, include: { items: true, subOrder: { include: { items: true, order: true } } } });
  if (!ret) throw ApiError.notFound('Return not found');
  if (!([ReturnStatus.APPROVED, ReturnStatus.ITEM_RETURNED] as ReturnStatus[]).includes(ret.status)) throw ApiError.badRequest('Return not ready for refund');

  // Restock returned items.
  for (const item of ret.subOrder.items) {
    const returned = ret.items.find((r) => r.orderItemId === item.id);
    if (returned) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (product) {
        await prisma.product.update({ where: { id: item.productId }, data: { stockQuantity: { increment: returned.quantity } } });
        await prisma.stockMovement.create({ data: { productId: item.productId, changeType: StockChangeType.RETURN, quantityDelta: returned.quantity, quantityBefore: product.stockQuantity, quantityAfter: product.stockQuantity + returned.quantity, referenceType: ReferenceEntityType.RETURN, referenceId: returnId } });
      }
    }
  }
  await prisma.returnRequest.update({ where: { id: returnId }, data: { status: ReturnStatus.REFUND_INITIATED, refundMethod } });
  await prisma.returnEvent.create({ data: { returnId, status: ReturnStatus.REFUND_INITIATED, actorType: 'SYSTEM', actorId: actorId } });

  const amount = Number(ret.approvedRefund ?? ret.requestedRefund);
  const { creditWallet } = await import('../payments/payment.service');
  if (refundMethod === 'WALLET') {
    await creditWallet(ret.buyerId!, amount, (await import('@prisma/client')).WalletTxPurpose.ORDER_REFUND, ReferenceEntityType.RETURN, returnId, `Refund ${ret.returnNumber}`);
  } else {
    const { refundOrder } = await import('../payments/payment.service');
    await refundOrder(ret.subOrder.orderId, 'return', ret.subOrderId);
  }
  await prisma.returnRequest.update({ where: { id: returnId }, data: { status: ReturnStatus.REFUND_COMPLETED } });
  await prisma.returnEvent.create({ data: { returnId, status: ReturnStatus.REFUND_COMPLETED, actorType: 'ADMIN', actorId } });
  const buyer = await prisma.user.findUnique({ where: { id: ret.buyerId! } });
  if (buyer) notify({ userId: ret.buyerId!, type: 'REFUND', title: 'Refund completed', body: `${amount} refunded for ${ret.returnNumber}`, emailHtml: templates.returnUpdate(buyer.name, ret.returnNumber, 'Refund completed') }).catch(() => {});
  return { ok: true, refunded: amount };
}

/** Admin opens/assigns/resolves a dispute over a return. */
export async function openDispute(staffId: string, returnId: string, note: string) {
  const ret = await prisma.returnRequest.findUnique({ where: { id: returnId } });
  if (!ret) throw ApiError.notFound('Return not found');
  const dispute = await prisma.dispute.upsert({ where: { returnId }, create: { returnId, openedById: staffId, status: DisputeStatus.OPEN, resolution: note }, update: { status: DisputeStatus.OPEN, resolution: note } });
  await prisma.returnRequest.update({ where: { id: returnId }, data: { status: ReturnStatus.REQUESTED, adminNote: note } });
  return dispute;
}

export async function assignDispute(staffId: string, disputeId: string, agentId: string) {
  await prisma.dispute.update({ where: { id: disputeId }, data: { assignedToId: agentId, status: DisputeStatus.ASSIGNED } });
  await prisma.auditLog.create({ data: { actorId: staffId, action: 'dispute:assign', entityType: 'RETURN', entityId: disputeId } });
  return { ok: true };
}

export async function resolveDispute(staffId: string, disputeId: string, resolution: string) {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) throw ApiError.notFound('Dispute not found');
  await prisma.dispute.update({ where: { id: disputeId }, data: { status: DisputeStatus.RESOLVED, resolution, resolvedById: staffId, resolvedAt: new Date() } });
  return { ok: true };
}

export async function listReturns(req: Request, scope: { sellerUserId?: string; admin?: boolean }) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const where: Prisma.ReturnRequestWhereInput = {};
  if (scope.sellerUserId) where.subOrder = { shop: { seller: { userId: scope.sellerUserId } } };
  if (scope.admin) where.dispute = req.query.onlyDisputes ? { isNot: null } : undefined;
  if (req.query.status) where.status = req.query.status as ReturnStatus;
  const [items, total] = await prisma.$transaction([
    prisma.returnRequest.findMany({ where, include: { items: true, subOrder: { include: { shop: { select: { name: true } }, order: { select: { orderNumber: true, buyer: { select: { name: true } } } } } }, dispute: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.returnRequest.count({ where }),
  ]);
  const { paginated } = await import('../../utils/pagination');
  return paginated(items, total, page, limit);
}

export async function listBuyerReturns(buyerId: string, req: Request) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const [items, total] = await prisma.$transaction([
    prisma.returnRequest.findMany({ where: { buyerId }, include: { items: true, subOrder: { include: { shop: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.returnRequest.count({ where: { buyerId } }),
  ]);
  const { paginated } = await import('../../utils/pagination');
  return paginated(items, total, page, limit);
}
