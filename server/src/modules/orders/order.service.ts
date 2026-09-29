import { OrderStatus, PaymentMethod, PaymentStatus, Prisma, ReferenceEntityType, StockChangeType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';
import { referenceNumber } from '../../utils/nano';
import { paginated } from '../../utils/pagination';
import { adjustStock } from '../products/inventory.service';
import * as pricing from './order.pricing';
import { getOrCreateCart } from '../cart/cart.service';
import { notify } from '../notifications/notification.service';
import { templates } from '../../lib/email/templates';
import { emitToUser } from '../../lib/socket';
import type { Request } from 'express';

export interface CheckoutInput {
  addressId: string;
  paymentMethod: 'CARD' | 'WALLET' | 'COD' | 'INSTALLMENTS';
  installmentPlan?: 'MONTH_3' | 'MONTH_6' | 'MONTH_12';
  vouchers?: Record<string, string>; // key = shopId or "PLATFORM"
  useLoyalty?: boolean;
  buyerNotes?: string;
}

/** Full checkout: prices the cart, splits by seller, reserves stock, creates order + sub-orders. */
export async function checkout(buyerId: string, input: CheckoutInput) {
  if (input.paymentMethod === 'INSTALLMENTS' && !input.installmentPlan) throw ApiError.badRequest('Select an installment plan');

  const [address, cart] = await Promise.all([
    prisma.address.findFirst({ where: { id: input.addressId, userId: buyerId } }),
    getOrCreateCart(buyerId),
  ]);
  if (!address) throw ApiError.notFound('Delivery address not found');
  if (!cart.groups.length) throw ApiError.badRequest('Your cart is empty');

  const settings = await pricing.getSettings();
  if (input.paymentMethod === 'COD' && settings && !settings.codEnabled) throw ApiError.badRequest('Cash on delivery is disabled');

  const groups: pricing.PricedGroup[] = [];
  let subtotal = 0, discountTotal = 0, shippingTotal = 0;
  const vouchersApplied: string[] = [];
  const titleByProduct = new Map<string, string>();

  for (const g of cart.groups) {
    const shop = await prisma.shop.findUnique({ where: { id: g.shop.id }, select: { id: true, sellerId: true } });
    if (!shop) throw ApiError.notFound('Shop unavailable');
    const firstProduct = g.items[0];
    for (const i of g.items) titleByProduct.set(i.productId, i.title);
    const product = await prisma.product.findUnique({ where: { id: firstProduct.productId }, select: { categoryId: true } });
    const commissionPercent = await pricing.resolveCommission(shop.sellerId, product!.categoryId);

    let groupDiscount = 0;
    let freeShipping = false;
    const code = input.vouchers?.[shop.id] ?? input.vouchers?.PLATFORM;
    if (code) {
      const evalr = await pricing.evaluateVoucher(code, {
        buyerId, shopId: shop.id, sellerId: shop.sellerId, groupSubtotal: g.subtotal,
        categoryIds: g.items.map((i: any) => i.productId), productIds: g.items.map((i: any) => i.productId),
      });
      if (evalr.applied) { groupDiscount = evalr.discount; freeShipping = evalr.freeShipping; vouchersApplied.push(code.toUpperCase()); }
      else if (input.vouchers?.[shop.id]) throw ApiError.badRequest(`Voucher ${code}: ${evalr.reason}`);
    }

    const shipping = freeShipping ? 0 : await pricing.computeShipping(g.subtotal - groupDiscount, shop.id, input.paymentMethod);
    const groupTotal = g.subtotal - groupDiscount + shipping;
    const commissionAmount = Number(new Prisma.Decimal(g.subtotal - groupDiscount).mul(commissionPercent / 100));

    subtotal += g.subtotal;
    discountTotal += groupDiscount;
    shippingTotal += shipping;

    groups.push({
      shopId: shop.id, sellerId: shop.sellerId,
      items: g.items.map((i: any) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
      subtotal: g.subtotal, discount: groupDiscount, shipping, commissionPercent, commissionAmount,
      sellerEarning: Number(new Prisma.Decimal(g.subtotal - groupDiscount).minus(commissionAmount)),
    });
  }

  // Loyalty redemption reduces platform total.
  let loyaltyPointsRedeemed = 0, loyaltyDiscount = 0;
  if (input.useLoyalty) {
    const redeem = await pricing.computeLoyaltyRedeem(buyerId, subtotal);
    loyaltyPointsRedeemed = redeem.points; loyaltyDiscount = redeem.discount;
  }

  const taxTotal = Number(new Prisma.Decimal(subtotal - discountTotal).mul(Number(settings?.taxPercent ?? 0) / 100).toFixed(2));
  const total = Number(new Prisma.Decimal(subtotal - discountTotal - loyaltyDiscount + shippingTotal + taxTotal).toFixed(2));
  if (total < 0) throw ApiError.badRequest('Invalid total');
  const loyaltyPointsEarned = pricing.loyaltyEarned(subtotal - discountTotal, null);

  // Persist everything transactionally, reserving stock.
  const order = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.order.create({
      data: {
        orderNumber: referenceNumber('ORD'),
        buyerId,
        addressId: address.id,
        addressSnapshot: address as unknown as Prisma.InputJsonValue,
        paymentMethod: input.paymentMethod as PaymentMethod,
        installmentPlan: input.installmentPlan as any,
        status: OrderStatus.PLACED,
        paymentStatus: input.paymentMethod === 'COD' ? PaymentStatus.PENDING : PaymentStatus.PENDING,
        subtotal: new Prisma.Decimal(subtotal),
        shippingTotal: new Prisma.Decimal(shippingTotal),
        discountTotal: new Prisma.Decimal(discountTotal + loyaltyDiscount),
        taxTotal: new Prisma.Decimal(taxTotal),
        totalAmount: new Prisma.Decimal(total),
        loyaltyPointsEarned,
        loyaltyPointsRedeemed,
        buyerNotes: input.buyerNotes,
        voucherCodesUsed: vouchersApplied,
        subOrders: {
          create: groups.map((grp) => ({
            subOrderNumber: referenceNumber('SUB'),
            shopId: grp.shopId,
            sellerId: grp.sellerId,
            subtotal: new Prisma.Decimal(grp.subtotal),
            shippingFee: new Prisma.Decimal(grp.shipping),
            discountAmount: new Prisma.Decimal(grp.discount),
            commissionPercent: new Prisma.Decimal(grp.commissionPercent),
            commissionAmount: new Prisma.Decimal(grp.commissionAmount),
            sellerEarning: new Prisma.Decimal(grp.sellerEarning),
            estimatedDeliveryAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            items: {
              create: grp.items.map((it) => ({
                productId: it.productId,
                variantId: it.variantId,
                quantity: it.quantity,
                unitPrice: new Prisma.Decimal(it.unitPrice),
                totalPrice: new Prisma.Decimal(it.lineTotal),
                titleSnapshot: titleByProduct.get(it.productId) ?? '',
              })),
            },
          })),
        },
      },
      include: { subOrders: { include: { items: true, shop: { select: { name: true, seller: { select: { userId: true } } } } } } },
    });

    // Reserve stock per item.
    for (const sub of created.subOrders) {
      for (const item of sub.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) throw ApiError.badRequest('A product is no longer available');
        if (product.stockQuantity < item.quantity) throw ApiError.conflict(`"${product.title}" is out of stock`);
        await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: { decrement: item.quantity }, soldCount: { increment: item.quantity } } });
        await tx.stockMovement.create({
          data: { productId: item.productId, changeType: StockChangeType.RESERVATION, quantityDelta: -item.quantity, quantityBefore: product.stockQuantity, quantityAfter: product.stockQuantity - item.quantity, referenceType: ReferenceEntityType.SUB_ORDER, referenceId: sub.id },
        });
      }
      await tx.orderEvent.create({ data: { subOrderId: sub.id, status: OrderStatus.PLACED, title: 'Order placed', actorType: 'SYSTEM' } });
    }
    await tx.orderEvent.create({ data: { orderId: created.id, status: OrderStatus.PLACED, title: 'Order placed', actorType: 'BUYER', actorId: buyerId } });

    if (loyaltyPointsRedeemed > 0) await tx.user.update({ where: { id: buyerId }, data: { loyaltyPoints: { decrement: loyaltyPointsRedeemed } } });
    return created;
  });

  // Create the payment intent / wallet charge / COD placeholder.
  const { initiatePayment } = await import('../payments/payment.service');
  const payment = await initiatePayment({ order, buyerId, method: input.paymentMethod, amount: total, installmentPlan: input.installmentPlan });

  // Empty the purchased items from the cart.
  await prisma.cart.deleteMany({ where: { userId: buyerId } });

  // Notify buyer + sellers (non-blocking).
  const buyer = await prisma.user.findUnique({ where: { id: buyerId } });
  if (buyer) notify({ userId: buyerId, type: 'ORDER_PLACED', title: 'Order placed', body: `Order ${order.orderNumber} confirmed`, actionUrl: `/account/orders/${order.orderNumber}`, emailHtml: templates.orderPlaced(buyer.name, order.orderNumber, total) }).catch(() => {});
  for (const sub of order.subOrders) {
    const sellerUserId = (sub.shop as any).seller?.userId;
    if (sellerUserId) notify({ userId: sellerUserId, audience: 'SELLER', type: 'SELLER_NEW_ORDER', title: 'New order', body: `Order ${sub.subOrderNumber} received`, actionUrl: '/seller/orders', emailHtml: templates.sellerNewOrder(sub.shop.name, sub.subOrderNumber) }).catch(() => {});
    emitToUser(sellerUserId, 'order:new', { subOrderId: sub.id });
  }

  return { order, payment };
}

export async function listBuyerOrders(buyerId: string, req: Request) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  const where: Prisma.OrderWhereInput = { buyerId };
  if (req.query.status) where.status = req.query.status as OrderStatus;
  const [items, total] = await prisma.$transaction([
    prisma.order.findMany({ where, include: { subOrders: { include: { shop: { select: { name: true, slug: true } }, items: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.order.count({ where }),
  ]);
  return paginated(items, total, page, limit);
}

export async function getOrderForBuyer(buyerId: string, orderNumber: string) {
  const order = await prisma.order.findFirst({
    where: { orderNumber, buyerId },
    include: { subOrders: { include: { shop: { select: { name: true, slug: true } }, items: true, events: { orderBy: { createdAt: 'asc' } } } }, payments: true },
  });
  if (!order) throw ApiError.notFound('Order not found');
  return order;
}

/** Buyer cancels before shipping; stock is released and refunds handled downstream. */
export async function cancelOrder(buyerId: string, orderNumber: string, reason?: string) {
  const order = await prisma.order.findFirst({ where: { orderNumber, buyerId }, include: { subOrders: { include: { items: true } } } });
  if (!order) throw ApiError.notFound('Order not found');
  if (([OrderStatus.SHIPPED, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED] as OrderStatus[]).includes(order.status)) throw ApiError.badRequest('This order can no longer be cancelled — please request a return instead');
  if (order.status === OrderStatus.CANCELLED) return order;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const sub of order.subOrders) {
      if (([OrderStatus.SHIPPED, OrderStatus.DELIVERED] as OrderStatus[]).includes(sub.status)) continue;
      for (const item of sub.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (product) {
          await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: { increment: item.quantity }, soldCount: { decrement: item.quantity } } });
          await tx.stockMovement.create({ data: { productId: item.productId, changeType: StockChangeType.CANCELLATION, quantityDelta: item.quantity, quantityBefore: product.stockQuantity, quantityAfter: product.stockQuantity + item.quantity, referenceType: ReferenceEntityType.SUB_ORDER, referenceId: sub.id } });
        }
      }
      await tx.sellerSubOrder.update({ where: { id: sub.id }, data: { status: OrderStatus.CANCELLED, cancelledAt: new Date() } });
    }
    await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.CANCELLED, cancelledAt: new Date(), cancelReason: reason } });
    await tx.orderEvent.create({ data: { orderId: order.id, status: OrderStatus.CANCELLED, title: 'Order cancelled', description: reason, actorType: 'BUYER', actorId: buyerId } });
  });

  const { refundOrder } = await import('../payments/payment.service');
  await refundOrder(order.id, 'buyer-cancel');
  const buyer = await prisma.user.findUnique({ where: { id: buyerId } });
  if (buyer) notify({ userId: buyerId, type: 'ORDER_STATUS', title: 'Order cancelled', body: `Order ${order.orderNumber} was cancelled`, emailHtml: templates.orderStatus(buyer.name, order.orderNumber, 'Cancelled') }).catch(() => {});
  return prisma.order.findUnique({ where: { id: order.id } });
}
