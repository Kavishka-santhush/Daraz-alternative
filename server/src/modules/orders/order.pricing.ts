import { Prisma, VoucherStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';

export interface PricedGroup {
  shopId: string;
  sellerId: string;
  items: { productId: string; variantId?: string | null; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  discount: number;
  shipping: number;
  commissionPercent: number;
  commissionAmount: number;
  sellerEarning: number;
}

export interface PriceResult {
  groups: PricedGroup[];
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  commissionTotal: number;
  loyaltyPointsEarned: number;
  loyaltyPointsRedeemed: number;
  loyaltyDiscount: number;
  vouchersApplied: string[];
}

const d = (n: number | string) => new Prisma.Decimal(n);

/** Loads platform-wide commerce settings (with sane fallbacks). */
export async function getSettings() {
  return prisma.settings.findUnique({ where: { id: 'platform' } });
}

export async function resolveCommission(sellerId: string, categoryId: string): Promise<number> {
  const seller = await prisma.sellerProfile.findUnique({ where: { id: sellerId }, select: { commissionOverride: true, tier: true } });
  if (seller?.commissionOverride != null) return Number(seller.commissionOverride);
  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { commissionPercent: true } });
  const tierRule = await prisma.commissionRule.findFirst({ where: { categoryId: category ? categoryId : undefined, sellerTier: seller?.tier } });
  if (tierRule) return Number(tierRule.percent);
  if (category) return Number(category.commissionPercent);
  const settings = await getSettings();
  return Number(settings?.defaultCommissionPercent ?? 8);
}

/**
 * Validates a voucher for a given group (seller or platform scope) and returns the
 * discount amount, or 0 if not eligible. Never throws — checkout surfaces reasons.
 */
export async function evaluateVoucher(code: string, ctx: { buyerId: string; shopId: string; sellerId: string; groupSubtotal: number; categoryIds: string[]; productIds: string[] }): Promise<{ discount: number; freeShipping: boolean; reason?: string; applied: boolean }> {
  const voucher = await prisma.voucher.findUnique({ where: { code: code.toUpperCase() }, include: { applicableCategories: true } });
  if (!voucher || voucher.status !== 'ACTIVE') return { discount: 0, freeShipping: false, applied: false, reason: 'Invalid code' };
  const now = new Date();
  if (voucher.startsAt > now || voucher.expiresAt < now) return { discount: 0, freeShipping: false, applied: false, reason: 'Code not active' };
  if (voucher.usageLimit && voucher.usedCount >= voucher.usageLimit) return { discount: 0, freeShipping: false, applied: false, reason: 'Code fully redeemed' };
  if (voucher.scope === 'SELLER' && voucher.ownerId !== ctx.sellerId) return { discount: 0, freeShipping: false, applied: false, reason: 'Code not valid for this shop' };
  if (voucher.oneTimePerUser) {
    const prior = await prisma.voucherUsage.findFirst({ where: { voucherId: voucher.id, userId: ctx.buyerId } });
    if (prior) return { discount: 0, freeShipping: false, applied: false, reason: 'Already used' };
  }
  if (voucher.newBuyersOnly) {
    const priorOrders = await prisma.order.count({ where: { buyerId: ctx.buyerId, status: 'DELIVERED' } });
    if (priorOrders > 0) return { discount: 0, freeShipping: false, applied: false, reason: 'New buyers only' };
  }
  if (voucher.minOrderAmount && ctx.groupSubtotal < Number(voucher.minOrderAmount)) return { discount: 0, freeShipping: false, applied: false, reason: 'Order below minimum' };

  let discount = 0;
  let freeShipping = false;
  if (voucher.type === 'PERCENT') discount = d(ctx.groupSubtotal).mul(Number(voucher.percentOff) / 100).toNumber();
  else if (voucher.type === 'FIXED') discount = Math.min(Number(voucher.fixedOff), ctx.groupSubtotal);
  else if (voucher.type === 'FREE_SHIPPING') freeShipping = true;
  if (voucher.maxDiscount && discount > Number(voucher.maxDiscount)) discount = Number(voucher.maxDiscount);
  return { discount: Number(d(discount).toFixed(2)), freeShipping, applied: true };
}

/** Computes shipping for a group using platform thresholds + shop delivery days. */
export async function computeShipping(groupSubtotal: number, shopId: string, paymentMethod: string): Promise<number> {
  const settings = await getSettings();
  const freeThreshold = Number(settings?.freeShippingThreshold ?? 5000);
  const flat = Number(settings?.flatShippingFee ?? 250);
  if (groupSubtotal >= freeThreshold) return 0;
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { defaultDeliveryDays: true } });
  const express = (shop?.defaultDeliveryDays ?? 5) <= 2 ? 1.5 : 1;
  return Number(d(flat * express).toFixed(2));
}

export async function computeLoyaltyRedeem(buyerId: string, maxDiscount: number): Promise<{ points: number; discount: number }> {
  const [user, config] = await Promise.all([
    prisma.user.findUnique({ where: { id: buyerId }, select: { loyaltyPoints: true } }),
    prisma.loyaltyConfig.findFirst(),
  ]);
  if (!user || !config) return { points: 0, discount: 0 };
  if (user.loyaltyPoints < config.redeemMinPoints) return { points: 0, discount: 0 };
  const pointValue = Number(config.pointsToCurrency);
  const maxByPercent = maxDiscount * (Number(config.maxRedeemPercent) / 100);
  const discount = Math.min(user.loyaltyPoints * pointValue, maxByPercent);
  const points = Math.round(discount / pointValue);
  return { points, discount: Number(d(discount).toFixed(2)) };
}

export function loyaltyEarned(subtotal: number, config: { pointsPerCurrency: Prisma.Decimal } | null): number {
  if (!config) return Math.floor(subtotal * 0.01);
  return Math.floor(subtotal * Number(config.pointsPerCurrency));
}
