import { OrderStatus, Prisma, ReferenceEntityType, StockChangeType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';
import { env } from '../../config/env';
import { emitToUser } from '../../lib/socket';
import { notify } from '../notifications/notification.service';
import { templates } from '../../lib/email/templates';
import { renderInvoiceHtml, htmlToPdfFile } from '../../lib/pdf';

const FLOW: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PLACED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.OUT_FOR_DELIVERY],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [OrderStatus.RETURN_REQUESTED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.RETURN_REQUESTED]: [OrderStatus.DELIVERED, OrderStatus.RETURNED],
  [OrderStatus.RETURNED]: [OrderStatus.REFUNDED],
  [OrderStatus.REFUNDED]: [],
};

async function loadSubForSeller(sellerUserId: string, subId: string) {
  const sub = await prisma.sellerSubOrder.findFirst({
    where: { id: subId, shop: { seller: { userId: sellerUserId } } },
    include: { items: true, shop: { include: { seller: { include: { user: true } } } }, order: { select: { buyerId: true, orderNumber: true } } },
  });
  if (!sub) throw ApiError.notFound('Sub-order not found or not yours');
  return sub;
}

/** Seller confirms an order with an estimated dispatch time. */
export async function confirmOrder(sellerUserId: string, subId: string, estimatedDispatchHours = 24) {
  const sub = await loadSubForSeller(sellerUserId, subId);
  if (sub.status !== OrderStatus.PLACED) throw ApiError.badRequest('Order is not awaiting confirmation');
  await prisma.sellerSubOrder.update({
    where: { id: subId },
    data: { status: OrderStatus.CONFIRMED, confirmedAt: new Date(), estimatedDispatchAt: new Date(Date.now() + estimatedDispatchHours * 3600 * 1000) },
  });
  await prisma.orderEvent.create({ data: { subOrderId: subId, status: OrderStatus.CONFIRMED, title: 'Order confirmed', actorType: 'SELLER', actorId: sellerUserId } });
  await syncParentStatus(sub.orderId);
  await buyerNotify(sub, 'Confirmed');
  return prisma.sellerSubOrder.findUnique({ where: { id: subId } });
}

export async function advanceStatus(sellerUserId: string, subId: string, to: OrderStatus, extra?: { trackingNumber?: string; courierName?: string }) {
  const sub = await loadSubForSeller(sellerUserId, subId);
  if (!FLOW[sub.status]?.includes(to)) throw ApiError.badRequest(`Cannot move from ${sub.status} to ${to}`);
  const patch: Prisma.SellerSubOrderUpdateInput = { status: to };
  if (to === OrderStatus.PROCESSING) patch.status = OrderStatus.PROCESSING;
  if (to === OrderStatus.SHIPPED) {
    patch.shippedAt = new Date();
    patch.trackingNumber = extra?.trackingNumber;
    patch.courierName = extra?.courierName;
  }
  if (to === OrderStatus.DELIVERED) {
    patch.deliveredAt = new Date();
    if (extra?.trackingNumber) patch.trackingNumber = extra.trackingNumber;
  }
  await prisma.sellerSubOrder.update({ where: { id: subId }, data: patch });
  await prisma.orderEvent.create({ data: { subOrderId: subId, status: to, title: `Status: ${to}`, description: extra?.trackingNumber ? `Tracking ${extra.trackingNumber}` : null, actorType: 'SELLER', actorId: sellerUserId } });

  if (to === OrderStatus.DELIVERED) await settleDelivery(subId);
  await syncParentStatus(sub.orderId);
  await buyerNotify(sub, to.replace(/_/g, ' '));
  return prisma.sellerSubOrder.findUnique({ where: { id: subId } });
}

export async function addTracking(sellerUserId: string, subId: string, trackingNumber: string, courierName: string) {
  const sub = await loadSubForSeller(sellerUserId, subId);
  if (!([OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.SHIPPED] as OrderStatus[]).includes(sub.status)) throw ApiError.badRequest('Cannot add tracking for this order state');
  await prisma.sellerSubOrder.update({ where: { id: subId }, data: { trackingNumber, courierName } });
  await prisma.orderEvent.create({ data: { subOrderId: subId, title: 'Tracking added', description: `${courierName}: ${trackingNumber}`, actorType: 'SELLER', actorId: sellerUserId } });
  return { ok: true };
}

/** Seller cancels — releases stock and refunds the buyer sub-order share. */
export async function sellerCancel(sellerUserId: string, subId: string, reason: string) {
  const sub = await loadSubForSeller(sellerUserId, subId);
  if (([OrderStatus.SHIPPED, OrderStatus.DELIVERED] as OrderStatus[]).includes(sub.status)) throw ApiError.badRequest('Shipped orders cannot be cancelled');
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const item of sub.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (product) {
        await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: { increment: item.quantity }, soldCount: { decrement: item.quantity } } });
        await tx.stockMovement.create({ data: { productId: item.productId, changeType: StockChangeType.CANCELLATION, quantityDelta: item.quantity, quantityBefore: product.stockQuantity, quantityAfter: product.stockQuantity + item.quantity, referenceType: ReferenceEntityType.SUB_ORDER, referenceId: subId } });
      }
    }
    await tx.sellerSubOrder.update({ where: { id: subId }, data: { status: OrderStatus.CANCELLED, cancelledAt: new Date(), sellerNotes: reason } });
    await tx.orderEvent.create({ data: { subOrderId: subId, status: OrderStatus.CANCELLED, title: 'Seller cancelled', description: reason, actorType: 'SELLER', actorId: sellerUserId } });
  });
  const { refundOrder } = await import('../payments/payment.service');
  await refundOrder(sub.orderId, 'seller-cancel', subId);
  await syncParentStatus(sub.orderId);
  await buyerNotify(sub, 'Cancelled by seller');
  return { ok: true };
}

/** Credits seller earnings (net of commission) once a sub-order is delivered. */
async function settleDelivery(subId: string) {
  const sub = await prisma.sellerSubOrder.findUnique({ where: { id: subId }, include: { shop: { include: { seller: { include: { user: true } } } } } });
  if (!sub) return;
  const now = new Date();
  const day = new Date(now); day.setHours(0, 0, 0, 0);
  await prisma.$transaction([
    prisma.sellerEarnings.upsert({
      where: { sellerId_periodStart_periodEnd: { sellerId: sub.sellerId, periodStart: day, periodEnd: day } },
      create: { sellerId: sub.sellerId, periodStart: day, periodEnd: day, grossRevenue: sub.subtotal, commissionPaid: sub.commissionAmount, netEarnings: sub.sellerEarning, available: sub.sellerEarning, pending: 0, withdrawn: 0 },
      update: { grossRevenue: { increment: sub.subtotal }, commissionPaid: { increment: sub.commissionAmount }, netEarnings: { increment: sub.sellerEarning }, available: { increment: sub.sellerEarning } },
    }),
    prisma.sellerProfile.update({ where: { id: sub.sellerId }, data: { totalOrders: { increment: 1 }, completedOrders: { increment: 1 } } }),
  ]);
  // Generate invoice PDF (best effort, non-blocking).
  const sellerUser = sub.shop?.seller?.user;
  if (sellerUser) notify({ userId: sellerUser.id, audience: 'SELLER', type: 'ORDER_DELIVERED', title: 'Order delivered', body: `${sub.subOrderNumber} delivered — earnings updated`, actionUrl: '/seller/earnings' }).catch(() => {});
  buildInvoice(sub.id).catch(() => {});
}

async function buildInvoice(subId: string) {
  const sub = await prisma.sellerSubOrder.findUnique({ where: { id: subId }, include: { items: true, shop: true, order: { include: { buyer: true } } } });
  if (!sub) return;
  const html = renderInvoiceHtml({
    number: sub.subOrderNumber,
    buyerName: sub.order.buyer.name,
    buyerEmail: sub.order.buyer.email,
    address: (sub.order.addressSnapshot as any) ?? {},
    shopName: sub.shop.name,
    lines: sub.items.map((i) => ({ title: i.titleSnapshot, qty: i.quantity, unitPrice: Number(i.unitPrice), total: Number(i.totalPrice) })),
    subtotal: Number(sub.subtotal), shipping: Number(sub.shippingFee), discount: Number(sub.discountAmount), tax: 0,
    total: Number(sub.subtotal) + Number(sub.shippingFee) - Number(sub.discountAmount),
    paymentMethod: sub.order.paymentMethod, placedAt: sub.createdAt.toISOString().slice(0, 10),
  });
  const url = await htmlToPdfFile(html, `invoice-${sub.subOrderNumber}.pdf`);
  await prisma.sellerSubOrder.update({ where: { id: subId }, data: { sellerNotes: `invoice:${url}` } });
}

/** Recomputes the parent order status from its sub-orders. */
async function syncParentStatus(orderId: string) {
  const subs = await prisma.sellerSubOrder.findMany({ where: { orderId }, select: { status: true } });
  const parent = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!parent) return;
  const statuses = subs.map((s) => s.status);
  let next: OrderStatus = parent.status;
  if (statuses.every((s) => s === OrderStatus.CANCELLED)) next = OrderStatus.CANCELLED;
  else if (statuses.every((s) => s === OrderStatus.DELIVERED)) next = OrderStatus.DELIVERED;
  else if (statuses.includes(OrderStatus.OUT_FOR_DELIVERY)) next = OrderStatus.OUT_FOR_DELIVERY;
  else if (statuses.includes(OrderStatus.SHIPPED)) next = OrderStatus.SHIPPED;
  else if (statuses.includes(OrderStatus.PROCESSING)) next = OrderStatus.PROCESSING;
  else if (statuses.includes(OrderStatus.CONFIRMED)) next = OrderStatus.CONFIRMED;
  if (next !== parent.status) {
    await prisma.order.update({ where: { id: orderId }, data: { status: next } });
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { buyer: true } });
    if (order) {
      emitToUser(order.buyerId, `order:status:${orderId}`, { status: next });
      notify({ userId: order.buyerId, type: 'ORDER_STATUS', title: 'Order update', body: `Order ${order.orderNumber}: ${next}`, actionUrl: `/account/orders/${order.orderNumber}`, emailHtml: templates.orderStatus(order.buyer.name, order.orderNumber, next) }).catch(() => {});
    }
    // Rewards & referrals unlock once the whole order is delivered (best-effort, idempotent).
    if (next === OrderStatus.DELIVERED) {
      import('../loyalty/loyalty.service').then((m) => m.awardOrderLoyalty(orderId)).catch(() => {});
      import('../referrals/referral.service').then((m) => m.grantReferralReward(orderId)).catch(() => {});
    }
  }
}

async function buyerNotify(sub: any, label: string) {
  const buyer = await prisma.user.findUnique({ where: { id: sub.order.buyerId } });
  if (buyer) notify({ userId: buyer.id, type: 'ORDER_STATUS', title: `Order ${label}`, body: `${sub.order.orderNumber} → ${label}`, actionUrl: `/account/orders/${sub.order.orderNumber}`, emailHtml: templates.orderStatus(buyer.name, sub.order.orderNumber, label) }).catch(() => {});
  emitToUser(sub.order.buyerId, `order:status:${sub.orderId ?? sub.orderId}`, { subOrderId: sub.id, status: label });
}

/** Auto-cancels sub-orders the seller never confirms within the timeout window. */
export async function autoCancelUnconfirmed() {
  const cutoff = new Date(Date.now() - env.business.sellerConfirmTimeoutHours * 3600 * 1000);
  const stale = await prisma.sellerSubOrder.findMany({ where: { status: OrderStatus.PLACED, createdAt: { lt: cutoff } }, include: { items: true } });
  for (const sub of stale) {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const item of sub.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (product) {
          await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: { increment: item.quantity }, soldCount: { decrement: item.quantity } } });
          await tx.stockMovement.create({ data: { productId: item.productId, changeType: StockChangeType.CANCELLATION, quantityDelta: item.quantity, quantityBefore: product.stockQuantity, quantityAfter: product.stockQuantity + item.quantity, referenceType: ReferenceEntityType.SUB_ORDER, referenceId: sub.id } });
        }
      }
      await tx.sellerSubOrder.update({ where: { id: sub.id }, data: { status: OrderStatus.CANCELLED, autoCancelledAt: new Date(), cancelledAt: new Date() } });
      await tx.orderEvent.create({ data: { subOrderId: sub.id, status: OrderStatus.CANCELLED, title: 'Auto-cancelled (not confirmed)', actorType: 'SYSTEM' } });
    });
    const { refundOrder } = await import('../payments/payment.service');
    await refundOrder(sub.orderId, 'auto-cancel', sub.id);
    await syncParentStatus(sub.orderId);
  }
  return { cancelled: stale.length };
}

// ── Seller order listing ──
export async function listSellerOrders(sellerUserId: string, req: { query: any }) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const where: Prisma.SellerSubOrderWhereInput = { shop: { seller: { userId: sellerUserId } } };
  if (req.query.status) where.status = req.query.status as OrderStatus;
  const [items, total] = await prisma.$transaction([
    prisma.sellerSubOrder.findMany({ where, include: { items: true, order: { select: { orderNumber: true, buyer: { select: { name: true } }, addressSnapshot: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.sellerSubOrder.count({ where }),
  ]);
  const { paginated } = await import('../../utils/pagination');
  return paginated(items, total, page, limit);
}
