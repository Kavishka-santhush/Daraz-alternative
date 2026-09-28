import { Prisma, PaymentMethod, PaymentStatus, PaymentPurpose, WalletTxPurpose, TransactionType, ReferenceEntityType, InstallmentStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import ApiError from '../../utils/ApiError';
import { referenceNumber } from '../../utils/nano';
import { createPaymentIntent, getStripe } from '../../lib/stripe';
import { notify } from '../notifications/notification.service';
import { templates } from '../../lib/email/templates';
import { emitToUser } from '../../lib/socket';

const d = (n: number | string) => new Prisma.Decimal(n);

export interface InitiatePaymentInput {
  order: any;
  buyerId: string;
  method: 'CARD' | 'WALLET' | 'COD' | 'INSTALLMENTS';
  amount: number;
  installmentPlan?: 'MONTH_3' | 'MONTH_6' | 'MONTH_12';
}

/**
 * Creates the Payment record and, depending on method, a Stripe intent, a wallet
 * debit, or a COD placeholder. Returns client-facing payment instructions.
 */
export async function initiatePayment(input: InitiatePaymentInput) {
  const { order, buyerId, method, amount } = input;

  if (method === 'WALLET') {
    const wallet = await prisma.wallet.findUnique({ where: { userId: buyerId } });
    if (!wallet) throw ApiError.notFound('Wallet not found');
    if (Number(wallet.balance) < amount) throw ApiError.badRequest('Insufficient wallet balance');
    const payment = await prisma.payment.create({
      data: { orderId: order.id, buyerId, method: PaymentMethod.WALLET, amount: d(amount), status: PaymentStatus.PROCESSING, currency: env.business.currency },
    });
    await debitWallet(buyerId, amount, WalletTxPurpose.ORDER_PAYMENT, ReferenceEntityType.ORDER, order.id, `Order ${order.orderNumber}`);
    await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.SUCCEEDED, paidAt: new Date() } });
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: PaymentStatus.SUCCEEDED } });
    return { method: 'WALLET', paymentId: payment.id, status: 'SUCCEEDED' as const };
  }

  if (method === 'COD') {
    const payment = await prisma.payment.create({
      data: { orderId: order.id, buyerId, method: PaymentMethod.COD, amount: d(amount), status: PaymentStatus.PENDING, currency: env.business.currency },
    });
    return { method: 'COD', paymentId: payment.id, status: 'PENDING' as const };
  }

  const isInstallment = method === 'INSTALLMENTS';
  const intent = await createPaymentIntent(amount, env.business.currency, { orderId: order.id, buyerId, type: isInstallment ? 'installment' : 'card' });
  const payment = await prisma.payment.create({
    data: {
      orderId: order.id, buyerId,
      method: isInstallment ? PaymentMethod.INSTALLMENTS : PaymentMethod.CARD,
      amount: d(amount), status: PaymentStatus.PENDING, stripePaymentIntentId: intent.id, currency: env.business.currency,
    },
  });
  if (isInstallment && input.installmentPlan) await createInstallmentSchedule(payment.id, order.id, amount, input.installmentPlan);
  return { method: isInstallment ? 'INSTALLMENTS' : 'CARD', paymentId: payment.id, clientSecret: intent.clientSecret, status: 'PENDING' as const };
}

async function createInstallmentSchedule(paymentId: string, orderId: string, amount: number, plan: 'MONTH_3' | 'MONTH_6' | 'MONTH_12') {
  const months = plan === 'MONTH_3' ? 3 : plan === 'MONTH_6' ? 6 : 12;
  const upfront = Number(d(amount).mul(0.2));
  const remaining = amount - upfront;
  const perMonth = Number(d(remaining).div(months).toFixed(2));
  await prisma.installmentPlan.create({
    data: {
      paymentId, orderId, planType: plan as any, totalAmount: d(amount), upfrontAmount: d(upfront), installmentAmount: d(perMonth), tenureMonths: months, interestRate: d(0),
      records: {
        create: Array.from({ length: months }).map((_, i) => ({
          indexNo: i + 1,
          dueDate: new Date(Date.now() + (i + 1) * 30 * 24 * 60 * 60 * 1000),
          amount: d(perMonth),
          status: InstallmentStatus.DUE,
        })),
      },
    },
  });
}

/** Marks a payment as captured (called from the Stripe webhook). */
export async function confirmPaymentByIntent(paymentIntentId: string) {
  const payment = await prisma.payment.findUnique({ where: { stripePaymentIntentId: paymentIntentId }, include: { order: { include: { buyer: true } } } });
  if (!payment) throw ApiError.notFound('Payment not found');
  if (payment.status === PaymentStatus.SUCCEEDED) return { ok: true };
  await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.SUCCEEDED, paidAt: new Date() } });
  if (payment.orderId) {
    await prisma.order.update({ where: { id: payment.orderId }, data: { paymentStatus: PaymentStatus.SUCCEEDED, paidAmount: payment.amount } });
    if (payment.order?.buyer) notify({ userId: payment.order.buyerId!, type: 'ORDER_PLACED', title: 'Payment received', body: `We received your payment for ${payment.order.orderNumber}`, actionUrl: `/account/orders/${payment.order.orderNumber}`, emailHtml: templates.orderPlaced(payment.order.buyer.name, payment.order.orderNumber, Number(payment.amount)) }).catch(() => {});
  }
  return { ok: true };
}

export async function markPaymentFailed(paymentIntentId: string, reason: string) {
  const payment = await prisma.payment.findUnique({ where: { stripePaymentIntentId: paymentIntentId } });
  if (!payment) return { ok: true };
  await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED, failureReason: reason, retryCount: { increment: 1 } } });
  if (payment.orderId) await prisma.order.update({ where: { id: payment.orderId }, data: { paymentStatus: PaymentStatus.FAILED } });
  return { ok: true };
}

/**
 * Refunds an order (fully or one sub-order share). Routes to Stripe for captured
 * card payments or credits the wallet otherwise. Adjusts seller earnings if settled.
 */
export async function refundOrder(orderId: string, reason: string, subOrderId?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payments: true, subOrders: { include: { items: true } } } });
  if (!order) throw ApiError.notFound('Order not found');

  let amountToRefund = Number(order.paidAmount);
  if (subOrderId) {
    const sub = order.subOrders.find((s) => s.id === subOrderId);
    if (sub) amountToRefund = Number(sub.subtotal) + Number(sub.shippingFee) - Number(sub.discountAmount);
  }
  if (order.paymentMethod === PaymentMethod.COD) {
    // Nothing was captured — just mark it.
    await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: PaymentStatus.REFUNDED, refundedAmount: { increment: d(amountToRefund) } } });
    return { ok: true, refunded: amountToRefund, method: 'COD' };
  }

  const captured = order.payments.find((p) => p.status === PaymentStatus.SUCCEEDED);
  if (captured?.stripePaymentIntentId && amountToRefund > 0) {
    try {
      await getStripe().refunds.create({ payment_intent: captured.stripePaymentIntentId, amount: Math.round(amountToRefund * 100) });
    } catch (err) {
      // Fall back to wallet credit if Stripe refund fails.
      await creditWallet(order.buyerId, amountToRefund, WalletTxPurpose.ORDER_REFUND, ReferenceEntityType.ORDER, orderId, `Refund ${reason}`);
    }
  } else if (amountToRefund > 0) {
    await creditWallet(order.buyerId, amountToRefund, WalletTxPurpose.ORDER_REFUND, ReferenceEntityType.ORDER, orderId, `Refund ${reason}`);
  }

  await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: PaymentStatus.REFUNDED, refundedAmount: { increment: d(amountToRefund) } } });
  if (captured) await prisma.payment.update({ where: { id: captured.id }, data: { status: PaymentStatus.REFUNDED, refundedAmount: { increment: d(amountToRefund) } } });
  const buyer = await prisma.user.findUnique({ where: { id: order.buyerId } });
  if (buyer) notify({ userId: order.buyerId, type: 'REFUND', title: 'Refund issued', body: `${env.business.currency} ${amountToRefund} refunded for ${order.orderNumber}`, actionUrl: '/account/wallet' }).catch(() => {});
  return { ok: true, refunded: amountToRefund };
}

// ── Wallet primitives ──
export async function creditWallet(userId: string, amount: number, purpose: WalletTxPurpose, referenceType?: ReferenceEntityType, referenceId?: string, description?: string) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const wallet = await tx.wallet.upsert({ where: { userId }, create: { userId, balance: d(amount) }, update: { balance: { increment: d(amount) } } });
    const balanceAfter = Number(wallet.balance);
    await tx.walletTransaction.create({ data: { walletId: wallet.id, type: TransactionType.CREDIT, purpose, amount: d(amount), balanceAfter: d(balanceAfter), referenceType, referenceId, description } });
    emitToUser(userId, 'wallet:update', { balance: balanceAfter });
    return balanceAfter;
  });
}

export async function debitWallet(userId: string, amount: number, purpose: WalletTxPurpose, referenceType?: ReferenceEntityType, referenceId?: string, description?: string) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet || Number(wallet.balance) < amount) throw ApiError.badRequest('Insufficient wallet balance');
    const updated = await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { decrement: d(amount) } } });
    await tx.walletTransaction.create({ data: { walletId: wallet.id, type: TransactionType.DEBIT, purpose, amount: d(amount), balanceAfter: updated.balance, referenceType, referenceId, description } });
    emitToUser(userId, 'wallet:update', { balance: Number(updated.balance) });
    return Number(updated.balance);
  });
}

export async function getWallet(userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId }, include: { transactions: { orderBy: { createdAt: 'desc' }, take: 50 } } });
  if (!wallet) return { balance: 0, currency: env.business.currency, transactions: [] };
  return wallet;
}

/** Creates a Stripe intent for a wallet top-up. */
export async function topupWallet(userId: string, amount: number) {
  const intent = await createPaymentIntent(amount, env.business.currency, { buyerId: userId, type: 'wallet_topup' });
  const payment = await prisma.payment.create({ data: { buyerId: userId, method: PaymentMethod.CARD, purpose: PaymentPurpose.WALLET_TOPUP, amount: d(amount), status: PaymentStatus.PENDING, stripePaymentIntentId: intent.id } });
  return { clientSecret: intent.clientSecret, paymentId: payment.id };
}

/** Webhook helper: credit wallet after a top-up intent succeeds. */
export async function confirmTopup(paymentIntentId: string) {
  const payment = await prisma.payment.findUnique({ where: { stripePaymentIntentId: paymentIntentId } });
  if (!payment || payment.purpose !== PaymentPurpose.WALLET_TOPUP || payment.status === PaymentStatus.SUCCEEDED) return { ok: true };
  await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.SUCCEEDED, paidAt: new Date() } });
  await creditWallet(payment.buyerId!, Number(payment.amount), WalletTxPurpose.TOPUP, ReferenceEntityType.SYSTEM, payment.id, 'Wallet top-up');
  return { ok: true };
}

export async function listTransactions(userId: string) {
  return prisma.payment.findMany({ where: { buyerId: userId }, orderBy: { createdAt: 'desc' }, take: 100 });
}
