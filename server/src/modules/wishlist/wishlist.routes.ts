import { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/http';
import * as wish from './wishlist.service';

const router = Router();

const productIdSchema = z.object({ productId: z.string().min(1) });

router.use(requireAuth);

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const data = await wish.listWishlist(req.user!.id, req);
  return ok(res, data.data, 200, data.meta);
}));
router.get('/ids', asyncHandler(async (req: Request, res: Response) => ok(res, await wish.wishlistProductIds(req.user!.id))));
router.post('/', validate(productIdSchema), asyncHandler(async (req: Request, res: Response) => created(res, await wish.addToWishlist(req.user!.id, req.body.productId))));
router.post('/toggle', validate(productIdSchema), asyncHandler(async (req: Request, res: Response) => ok(res, await wish.toggleWishlist(req.user!.id, req.body.productId))));
router.delete('/clear', asyncHandler(async (req: Request, res: Response) => ok(res, await wish.clearWishlist(req.user!.id))));
router.delete('/:productId', asyncHandler(async (req: Request, res: Response) => ok(res, await wish.removeFromWishlist(req.user!.id, req.params.productId))));

export default router;
