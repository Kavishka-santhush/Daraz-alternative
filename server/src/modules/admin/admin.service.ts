import { AuditEntityType, FraudStatus, Prisma, UserStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';
import { paginated } from '../../utils/pagination';
import { notify } from '../notifications/notification.service';

const d = (n: number) => new Prisma.Decimal(n);

// ── Platform settings ──

export async function getSettings() {
  const existing = await prisma.settings.findUnique({ where: { id: 'platform' } });
  if (existing) return existing;
  return prisma.settings.create({ data: { id: 'platform' } });
}

export interface SettingsInput {
  platformName?: string; platformLogoUrl?: string; currency?: string; currencySymbol?: string; locale?: string;
  defaultCommissionPercent?: number; returnWindowDays?: number; codEnabled?: boolean; codMaxAmount?: number;
  installmentsEnabled?: boolean; minPayoutAmount?: number; freeShippingThreshold?: number; flatShippingFee?: number;
  taxPercent?: number; aiEnabled?: boolean; maintenanceMode?: boolean; supportEmail?: string;
}

const DECIMAL_FIELDS: (keyof SettingsInput)[] = ['defaultCommissionPercent', 'codMaxAmount', 'minPayoutAmount', 'freeShippingThreshold', 'flatShippingFee', 'taxPercent'];

export async function updateSettings(staffId: string, input: SettingsInput) {
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    data[k] = DECIMAL_FIELDS.includes(k as keyof SettingsInput) ? d(v as number) : v;
  }
  const before = await getSettings();
  const updated = await prisma.settings.update({ where: { id: 'platform' }, data });
  await prisma.auditLog.create({ data: { actorId: staffId, action: 'settings:update', entityType: AuditEntityType.SETTINGS, entityId: 'platform', before: before as Prisma.InputJsonValue, after: data as Prisma.InputJsonValue } });
  return updated;
}

// ── Overview dashboard ──

export async function platformOverview() {
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers, totalSellers, pendingSellers, totalProducts, activeProducts,
    totalOrders, ordersToday, gmvAll, gmvMonth, revenueAll, revenueMonth,
    openTickets, pendingReturns, lowBalanceFlag,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'BUYER' } }),
    prisma.sellerProfile.count(),
    prisma.sellerProfile.count({ where: { status: 'PENDING_APPROVAL' } }),
    prisma.product.count(),
    prisma.product.count({ where: { status: 'ACTIVE' } }),
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.order.aggregate({ where: { paymentStatus: 'SUCCEEDED' }, _sum: { totalAmount: true } }),
    prisma.order.aggregate({ where: { paymentStatus: 'SUCCEEDED', createdAt: { gte: startOfMonth } }, _sum: { totalAmount: true } }),
    prisma.sellerSubOrder.aggregate({ where: { status: 'DELIVERED' }, _sum: { commissionAmount: true } }),
    prisma.sellerSubOrder.aggregate({ where: { status: 'DELIVERED', deliveredAt: { gte: startOfMonth } }, _sum: { commissionAmount: true } }),
    prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    prisma.returnRequest.count({ where: { status: 'REQUESTED' } }),
    prisma.fraudAlert.count({ where: { status: 'FLAGGED' } }),
  ]);

  return {
    users: totalUsers,
    sellers: totalSellers,
    pendingSellerApprovals: pendingSellers,
    products: { total: totalProducts, active: activeProducts },
    orders: { total: totalOrders, today: ordersToday },
    gmv: { all: Number(gmvAll._sum.totalAmount ?? 0), thisMonth: Number(gmvMonth._sum.totalAmount ?? 0) },
    commissionRevenue: { all: Number(revenueAll._sum.commissionAmount ?? 0), thisMonth: Number(revenueMonth._sum.commissionAmount ?? 0) },
    openTickets,
    pendingReturns,
    flaggedFraudAlerts: lowBalanceFlag,
  };
}

// ── User management ──

export async function listUsers(query: { role?: string; status?: string; search?: string; page?: number; limit?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const where: Prisma.UserWhereInput = {
    ...(query.role ? { role: query.role as Prisma.UserWhereInput['role'] } : {}),
    ...(query.status ? { status: query.status as Prisma.UserWhereInput['status'] } : {}),
    ...(query.search
      ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { email: { contains: query.search, mode: 'insensitive' } }, { phone: { contains: query.search } }] }
      : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: { id: true, name: true, email: true, phone: true, role: true, status: true, loyaltyPoints: true, createdAt: true, lastLoginAt: true, _count: { select: { orders: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  return paginated(rows, total, page, limit);
}

export async function getUserDetail(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, phone: true, role: true, status: true, avatarUrl: true, emailVerifiedAt: true, phoneVerifiedAt: true,
      loyaltyPoints: true, coins: true, referralCode: true, createdAt: true, lastLoginAt: true, deviceInfo: true,
      wallet: { select: { balance: true } },
      sellerProfile: { select: { id: true, status: true, tier: true, shop: { select: { id: true, name: true, slug: true } } } },
      loginHistory: { orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, ip: true, userAgent: true, deviceId: true, success: true, method: true, createdAt: true } },
      _count: { select: { orders: true, reviews: true, tickets: true, loginHistory: true } },
    },
  });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

export async function setUserStatus(staffId: string, id: string, status: UserStatus, reason?: string) {
  if (id === staffId) throw ApiError.badRequest('You cannot change your own status');
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, status: true, role: true } });
  if (!target) throw ApiError.notFound('User not found');
  if (target.role === 'SUPER_ADMIN' && status !== 'ACTIVE') {
    throw ApiError.forbidden('A super admin cannot be suspended or banned');
  }
  const updated = await prisma.user.update({ where: { id }, data: { status }, select: { id: true, name: true, status: true } });
  if (status === 'SUSPENDED' || status === 'BANNED') {
    await prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
  }
  await prisma.auditLog.create({ data: { actorId: staffId, action: `user:status:${status}`, entityType: AuditEntityType.USER, entityId: id, after: { reason, from: target.status, to: status } as Prisma.InputJsonValue } });
  notify({ userId: id, type: 'ACCOUNT_STATUS', title: 'Account update', body: `Your account status is now ${status}.${reason ? ` Reason: ${reason}` : ''}` }).catch(() => {});
  return updated;
}

// ── Audit log ──

export async function listAuditLogs(query: { entityType?: string; entityId?: string; actorId?: string; page?: number; limit?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 30));
  const where: Prisma.AuditLogWhereInput = {
    ...(query.entityType ? { entityType: query.entityType as AuditEntityType } : {}),
    ...(query.entityId ? { entityId: query.entityId } : {}),
    ...(query.actorId ? { actorId: query.actorId } : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { actor: { select: { id: true, name: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return paginated(rows, total, page, limit);
}

// ── Fraud alerts ──

export async function listFraudAlerts(query: { status?: string; page?: number; limit?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 25));
  const where: Prisma.FraudAlertWhereInput = query.status ? { status: query.status as FraudStatus } : {};
  const [rows, total] = await prisma.$transaction([
    prisma.fraudAlert.findMany({ where, orderBy: [{ score: 'desc' }, { createdAt: 'desc' }], skip: (page - 1) * limit, take: limit }),
    prisma.fraudAlert.count({ where }),
  ]);
  return paginated(rows.map((r) => ({ ...r, score: Number(r.score) })), total, page, limit);
}

export async function reviewFraudAlert(staffId: string, id: string, status: FraudStatus, actionTaken?: string) {
  const alert = await prisma.fraudAlert.findUnique({ where: { id } });
  if (!alert) throw ApiError.notFound('Fraud alert not found');
  const updated = await prisma.fraudAlert.update({
    where: { id },
    data: { status, reviewedById: staffId, reviewedAt: new Date(), actionTaken },
  });
  await prisma.auditLog.create({ data: { actorId: staffId, action: `fraud:review:${status}`, entityType: AuditEntityType.ORDER, entityId: alert.subjectId, after: { actionTaken } as Prisma.InputJsonValue } });
  return updated;
}
