import { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/http';
import * as rec from './recommendation.service';

const router = Router();

router.get('/similar/:productId', asyncHandler(async (req: Request, res: Response) => ok(res, await rec.getSimilarProducts(req.params.productId, Number(req.query.limit ?? 12)))));
router.get('/frequently-bought/:productId', asyncHandler(async (req: Request, res: Response) => ok(res, await rec.getFrequentlyBoughtTogether(req.params.productId, Number(req.query.limit ?? 6)))));
router.get('/best-sellers', asyncHandler(async (req: Request, res: Response) => ok(res, await rec.getBestSellers(Number(req.query.limit ?? 12), req.query.categoryId as string | undefined))));
router.get('/top-rated', asyncHandler(async (req: Request, res: Response) => ok(res, await rec.getTopRated(Number(req.query.limit ?? 12), req.query.categoryId as string | undefined))));
router.get('/recently-viewed', requireAuth, asyncHandler(async (req: Request, res: Response) => ok(res, await rec.getRecentlyViewed(req.user!.id, Number(req.query.limit ?? 12)))));
router.get('/feed', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  ok(res, req.user ? await rec.getPersonalizedFeed(req.user.id, Number(req.query.limit ?? 24)) : await rec.getBestSellers(Number(req.query.limit ?? 24), req.query.categoryId as string | undefined));
}));
router.post('/ai', optionalAuth, validate(z.object({ query: z.string().min(3).max(300), limit: z.number().int().min(1).max(24).optional() })), asyncHandler(async (req: Request, res: Response) => ok(res, await rec.aiRecommend(req.body.query, req.user?.id, req.body.limit ?? 8))));

export default router;
