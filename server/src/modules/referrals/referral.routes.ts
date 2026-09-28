import { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/http';
import { getPagination } from '../../utils/pagination';
import * as referral from './referral.service';

const router = Router();

// ── Public ──
router.get('/lookup/:code', asyncHandler(async (req: Request, res: Response) => ok(res, await referral.lookupCode(req.params.code))));

// ── Buyer ──
router.get('/me', requireAuth, asyncHandler(async (req: Request, res: Response) => ok(res, await referral.getReferralInfo(req.user!.id))));
router.get('/me/list', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = getPagination(req);
  const data = await referral.listReferrals(req.user!.id, page, limit);
  return ok(res, data.data, 200, data.meta);
}));
// Allow an already-registered user to attach a code retroactively (before first order).
router.post('/attach', requireAuth, validate(z.object({ code: z.string().min(3).max(40) })), asyncHandler(async (req: Request, res: Response) => ok(res, await referral.attachReferral(req.user!.id, req.body.code))));

// ── Admin ──
router.get('/config', asyncHandler(async (_req: Request, res: Response) => ok(res, await referral.getReferralConfig())));
router.patch('/config', requireAuth, requirePermission('promo:manage'), validate(z.object({
  isActive: z.boolean().optional(),
  rewardType: z.enum(['POINTS', 'COINS', 'CASHBACK']).optional(),
  referrerReward: z.coerce.number().int().min(0).optional(),
  refereeReward: z.coerce.number().int().min(0).optional(),
  minOrderAmount: z.coerce.number().min(0).optional(),
  maxRewardsPerUser: z.coerce.number().int().min(0).optional(),
})), asyncHandler(async (req: Request, res: Response) => ok(res, await referral.adminUpdateConfig(req.user!.id, req.body as any))));
router.get('/stats', requireAuth, requirePermission('promo:manage'), asyncHandler(async (_req: Request, res: Response) => ok(res, await referral.adminStats())));

export default router;
