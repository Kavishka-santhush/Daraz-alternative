import { prisma } from '../../config/prisma';
import { emitToUser } from '../../lib/socket';
import { sendMail } from '../../lib/email/mailer';
import { pushToUser } from '../../lib/webpush';
import logger from '../../config/logger';

export interface NotifyInput {
  userId: string;
  type: string; // e.g. ORDER_PLACED, SELLER_NEW_ORDER, RETURN_UPDATE
  title: string;
  body?: string;
  actionUrl?: string;
  audience?: 'BUYER' | 'SELLER' | 'ADMIN';
  emailHtml?: string; // if provided and channel allowed, an email is sent
  data?: Record<string, unknown>;
}

/**
 * Fan-out helper: persists an in-app notification, pushes it over Socket.io in
 * real time, and (honouring per-user preferences) sends email + web push.
 * Fire-and-forget: notification failures never roll back a business action.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const pref = await prisma.notificationPreference.findUnique({
      where: { userId_typeKey: { userId: input.userId, typeKey: input.type } },
    });
    const allowInApp = pref?.inApp ?? true;
    const allowEmail = pref?.email ?? true;
    const allowPush = pref?.push ?? false;

    if (allowInApp) {
      const created = await prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          actionUrl: input.actionUrl,
          audience: input.audience ?? 'BUYER',
          data: (input.data as any) ?? undefined,
        },
      });
      emitToUser(input.userId, 'notification:new', created);
    }

    if (allowEmail && input.emailHtml) {
      const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { email: true } });
      if (user) await sendMail({ to: user.email, subject: input.title, html: input.emailHtml });
    }

    if (allowPush) {
      await pushToUser(input.userId, { title: input.title, body: input.body, url: input.actionUrl });
    }
  } catch (err) {
    logger.error('notify() failed', (err as Error).message);
  }
}

/** Broadcast to every user holding one of the given roles (used for announcements). */
export async function notifyRoleHolders(roles: string[], input: Omit<NotifyInput, 'userId'>) {
  const users = await prisma.user.findMany({ where: { role: { in: roles as any } }, select: { id: true } });
  await Promise.all(users.map((u) => notify({ ...input, userId: u.id })));
}
