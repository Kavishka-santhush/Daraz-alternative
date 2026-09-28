import { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/http';
import * as admin from './admin.service';

const router = Router();
router.use(requireAuth);

// ── Overview ──
router.get('/overview', requirePermission('order:manage'), asyncHandler(async (_req: Request, res: Response) => ok(res, await admin.platformOverview())));

// ── Settings ──
router.get('/settings', requirePermission('settings:manage'), asyncHandler(async (_req: Request, res: Response) => ok(res, await admin.getSettings())));
router.patch('/settings', requirePermission('settings:manage'), validate(z.object({
  platformName: z.string().min(2).max(80).optional(),
  platformLogoUrl: z.string().max(400).optional(),
  currency: z.string().length(3).optional(),
  currencySymbol: z.string().max(4).optional(),
  locale: z.string().max(10).optional(),
  defaultCommissionPercent: z.coerce.number().min(0).max(100).optional(),
  returnWindowDays: z.coerce.number().int().min(0).max(120).optional(),
  codEnabled: z.boolean().optional(),
  codMaxAmount: z.coerce.number().min(0).optional(),
  installmentsEnabled: z.boolean().optional(),
  minPayoutAmount: z.coerce.number().min(0).optional(),
  freeShippingThreshold: z.coerce.number().min(0).optional(),
  flatShippingFee: z.coerce.number().min(0).optional(),
  taxPercent: z.coerce.number().min(0).max(100).optional(),
  aiEnabled: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  supportEmail: z.string().email().optional(),
})), asyncHandler(async (req: Request, res: Response) => ok(res, await admin.updateSettings(req.user!.id, req.body))));

// ── Users ──
router.get('/users', requirePermission('user:manage'), asyncHandler(async (req: Request, res: Response) => {
  const data = await admin.listUsers({
    role: req.query.role as string | undefined,
    status: req.query.status as string | undefined,
    search: req.query.search as string | undefined,
    page: Number(req.query.page ?? 1),
    limit: Number(req.query.limit ?? 20),
  });
  return ok(res, data.data, 200, data.meta);
}));
router.get('/users/:id', requirePermission('user:manage'), asyncHandler(async (req: Request, res: Response) => ok(res, await admin.getUserDetail(req.params.id))));
router.post('/users/:id/status', requirePermission('user:manage'), validate(z.object({
  status: z.enum(['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED']),
  reason: z.string().max(300).optional(),
})), asyncHandler(async (req: Request, res: Response) => ok(res, await admin.setUserStatus(req.user!.id, req.params.id, req.body.status as any, req.body.reason))));

// ── Audit log ──
router.get('/audit', requirePermission('audit:view'), asyncHandler(async (req: Request, res: Response) => {
  const data = await admin.listAuditLogs({
    entityType: req.query.entityType as string | undefined,
    entityId: req.query.entityId as string | undefined,
    actorId: req.query.actorId as string | undefined,
    page: Number(req.query.page ?? 1),
    limit: Number(req.query.limit ?? 30),
  });
  return ok(res, data.data, 200, data.meta);
}));

// ── Fraud ──
router.get('/fraud', requirePermission('fraud:review'), asyncHandler(async (req: Request, res: Response) => {
  const data = await admin.listFraudAlerts({ status: req.query.status as string | undefined, page: Number(req.query.page ?? 1), limit: Number(req.query.limit ?? 25) });
  return ok(res, data.data, 200, data.meta);
}));
router.post('/fraud/:id/review', requirePermission('fraud:review'), validate(z.object({
  status: z.enum(['FLAGGED', 'REVIEWING', 'CLEARED', 'ACTION_TAKEN']),
  actionTaken: z.string().max(300).optional(),
})), asyncHandler(async (req: Request, res: Response) => ok(res, await admin.reviewFraudAlert(req.user!.id, req.params.id, req.body.status as any, req.body.actionTaken))));

export default router;
