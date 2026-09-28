import { Request, Response } from 'express';
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/http';
import { z } from 'zod';
import * as svc from './cart.service';

const router = Router();
router.use(requireAuth);

const addSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.coerce.number().int().positive().max(999).default(1),
});

router.get('/', asyncHandler(async (req, res: Response) => ok(res, await svc.getOrCreateCart(req.user!.id))));
router.post('/items', validate(addSchema), asyncHandler(async (req, res: Response) => ok(res, await svc.addToCart(req.user!.id, req.body))));
router.patch('/items/:id', validate(z.object({ quantity: z.coerce.number().int().min(0).max(999) })), asyncHandler(async (req, res: Response) => ok(res, await svc.updateCartItem(req.user!.id, req.params.id, req.body.quantity))));
router.delete('/items/:id', asyncHandler(async (req, res: Response) => ok(res, await svc.removeCartItem(req.user!.id, req.params.id))));
router.delete('/', asyncHandler(async (req, res: Response) => ok(res, await svc.clearCart(req.user!.id))));

export default router;
