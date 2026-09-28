import { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, optionalAuth, requirePermission, requireRoles } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/http';
import ApiError from '../../utils/ApiError';
import { uploader, withCategory } from '../../lib/upload';
import { UserRole } from '@prisma/client';
import * as review from './review.service';

const router = Router();

// ── Public / buyer ──
router.get('/product/:productId', asyncHandler(async (req: Request, res: Response) => {
  const data = await review.listProductReviews(req.params.productId, req);
  return ok(res, data.data, 200, { ...data.meta, ratingBreakdown: data.ratingBreakdown });
}));
router.get('/product/:productId/summary', asyncHandler(async (req, res: Response) => ok(res, await review.summarizeProductReviews(req.params.productId))));

router.post('/', requireAuth, validate(z.object({
  productId: z.string().min(1),
  orderItemId: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(140).optional(),
  body: z.string().max(4000).optional(),
})), asyncHandler(async (req: Request, res: Response) => created(res, await review.createReview(req.user!.id, req.body))));

router.post('/:id/media', requireAuth, withCategory('reviews'), uploader(6).array('files', 6), asyncHandler(async (req: Request, res: Response) => {
  const files = (req.files ?? []) as Express.Multer.File[];
  return ok(res, await review.addReviewMedia(req.params.id, req.user!.id, files));
}));
router.post('/:id/helpful', optionalAuth, validate(z.object({ isHelpful: z.boolean().default(true) })), asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Login required to vote');
  return ok(res, await review.voteHelpful(req.params.id, req.user.id, req.body.isHelpful));
}));
router.post('/:id/report', requireAuth, validate(z.object({ reason: z.string().min(3).max(500) })), asyncHandler(async (req: Request, res: Response) => ok(res, await review.reportReview(req.params.id, req.user!.id, req.body.reason))));

// ── Seller ──
router.get('/seller', requireRoles(UserRole.SELLER), asyncHandler(async (req: Request, res: Response) => {
  const data = await review.listSellerReviews(req.user!.id, req);
  return ok(res, data.data, 200, data.meta);
}));
router.post('/:id/reply', requireRoles(UserRole.SELLER), validate(z.object({ reply: z.string().min(2).max(2000) })), asyncHandler(async (req: Request, res: Response) => ok(res, await review.sellerReply(req.user!.id, req.params.id, req.body.reply))));

// ── Moderation ──
router.post('/:id/visibility', requireAuth, requirePermission('product:moderate'), validate(z.object({ isVisible: z.boolean() })), asyncHandler(async (req: Request, res: Response) => ok(res, await review.setReviewVisibility(req.user!.id, req.params.id, req.body.isVisible))));

export default router;
