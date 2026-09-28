import { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission, requireRoles } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/http';
import { UserRole } from '@prisma/client';
import * as sponsored from './sponsored.service';

const router = Router();

const dateField = z.string().min(4);

// ── Public: placement rendering + analytics ──
router.get('/placement/:placement', asyncHandler(async (req: Request, res: Response) => ok(res, await sponsored.getActiveForPlacement(req.params.placement, Number(req.query.limit ?? 8)))));
router.post('/track', validate(z.object({ listingId: z.string().min(1), kind: z.enum(['impression', 'click']) })), asyncHandler(async (req: Request, res: Response) => ok(res, await sponsored.trackEvent(req.body.listingId, req.body.kind))));

// ── Seller ──
router.get('/seller', requireRoles(UserRole.SELLER), asyncHandler(async (req: Request, res: Response) => ok(res, await sponsored.listSellerCampaigns(req.user!.id))));
router.post('/seller', requireRoles(UserRole.SELLER), validate(z.object({
  productId: z.string().min(1),
  placement: z.string().min(2).max(60),
  bidAmount: z.coerce.number().positive(),
  billingCycle: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']).optional(),
  startDate: dateField,
  endDate: dateField,
})), asyncHandler(async (req: Request, res: Response) => created(res, await sponsored.createCampaign(req.user!.id, req.body))));
router.post('/seller/:id/pay', requireRoles(UserRole.SELLER), asyncHandler(async (req: Request, res: Response) => ok(res, await sponsored.markPaid(req.user!.id, req.params.id))));
router.patch('/seller/:id/active', requireRoles(UserRole.SELLER), validate(z.object({ isActive: z.boolean() })), asyncHandler(async (req: Request, res: Response) => ok(res, await sponsored.setCampaignActive(req.user!.id, req.params.id, req.body.isActive))));

// ── Admin ──
router.get('/admin', requireAuth, requirePermission('promo:manage'), asyncHandler(async (req: Request, res: Response) => {
  const data = await sponsored.adminListCampaigns({
    status: req.query.status as string | undefined,
    placement: req.query.placement as string | undefined,
    page: Number(req.query.page ?? 1),
    limit: Number(req.query.limit ?? 20),
  });
  return ok(res, data.data, 200, data.meta);
}));
router.post('/admin/:id/approve', requireAuth, requirePermission('promo:manage'), validate(z.object({ approve: z.boolean() })), asyncHandler(async (req: Request, res: Response) => ok(res, await sponsored.adminApprove(req.user!.id, req.params.id, req.body.approve))));
router.get('/admin/report', requireAuth, requirePermission('finance:report'), asyncHandler(async (_req: Request, res: Response) => ok(res, await sponsored.adminSpendReport())));

export default router;
