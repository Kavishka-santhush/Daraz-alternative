import { Prisma, SellerTier } from '@prisma/client';
import { prisma, section, info } from './helpers';

/**
 * Platform configuration rows: settings singleton, loyalty/referral configs,
 * and per-category / tier commission rules. All upserts → idempotent.
 */
export async function seedSettings() {
  section('Settings & platform config');

  await prisma.settings.upsert({
    where: { id: 'platform' },
    update: {},
    create: {
      id: 'platform',
      platformName: 'MarketPlace',
      currency: 'LKR',
      currencySymbol: 'Rs',
      locale: 'en',
      defaultCommissionPercent: new Prisma.Decimal(8),
      returnWindowDays: 7,
      codEnabled: true,
      codMaxAmount: new Prisma.Decimal(50000),
      installmentsEnabled: true,
      installmentPlans: [
        { type: 'MONTH_3', tenureMonths: 3, interestRate: 0 },
        { type: 'MONTH_6', tenureMonths: 6, interestRate: 2.5 },
        { type: 'MONTH_12', tenureMonths: 12, interestRate: 5 },
      ] as unknown as Prisma.InputJsonValue,
      minPayoutAmount: new Prisma.Decimal(1000),
      freeShippingThreshold: new Prisma.Decimal(5000),
      flatShippingFee: new Prisma.Decimal(250),
      taxPercent: new Prisma.Decimal(0),
      aiEnabled: true,
      maintenanceMode: false,
      supportEmail: 'support@marketplace.local',
    },
  });
  info('settings (platform singleton)');

  await prisma.loyaltyConfig.upsert({
    where: { id: 'loyalty' },
    update: {},
    create: {
      id: 'loyalty',
      pointsPerCurrency: new Prisma.Decimal(0.01),
      pointsToCurrency: new Prisma.Decimal(1),
      redeemMinPoints: 100,
      maxRedeemPercent: new Prisma.Decimal(20),
      coinsEnabled: true,
      cashbackPercent: new Prisma.Decimal(1),
      cashbackCategories: [],
    },
  });
  info('loyaltyConfig');

  await prisma.referralConfig.upsert({
    where: { id: 'referral' },
    update: {},
    create: {
      id: 'referral',
      isActive: true,
      rewardType: 'POINTS',
      referrerReward: 500,
      refereeReward: 500,
      minOrderAmount: new Prisma.Decimal(1000),
      maxRewardsPerUser: 50,
    },
  });
  info('referralConfig');

  // Baseline commission rules per seller tier (no category → global fallback).
  const baselines: Array<{ tier: SellerTier; percent: number }> = [
    { tier: SellerTier.NEW, percent: 10 },
    { tier: SellerTier.BRONZE, percent: 9 },
    { tier: SellerTier.SILVER, percent: 8 },
    { tier: SellerTier.GOLD, percent: 7 },
    { tier: SellerTier.PLATINUM, percent: 6 },
  ];
  for (const b of baselines) {
    // Compound unique keys containing nullable columns are not valid
    // WhereUniqueInput values, so match explicitly instead of upsert.
    const existing = await prisma.commissionRule.findFirst({
      where: { categoryId: null, sellerTier: b.tier, isBaseline: true },
    });
    if (existing) {
      await prisma.commissionRule.update({
        where: { id: existing.id },
        data: { percent: new Prisma.Decimal(b.percent) },
      });
    } else {
      await prisma.commissionRule.create({
        data: {
          categoryId: null,
          sellerTier: b.tier,
          percent: new Prisma.Decimal(b.percent),
          isBaseline: true,
        },
      });
    }
  }
  info(`commissionRules (${baselines.length} baseline tiers)`);
}
