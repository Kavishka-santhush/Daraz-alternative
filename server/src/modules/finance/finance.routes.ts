import { Request, Response } from 'express';
import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/http';
import * as finance from './finance.service';

const router = Router();
router.use(requireAuth, requirePermission('finance:report'));

router.get('/overview', asyncHandler(async (_req: Request, res: Response) => ok(res, await finance.financeOverview())));
router.get('/revenue-series', asyncHandler(async (req: Request, res: Response) => ok(res, await finance.revenueTimeSeries(Number(req.query.days ?? 30)))));
router.get('/payouts', asyncHandler(async (req: Request, res: Response) => {
  const result = await finance.payoutQueue({
    status: req.query.status as string | undefined,
    page: Number(req.query.page ?? 1),
    limit: Number(req.query.limit ?? 25),
  });
  return ok(res, result.data, 200, { ...result.meta, breakdown: result.breakdown });
}));
router.get('/top-sellers', asyncHandler(async (req: Request, res: Response) => ok(res, await finance.topSellers(Number(req.query.limit ?? 10)))));
router.get('/payment-methods', asyncHandler(async (_req: Request, res: Response) => ok(res, await finance.paymentMethodBreakdown())));
router.get('/wallet-movement', asyncHandler(async (req: Request, res: Response) => ok(res, await finance.walletMovementSummary(Number(req.query.days ?? 30)))));

export default router;
