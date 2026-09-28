import { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/http';
import * as inbox from './notification.inbox';

const router = Router();

router.use(requireAuth);

// ── Inbox ──
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const data = await inbox.listNotifications(req.user!.id, req);
  return ok(res, data.data, 200, data.meta);
}));
router.get('/unread-count', asyncHandler(async (req: Request, res: Response) => ok(res, await inbox.unreadCount(req.user!.id, req.query.audience as string | undefined))));
router.post('/read-all', asyncHandler(async (req: Request, res: Response) => ok(res, await inbox.markAllRead(req.user!.id))));
router.patch('/:id/read', asyncHandler(async (req: Request, res: Response) => ok(res, await inbox.markRead(req.user!.id, req.params.id))));
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => ok(res, await inbox.removeNotification(req.user!.id, req.params.id))));

// ── Preferences ──
router.get('/preferences', asyncHandler(async (req: Request, res: Response) => ok(res, await inbox.getPreferences(req.user!.id))));
router.post('/preferences', validate(z.object({
  typeKey: z.string().min(2).max(60),
  inApp: z.boolean().optional(),
  email: z.boolean().optional(),
  push: z.boolean().optional(),
})), asyncHandler(async (req: Request, res: Response) => ok(res, await inbox.setPreference(req.user!.id, req.body))));

// ── Web push ──
router.get('/push/public-key', asyncHandler(async (req: Request, res: Response) => ok(res, inbox.getVapidKey())));
router.post('/push/subscribe', validate(z.object({
  endpoint: z.string().min(10),
  keys: z.object({ p256dh: z.string().min(10), auth: z.string().min(5) }),
})), asyncHandler(async (req: Request, res: Response) => ok(res, await inbox.savePushSubscription(req.user!.id, req.body, req.headers['user-agent']))));
router.post('/push/unsubscribe', validate(z.object({ endpoint: z.string().min(10) })), asyncHandler(async (req: Request, res: Response) => ok(res, await inbox.deletePushSubscription(req.user!.id, req.body.endpoint))));

// ── Staff broadcast ──
router.post('/broadcast', requirePermission('settings:manage'), validate(z.object({
  title: z.string().min(3).max(140),
  body: z.string().min(3).max(2000),
  audience: z.enum(['ALL', 'BUYERS', 'SELLERS', 'STAFF']),
  actionUrl: z.string().max(300).optional(),
  sendEmail: z.boolean().optional(),
})), asyncHandler(async (req: Request, res: Response) => {
  const { templates } = await import('../../lib/email/templates');
  const user = await (await import('../../config/prisma')).prisma.user.findUnique({ where: { id: req.user!.id }, select: { name: true } });
  ok(res, await inbox.broadcast(req.user!.id, {
    title: req.body.title,
    body: req.body.body,
    audience: req.body.audience,
    actionUrl: req.body.actionUrl,
    emailHtml: req.body.sendEmail ? templates.generic(user?.name ?? 'Team', req.body.title, req.body.body) : undefined,
  }));
}));

export default router;
