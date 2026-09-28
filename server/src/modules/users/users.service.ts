import { Prisma, UserStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, phone: true, avatarUrl: true, role: true, status: true,
      emailVerifiedAt: true, phoneVerifiedAt: true, referralCode: true, loyaltyPoints: true, coins: true, createdAt: true,
      wallet: { select: { balance: true, currency: true } },
      sellerProfile: { select: { id: true, status: true, shop: { select: { id: true, name: true, slug: true } } } },
      _count: { select: { addresses: true, orders: true, wishlists: true, reviews: true } },
    },
  });
  if (!user) throw ApiError.notFound('User not found');
  return {
    ...user,
    walletBalance: user.wallet ? Number(user.wallet.balance) : 0,
    walletCurrency: user.wallet?.currency ?? 'LKR',
  };
}

export async function updateProfile(userId: string, input: { name?: string; phone?: string; avatarUrl?: string }) {
  const data: Prisma.UserUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.avatarUrl !== undefined) data.avatarUrl = input.avatarUrl;
  if (input.phone !== undefined && input.phone !== '') {
    const taken = await prisma.user.findFirst({ where: { phone: input.phone, id: { not: userId } } });
    if (taken) throw ApiError.conflict('That phone number is already in use');
    data.phone = input.phone;
  }
  return prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
  });
}

// ── Addresses ──

async function ensureOneDefault(tx: Prisma.TransactionClient, userId: string, keepId?: string) {
  if (!keepId) return;
  await tx.address.updateMany({ where: { userId, id: { not: keepId } }, data: { isDefault: false } });
}

export async function listAddresses(userId: string) {
  return prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
}

export async function createAddress(userId: string, input: {
  label?: string; contactName: string; contactPhone: string; line1: string; line2?: string;
  city: string; district?: string; province?: string; postalCode?: string; isDefault?: boolean;
}) {
  const count = await prisma.address.count({ where: { userId } });
  const makeDefault = input.isDefault ?? count === 0;
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (makeDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return tx.address.create({ data: { userId, ...input, isDefault: makeDefault } });
  });
}

export async function updateAddress(userId: string, id: string, input: Partial<Awaited<ReturnType<typeof createAddress>>> & { isDefault?: boolean }) {
  const existing = await prisma.address.findFirst({ where: { id, userId } });
  if (!existing) throw ApiError.notFound('Address not found');
  const { id: _id, userId: _u, createdAt: _c, updatedAt: _up, ...rest } = input as any;
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const updated = await tx.address.update({ where: { id }, data: rest });
    if (rest.isDefault) await ensureOneDefault(tx, userId, id);
    return updated;
  });
}

export async function deleteAddress(userId: string, id: string) {
  const existing = await prisma.address.findFirst({ where: { id, userId } });
  if (!existing) throw ApiError.notFound('Address not found');
  await prisma.address.delete({ where: { id } });
  if (existing.isDefault) {
    const next = await prisma.address.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
    if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  return { ok: true };
}

export async function setDefaultAddress(userId: string, id: string) {
  const existing = await prisma.address.findFirst({ where: { id, userId } });
  if (!existing) throw ApiError.notFound('Address not found');
  await prisma.$transaction([
    prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.address.update({ where: { id }, data: { isDefault: true } }),
  ]);
  return { ok: true };
}

// ── Followed shops ──

export async function listFollowedShops(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { followingShops: { select: { id: true, name: true, slug: true, logoUrl: true } } },
  });
  return user?.followingShops ?? [];
}

export async function toggleFollowShop(userId: string, shopId: string) {
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { id: true } });
  if (!shop) throw ApiError.notFound('Shop not found');
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { followingShops: { select: { id: true } } } });
  const following = current?.followingShops.some((s) => s.id === shopId) ?? false;
  await prisma.user.update({
    where: { id: userId },
    data: { followingShops: following ? { disconnect: { id: shopId } } : { connect: { id: shopId } } },
  });
  return { following: !following };
}

// ── Security / sessions activity ──

export async function listLoginActivity(userId: string, limit = 15) {
  return prisma.loginActivity.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, ip: true, userAgent: true, deviceId: true, success: true, method: true, createdAt: true },
  });
}

export async function deleteAccount(userId: string) {
  // Soft delete: retains order/review history for accounting integrity.
  await prisma.user.update({ where: { id: userId }, data: { status: UserStatus.DELETED } });
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return { ok: true };
}
