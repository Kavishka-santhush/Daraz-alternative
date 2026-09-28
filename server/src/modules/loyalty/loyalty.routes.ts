import { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/http';
import { getPagination } from '../../utils/pagination';
import * as loyalty from './loyalty.service';

const router = Router();

// ── Buyer ──
router.get('/me', requireAuth, asyncHandler(async (req: Request, res: Response) => ok(res, await loyalty.getLoyaltySummary(req.user!.id))));
router.get('/me/ledger', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = getPagination(req);
  const data = await loyalty.listLedger(req.user!.id, page, limit);
  return ok(res, data.data, 200, data.meta);
}));
router.post('/preview-redeem', requireAuth, validate(z.object({ subtotal: z.coerce.number().min(0) })), asyncHandler(async (req: Request, res: Response) => ok(res, await loyalty.previewRedeem(req.user!.id, req.body.subtotal))));

// ── Public config (display rules on the rewards page) ──
router.get('/config', asyncHandler(async (_req: Request, res: Response) => ok(res, await loyalty.getLoyaltyConfig())));

// ── Admin ──
const configBody = z.object({
  pointsPerCurrency: z.coerce.number().min(0).optional(),
  pointsToCurrency: z.coerce.number().min(0).optional(),
  redeemMinPoints: z.coerce.number().int().min(0).optional(),
  maxRedeemPercent: z.coerce.number().min(0).max(100).optional(),
  coinsEnabled: z.boolean().optional(),
  cashbackPercent: z.coerce.number().min(0).max(100).optional(),
  cashbackCategories: z.array(z.string()).optional(),
});
router.patch('/config', requireAuth, requirePermission('promo:manage'), validate(configBody), asyncHandler(async (req: Request, res: Response) => ok(res, await loyalty.adminUpdateConfig(req.user!.id, req.body))));
router.post('/adjust', requireAuth, requirePermission('promo:manage'), validate(z.object({
  userId: z.string().min(1),
  delta: z.coerce.number().int().refine((n) => n !== 0, 'delta must be non-zero'),
  reason: z.string().min(3).max(200),
  type: z.enum(['POINTS', 'COINS', 'CASHBACK']).optional(),
})), asyncHandler(async (req: Request, res: Response) => ok(res, await loyalty.adminAdjustPoints(req.user!.id, req.body.userId, req.body.delta, req.body.reason, (req.body.type as any) ?? undefined))));
router.get('/leaderboard', requireAuth, requirePermission('promo:manage'), asyncHandler(async (req: Request, res: Response) => ok(res, await loyalty.adminLeaderboard(Number(req.query.limit ?? 20)))));

export default router;
