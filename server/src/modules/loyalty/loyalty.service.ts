import { Prisma, ReferenceEntityType, RewardType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';
import { paginated } from '../../utils/pagination';
import { notify } from '../notifications/notification.service';

const d = (n: number) => new Prisma.Decimal(n);

/** A small flat coin grant for completing a delivered order (coins are a separate fun currency). */
const COINS_PER_ORDER = 5;
/** Starter bonus granted once on signup. */
export const SIGNUP_BONUS_POINTS = 100;

export async function getLoyaltyConfig() {
  const config = await prisma.loyaltyConfig.findFirst();
  if (config) return config;
  // Sensible defaults if the operator has not created a config row yet.
  return {
    id: 'default',
    pointsPerCurrency: d(0.01),
    pointsToCurrency: d(1),
    redeemMinPoints: 100,
    maxRedeemPercent: d(20),
    coinsEnabled: true,
    cashbackPercent: d(0),
    cashbackCategories: [] as string[],
    updatedAt: new Date(0),
  } satisfies Prisma.LoyaltyConfigUncheckedCreateInput & { id: string; updatedAt: Date };
}

/** Shape returned to buyer dashboards. */
export async function getLoyaltySummary(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { loyaltyPoints: true, coins: true },
  });
  if (!user) throw ApiError.notFound('User not found');
  const config = await getLoyaltyConfig();
  const pointValue = Number(config.pointsToCurrency);
  const { data: recent } = await listLedger(userId, 1, 8);
  return {
    points: user.loyaltyPoints,
    coins: user.coins,
    pointsValue: pointValue,
    currencyValue: Number(d(user.loyaltyPoints * pointValue).toFixed(2)),
    redeemMinPoints: config.redeemMinPoints,
    maxRedeemPercent: Number(config.maxRedeemPercent),
    canRedeem: user.loyaltyPoints >= config.redeemMinPoints,
    recent,
  };
}

export async function listLedger(userId: string, page = 1, limit = 20) {
  const where: Prisma.LoyaltyLedgerWhereInput = { userId };
  const [rows, total] = await prisma.$transaction([
    prisma.loyaltyLedger.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.loyaltyLedger.count({ where }),
  ]);
  return paginated(
    rows.map((r) => ({
      id: r.id,
      points: r.points,
      type: r.type,
      reason: r.reason,
      referenceType: r.referenceType,
      referenceId: r.referenceId,
      balanceAfter: r.balanceAfter,
      createdAt: r.createdAt,
    })),
    total,
    page,
    limit,
  );
}

/** Preview how much a buyer could redeem against a given order subtotal. */
export async function previewRedeem(userId: string, subtotal: number) {
  const { computeLoyaltyRedeem } = await import('../orders/order.pricing');
  const redeem = await computeLoyaltyRedeem(userId, subtotal);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { loyaltyPoints: true } });
  return {
    available: user?.loyaltyPoints ?? 0,
    pointsToUse: redeem.points,
    discount: redeem.discount,
    remaining: (user?.loyaltyPoints ?? 0) - redeem.points,
  };
}

/**
 * Core points mutation. Positive deltas credit, negative deltas debit. The
 * running balance is captured on the ledger row for auditability.
 */
export async function mutatePoints(
  userId: string,
  delta: number,
  reason: string,
  type: RewardType = RewardType.POINTS,
  referenceType?: ReferenceEntityType,
  referenceId?: string,
) {
  if (delta === 0) throw ApiError.badRequest('Delta cannot be zero');
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const current = await tx.user.findUnique({ where: { id: userId }, select: { loyaltyPoints: true } });
    if (!current) throw ApiError.notFound('User not found');
    if (type === RewardType.POINTS && current.loyaltyPoints + delta < 0) {
      throw ApiError.badRequest('Insufficient points balance');
    }
    const field = type === RewardType.COINS ? 'coins' : 'loyaltyPoints';
    const updated = await tx.user.update({
      where: { id: userId },
      data: { [field]: { increment: delta } },
      select: { [field]: true } as any,
    });
    const balanceAfter = Number((updated as any)[field]);
    return tx.loyaltyLedger.create({
      data: { userId, points: delta, type, reason, referenceType, referenceId, balanceAfter },
    });
  });
}

/** Idempotent: awards points, coins and cashback for a fully delivered order. */
export async function awardOrderLoyalty(orderId: string): Promise<{ awarded: boolean; reason?: string; points?: number; cashback?: number }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { subOrders: { include: { items: { include: { product: { select: { categoryId: true } } } } } } },
  });
  if (!order) throw ApiError.notFound('Order not found');
  if (order.status !== 'DELIVERED') return { awarded: false, reason: 'not-delivered' };

  const already = await prisma.loyaltyLedger.findFirst({
    where: { userId: order.buyerId, referenceType: 'ORDER', referenceId: order.id, type: 'POINTS' },
  });
  if (already) return { awarded: false, reason: 'already-awarded' };

  const config = await getLoyaltyConfig();
  const subtotal = Number(order.subtotal);
  let pointsAwarded = 0;

  // 1. Loyalty points (pre-computed on the order at checkout).
  if (order.loyaltyPointsEarned > 0) {
    await mutatePoints(order.buyerId, order.loyaltyPointsEarned, `Order ${order.orderNumber}`, RewardType.POINTS, ReferenceEntityType.ORDER, order.id);
    pointsAwarded = order.loyaltyPointsEarned;
  }

  // 2. Coins (separate fun currency) for completing a purchase.
  if (config.coinsEnabled && subtotal > 0) {
    await mutatePoints(order.buyerId, COINS_PER_ORDER, `Order ${order.orderNumber} coins`, RewardType.COINS, ReferenceEntityType.ORDER, order.id);
  }

  // 3. Cashback credited to wallet (respects category restrictions).
  let cashbackAmount = 0;
  const cashbackPercent = Number(config.cashbackPercent);
  if (cashbackPercent > 0) {
    const orderCategories = new Set(
      order.subOrders.flatMap((s) => s.items.map((i) => i.product.categoryId).filter(Boolean) as string[]),
    );
    const restrictions = config.cashbackCategories ?? [];
    const eligible = restrictions.length === 0
      ? subtotal
      : subtotal; // category-level apportionment kept simple: applies when any item matches
    const categoryMatch = restrictions.length === 0 || [...orderCategories].some((c) => restrictions.includes(c));
    if (categoryMatch) {
      cashbackAmount = Number(d(eligible * (cashbackPercent / 100)).toFixed(2));
      if (cashbackAmount > 0) {
        const { creditWallet } = await import('../payments/payment.service');
        await creditWallet(order.buyerId, cashbackAmount, 'CASHBACK', ReferenceEntityType.ORDER, order.id, `Cashback for order ${order.orderNumber}`);
        await prisma.loyaltyLedger.create({
          data: { userId: order.buyerId, points: Math.round(cashbackAmount), type: RewardType.CASHBACK, reason: `Cashback order ${order.orderNumber}`, referenceType: ReferenceEntityType.ORDER, referenceId: order.id, balanceAfter: 0 },
        });
      }
    }
  }

  notify({
    userId: order.buyerId,
    type: 'LOYALTY_EARNED',
    title: 'Rewards earned',
    body: `You earned ${pointsAwarded} points${cashbackAmount ? ` and ${cashbackAmount} cashback` : ''} from order ${order.orderNumber}.`,
    actionUrl: '/account/rewards',
    data: { orderId, points: pointsAwarded, cashback: cashbackAmount },
  }).catch(() => {});

  return { awarded: true, points: pointsAwarded, cashback: cashbackAmount };
}

/** One-time signup bonus (safe to call from registration; idempotent). */
export async function awardSignupBonus(userId: string) {
  const existing = await prisma.loyaltyLedger.findFirst({ where: { userId, reason: 'Signup bonus' } });
  if (existing) return { awarded: false };
  await mutatePoints(userId, SIGNUP_BONUS_POINTS, 'Signup bonus', RewardType.POINTS, ReferenceEntityType.USER, userId);
  return { awarded: true, points: SIGNUP_BONUS_POINTS };
}

// ── Admin ──

export async function adminUpdateConfig(staffId: string, input: {
  pointsPerCurrency?: number; pointsToCurrency?: number; redeemMinPoints?: number;
  maxRedeemPercent?: number; coinsEnabled?: boolean; cashbackPercent?: number; cashbackCategories?: string[];
}) {
  const data = {
    ...(input.pointsPerCurrency != null ? { pointsPerCurrency: d(input.pointsPerCurrency) } : {}),
    ...(input.pointsToCurrency != null ? { pointsToCurrency: d(input.pointsToCurrency) } : {}),
    ...(input.redeemMinPoints != null ? { redeemMinPoints: input.redeemMinPoints } : {}),
    ...(input.maxRedeemPercent != null ? { maxRedeemPercent: d(input.maxRedeemPercent) } : {}),
    ...(input.coinsEnabled != null ? { coinsEnabled: input.coinsEnabled } : {}),
    ...(input.cashbackPercent != null ? { cashbackPercent: d(input.cashbackPercent) } : {}),
    ...(input.cashbackCategories != null ? { cashbackCategories: input.cashbackCategories } : {}),
  };
  const existing = await prisma.loyaltyConfig.findFirst();
  const config = existing
    ? await prisma.loyaltyConfig.update({ where: { id: existing.id }, data })
    : await prisma.loyaltyConfig.create({ data });
  await prisma.auditLog.create({ data: { actorId: staffId, action: 'loyalty:config-update', entityType: 'SETTINGS', entityId: config.id, after: data as Prisma.InputJsonValue } });
  return config;
}

export async function adminAdjustPoints(staffId: string, userId: string, delta: number, reason: string, type: RewardType = RewardType.POINTS) {
  if (!reason || reason.trim().length < 3) throw ApiError.badRequest('A reason is required');
  const ledger = await mutatePoints(userId, delta, `Admin: ${reason}`, type);
  await prisma.auditLog.create({ data: { actorId: staffId, action: 'loyalty:adjust', entityType: 'USER', entityId: userId, after: { delta, reason, type } as Prisma.InputJsonValue } });
  notify({ userId, type: 'LOYALTY_ADJUSTED', title: 'Rewards updated', body: `Your balance changed by ${delta}. ${reason}`, actionUrl: '/account/rewards' }).catch(() => {});
  return ledger;
}

export async function adminLeaderboard(limit = 20) {
  const users = await prisma.user.findMany({
    where: { loyaltyPoints: { gt: 0 } },
    orderBy: { loyaltyPoints: 'desc' },
    take: limit,
    select: { id: true, name: true, email: true, loyaltyPoints: true, coins: true },
  });
  return users;
}
