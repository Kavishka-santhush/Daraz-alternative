import webpush from 'web-push';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import logger from '../config/logger';

let configured = false;
function configure() {
  if (configured) return;
  if (env.vapid.publicKey && !env.vapid.publicKey.startsWith('dev-')) {
    webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);
    configured = true;
  }
}

export const vapidPublicKey = () => env.vapid.publicKey;

/** Sends a web push to every active subscription of a user. */
export async function pushToUser(userId: string, payload: { title: string; body?: string; url?: string }) {
  configure();
  if (!configured) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  const data = JSON.stringify(payload);
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s.endpoint as any, data);
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        } else {
          logger.warn('web push failed', err?.message);
        }
      }
    })
  );
}
