import { Prisma, ReferenceEntityType, RewardType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';
import { paginated } from '../../utils/pagination';
import { notify } from '../notifications/notification.service';

const d = (n: number) => new Prisma.Decimal(n);

export async function getReferralConfig() {
  const config = await prisma.referralConfig.findFirst();
  if (config) return config;
  return {
    id: 'default',
    isActive: true,
    rewardType: RewardType.POINTS,
    referrerReward: 500,
    refereeReward: 500,
    minOrderAmount: d(0),
    maxRewardsPerUser: 50,
    updatedAt: new Date(0),
  } satisfies Prisma.ReferralConfigUncheckedCreateInput & { id: string; updatedAt: Date };
}

export async function getReferralInfo(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true, name: true, _count: { select: { referralsMade: true } } },
  });
  if (!user) throw ApiError.notFound('User not found');
  const config = await getReferralConfig();
  const granted = await prisma.referralReward.aggregate({
    where: { referrerId: userId, grantedAt: { not: null } },
    _sum: { rewardAmount: true },
    _count: { _all: true },
  });
  return {
    code: user.referralCode,
    shareUrl: `/r/${user.referralCode}`,
    referralCount: user._count.referralsMade,
    rewardsGranted: granted._count._all,
    totalEarned: granted._sum.rewardAmount ?? 0,
    rewardType: config.rewardType,
    referrerReward: config.referrerReward,
    isActive: config.isActive,
  };
}

/** Public: resolve a code so the signup form can show who referred them. */
export async function lookupCode(code: string) {
  const referrer = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { id: true, name: true },
  });
  if (!referrer) throw ApiError.notFound('Invalid referral code');
  const config = await getReferralConfig();
  return { valid: true, referrerName: referrer.name, isActive: config.isActive, refereeReward: config.refereeReward };
}

/** Called at registration: records the referral relationship (pending until first order). */
export async function attachReferral(refereeId: string, code: string) {
  const config = await getReferralConfig();
  if (!config.isActive) throw ApiError.badRequest('Referral programme is currently inactive');
  const referrer = await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } });
  if (!referrer) throw ApiError.notFound('Invalid referral code');
  if (referrer.id === refereeId) throw ApiError.badRequest('You cannot refer yourself');
  const referee = await prisma.user.findUnique({ where: { id: refereeId }, select: { referredById: true } });
  if (!referee) throw ApiError.notFound('User not found');
  if (referee.referredById) return { already: true };

  await prisma.$transaction([
    prisma.user.update({ where: { id: refereeId }, data: { referredById: referrer.id } }),
    prisma.referralReward.create({
      data: { referrerId: referrer.id, refereeId, code, rewardAmount: config.referrerReward, grantedAt: null },
    }),
  ]);
  return { attached: true };
}

export async function listReferrals(userId: string, page = 1, limit = 20) {
  const where: Prisma.ReferralRewardWhereInput = { referrerId: userId };
  const [rows, total] = await prisma.$transaction([
    prisma.referralReward.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: { id: true, rewardAmount: true, grantedAt: true, createdAt: true, referee: { select: { name: true, createdAt: true } } },
    }),
    prisma.referralReward.count({ where }),
  ]);
  return paginated(
    rows.map((r) => ({
      id: r.id,
      refereeName: maskName(r.referee.name),
      rewardAmount: r.rewardAmount,
      status: r.grantedAt ? 'GRANTED' : 'PENDING',
      grantedAt: r.grantedAt,
      referredAt: r.createdAt,
    })),
    total,
    page,
    limit,
  );
}

function maskName(name: string) {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return `${parts[0].slice(0, 1)}***`;
  return `${parts[0]} ${parts[parts.length - 1].slice(0, 1)}***`;
}

/**
 * Idempotent: grants both referrer & referee rewards when the referee's first
 * qualifying order is delivered. Safe to call from the order-completion hook.
 */
export async function grantReferralReward(orderId: string): Promise<{ granted: boolean; reason?: string }> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, buyerId: true, subtotal: true, orderNumber: true, status: true } });
  if (!order || order.status !== 'DELIVERED') return { granted: false, reason: 'not-delivered' };

  const reward = await prisma.referralReward.findFirst({ where: { refereeId: order.buyerId, orderTriggeredId: null } });
  if (!reward) return { granted: false, reason: 'no-pending-referral' };
  if (reward.grantedAt) return { granted: false, reason: 'already-granted' };

  const config = await getReferralConfig();
  if (!config.isActive) return { granted: false, reason: 'inactive' };
  if (Number(order.subtotal) < Number(config.minOrderAmount)) return { granted: false, reason: 'below-minimum' };

  // Enforce per-referrer cap.
  const grantedCount = await prisma.referralReward.count({ where: { referrerId: reward.referrerId, grantedAt: { not: null } } });
  if (grantedCount >= config.maxRewardsPerUser) return { granted: false, reason: 'cap-reached' };

  const { mutatePoints } = await import('../loyalty/loyalty.service');
  const credit = async (userId: string, amount: number, label: string) => {
    if (config.rewardType === RewardType.CASHBACK) {
      const { creditWallet } = await import('../payments/payment.service');
      await creditWallet(userId, amount, 'CASHBACK', ReferenceEntityType.ORDER, order.id, label);
    } else {
      await mutatePoints(userId, amount, label, config.rewardType, ReferenceEntityType.ORDER, order.id);
    }
  };

  await credit(reward.referrerId, config.referrerReward, `Referral reward (${order.orderNumber})`);
  await credit(reward.refereeId, config.refereeReward, `Welcome referral bonus (${order.orderNumber})`);

  await prisma.referralReward.update({
    where: { id: reward.id },
    data: { grantedAt: new Date(), rewardAmount: config.referrerReward, orderTriggeredId: order.id },
  });

  const referee = await prisma.user.findUnique({ where: { id: reward.refereeId }, select: { name: true } });
  notify({
    userId: reward.referrerId,
    type: 'REFERRAL_REWARD',
    title: 'Referral reward unlocked',
    body: `${referee?.name ?? 'A friend'} placed their first order — you earned ${config.referrerReward} ${config.rewardType.toLowerCase()}.`,
    actionUrl: '/account/referrals',
    data: { orderId: order.id, amount: config.referrerReward },
  }).catch(() => {});

  return { granted: true };
}

// ── Admin ──

export async function adminUpdateConfig(staffId: string, input: {
  isActive?: boolean; rewardType?: RewardType; referrerReward?: number; refereeReward?: number; minOrderAmount?: number; maxRewardsPerUser?: number;
}) {
  const data = {
    ...(input.isActive != null ? { isActive: input.isActive } : {}),
    ...(input.rewardType != null ? { rewardType: input.rewardType } : {}),
    ...(input.referrerReward != null ? { referrerReward: input.referrerReward } : {}),
    ...(input.refereeReward != null ? { refereeReward: input.refereeReward } : {}),
    ...(input.minOrderAmount != null ? { minOrderAmount: d(input.minOrderAmount) } : {}),
    ...(input.maxRewardsPerUser != null ? { maxRewardsPerUser: input.maxRewardsPerUser } : {}),
  };
  const existing = await prisma.referralConfig.findFirst();
  const config = existing
    ? await prisma.referralConfig.update({ where: { id: existing.id }, data })
    : await prisma.referralConfig.create({ data });
  await prisma.auditLog.create({ data: { actorId: staffId, action: 'referral:config-update', entityType: 'SETTINGS', entityId: config.id, after: data as Prisma.InputJsonValue } });
  return config;
}

export async function adminStats() {
  const [totalReferrals, granted, pending] = await Promise.all([
    prisma.referralReward.count(),
    prisma.referralReward.aggregate({ where: { grantedAt: { not: null } }, _sum: { rewardAmount: true } }),
    prisma.referralReward.count({ where: { grantedAt: null } }),
  ]);
  return { totalReferrals, grantedRewards: granted._sum.rewardAmount ?? 0, pendingRewards: pending };
}
