import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';
import { paginated } from '../../utils/pagination';
import { emitToUser } from '../../lib/socket';
import { vapidPublicKey } from '../../lib/webpush';
import { notify, NotifyInput } from './notification.service';
import type { Request } from 'express';

// ── Inbox ──

export async function listNotifications(userId: string, req: Request) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const where: Prisma.NotificationWhereInput = { userId };
  if (req.query.unread === 'true') where.isRead = false;
  if (req.query.audience) where.audience = req.query.audience as Prisma.NotificationWhereInput['audience'];
  if (req.query.type) where.type = String(req.query.type);
  const [items, total, unread] = await prisma.$transaction([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  const result = paginated(items, total, page, limit);
  return { ...result, meta: { ...result.meta, unreadCount: unread } };
}

export async function unreadCount(userId: string, audience?: string) {
  const count = await prisma.notification.count({ where: { userId, isRead: false, ...(audience ? { audience: audience as never } : {}) } });
  return { count };
}

export async function markRead(userId: string, notificationId: string) {
  const n = await prisma.notification.findFirst({ where: { id: notificationId, userId } });
  if (!n) throw ApiError.notFound('Notification not found');
  if (!n.isRead) {
    await prisma.notification.update({ where: { id: notificationId }, data: { isRead: true, readAt: new Date() } });
    emitToUser(userId, 'notification:read', { id: notificationId });
  }
  return { ok: true };
}

export async function markAllRead(userId: string) {
  const { count } = await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true, readAt: new Date() } });
  emitToUser(userId, 'notification:readAll', { count });
  return { updated: count };
}

export async function removeNotification(userId: string, notificationId: string) {
  const n = await prisma.notification.findFirst({ where: { id: notificationId, userId } });
  if (!n) throw ApiError.notFound('Notification not found');
  await prisma.notification.delete({ where: { id: notificationId } });
  return { ok: true };
}

// ── Preferences ──

export async function getPreferences(userId: string) {
  const prefs = await prisma.notificationPreference.findMany({ where: { userId } });
  return { defaults: { inApp: true, email: true, push: false }, preferences: prefs };
}

export async function setPreference(userId: string, input: { typeKey: string; inApp?: boolean; email?: boolean; push?: boolean }) {
  return prisma.notificationPreference.upsert({
    where: { userId_typeKey: { userId, typeKey: input.typeKey } },
    create: { userId, typeKey: input.typeKey, inApp: input.inApp ?? true, email: input.email ?? true, push: input.push ?? false },
    update: { ...(input.inApp !== undefined ? { inApp: input.inApp } : {}), ...(input.email !== undefined ? { email: input.email } : {}), ...(input.push !== undefined ? { push: input.push } : {}) },
  });
}

// ── Web push subscriptions ──

export function getVapidKey() {
  const key = vapidPublicKey();
  if (!key) throw ApiError.badRequest('Push notifications are not configured on this server');
  return { publicKey: key };
}

export async function savePushSubscription(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string) {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) throw ApiError.badRequest('Invalid push subscription');
  return prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId, endpoint: sub.endpoint, keys: sub.keys as Prisma.InputJsonValue, userAgent },
    update: { userId, keys: sub.keys as Prisma.InputJsonValue },
  });
}

export async function deletePushSubscription(userId: string, endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
  return { ok: true };
}

// ── Staff broadcast / announcements ──

export interface BroadcastInput {
  title: string;
  body: string;
  audience: 'ALL' | 'BUYERS' | 'SELLERS' | 'STAFF';
  actionUrl?: string;
  emailHtml?: string;
}

const AUDIENCE_ROLES: Record<BroadcastInput['audience'], UserRole[]> = {
  ALL: [UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT_AGENT, UserRole.OPERATIONS_MANAGER, UserRole.FINANCE_MANAGER],
  BUYERS: [UserRole.BUYER],
  SELLERS: [UserRole.SELLER],
  STAFF: [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT_AGENT, UserRole.OPERATIONS_MANAGER, UserRole.FINANCE_MANAGER],
};

/** Fan a broadcast out to every user in the audience (chunked to avoid overload). */
export async function broadcast(actorId: string, input: BroadcastInput) {
  const roles = AUDIENCE_ROLES[input.audience] ?? AUDIENCE_ROLES.ALL;
  const users = await prisma.user.findMany({ where: { role: { in: roles }, status: 'ACTIVE' }, select: { id: true } });
  const payload: Omit<NotifyInput, 'userId'> = {
    type: 'ANNOUNCEMENT',
    title: input.title,
    body: input.body,
    actionUrl: input.actionUrl,
    audience: input.audience === 'SELLERS' ? 'SELLER' : input.audience === 'STAFF' ? 'ADMIN' : 'BUYER',
    emailHtml: input.emailHtml,
  };
  const CHUNK = 100;
  for (let i = 0; i < users.length; i += CHUNK) {
    await Promise.all(users.slice(i, i + CHUNK).map((u) => notify({ ...payload, userId: u.id })));
  }
  await prisma.auditLog.create({ data: { actorId, action: 'notification:broadcast', entityType: 'SETTINGS', entityId: input.audience, after: { title: input.title, recipients: users.length } as Prisma.InputJsonValue } });
  return { recipients: users.length };
}
