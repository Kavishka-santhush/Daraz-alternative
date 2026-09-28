import { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/http';
import { uploader, withCategory, toPublicUrl } from '../../lib/upload';
import ApiError from '../../utils/ApiError';
import * as users from './users.service';

const router = Router();
router.use(requireAuth);

const addressBody = z.object({
  label: z.string().max(40).optional(),
  contactName: z.string().min(2).max(120),
  contactPhone: z.string().min(6).max(20),
  line1: z.string().min(3).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  district: z.string().max(100).optional(),
  province: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  isDefault: z.boolean().optional(),
});

// ── Profile ──
router.get('/me', asyncHandler(async (req: Request, res: Response) => ok(res, await users.getProfile(req.user!.id))));
router.patch('/me', validate(z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().min(6).max(20).optional(),
  avatarUrl: z.string().max(400).optional(),
})), asyncHandler(async (req: Request, res: Response) => ok(res, await users.updateProfile(req.user!.id, req.body))));
router.post('/me/avatar', withCategory('avatars'), uploader(1).fields([{ name: 'image', maxCount: 1 }]), asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as { [key: string]: Express.Multer.File[] } | undefined;
  if (!files?.image?.length) throw ApiError.badRequest('An image is required');
  ok(res, { avatarUrl: toPublicUrl(files.image[0].path) });
}));
router.delete('/me', asyncHandler(async (req: Request, res: Response) => ok(res, await users.deleteAccount(req.user!.id))));

// ── Security ──
router.get('/me/login-activity', asyncHandler(async (req: Request, res: Response) => ok(res, await users.listLoginActivity(req.user!.id))));

// ── Addresses ──
router.get('/me/addresses', asyncHandler(async (req: Request, res: Response) => ok(res, await users.listAddresses(req.user!.id))));
router.post('/me/addresses', validate(addressBody), asyncHandler(async (req: Request, res: Response) => created(res, await users.createAddress(req.user!.id, req.body))));
router.patch('/me/addresses/:id', validate(addressBody.partial()), asyncHandler(async (req: Request, res: Response) => ok(res, await users.updateAddress(req.user!.id, req.params.id, req.body))));
router.post('/me/addresses/:id/default', asyncHandler(async (req: Request, res: Response) => ok(res, await users.setDefaultAddress(req.user!.id, req.params.id))));
router.delete('/me/addresses/:id', asyncHandler(async (req: Request, res: Response) => ok(res, await users.deleteAddress(req.user!.id, req.params.id))));

// ── Followed shops ──
router.get('/me/followed-shops', asyncHandler(async (req: Request, res: Response) => ok(res, await users.listFollowedShops(req.user!.id))));
router.post('/me/followed-shops/:shopId/toggle', asyncHandler(async (req: Request, res: Response) => ok(res, await users.toggleFollowShop(req.user!.id, req.params.shopId))));

export default router;
