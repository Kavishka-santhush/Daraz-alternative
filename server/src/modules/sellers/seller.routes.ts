import { Request, Response } from 'express';
import { Router } from 'express';
import { requireAuth, requirePermission, requireRoles } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/http';
import { UserRole } from '@prisma/client';
import { uploader, withCategory } from '../../lib/upload';
import * as svc from './seller.service';

const router = Router();
const docUpload = [withCategory('seller-docs'), uploader(1).single('document')];
const brandUpload = [withCategory('shops'), uploader(1).single('image')];

// ── Seller self-service ──
router.get('/me', requireRoles(UserRole.SELLER), asyncHandler(async (req, res: Response) => ok(res, await svc.getMySellerDashboard(req.user!.id))));
router.get('/me/metrics', requireRoles(UserRole.SELLER), asyncHandler(async (req, res: Response) => ok(res, await svc.sellerMetrics(req.user!.id))));
router.get('/me/shops', requireRoles(UserRole.SELLER), asyncHandler(async (req, res: Response) => ok(res, await svc.listShops(req.user!.id))));
router.post('/me/shops', requireRoles(UserRole.SELLER), asyncHandler(async (req, res: Response) => created(res, await svc.createShop(req.user!.id, req.body))));
router.patch('/me/shops/:shopId', requireRoles(UserRole.SELLER), asyncHandler(async (req, res: Response) => ok(res, await svc.updateShop(req.user!.id, req.params.shopId, req.body))));
router.post('/me/shops/:shopId/logo', requireRoles(UserRole.SELLER), brandUpload, asyncHandler(async (req, res: Response) => ok(res, await svc.uploadShopBrand(req.user!.id, req.params.shopId, (req as any).file, 'logo'))));
router.post('/me/shops/:shopId/cover', requireRoles(UserRole.SELLER), brandUpload, asyncHandler(async (req, res: Response) => ok(res, await svc.uploadShopBrand(req.user!.id, req.params.shopId, (req as any).file, 'cover'))));
router.post('/me/documents', requireRoles(UserRole.SELLER), docUpload, asyncHandler(async (req, res: Response) => created(res, await svc.uploadDocument(req.user!.id, req.body, (req as any).file))));

// ── Public shop pages ──
router.get('/shops', asyncHandler(async (req, res: Response) => {
  const data = await svc.listPublicShops(req);
  return ok(res, data.data, 200, data.meta);
}));
router.get('/shops/:slug', asyncHandler(async (req, res: Response) => ok(res, await svc.getPublicShop(req.params.slug))));
router.get('/shops/:slug/products', asyncHandler(async (req, res: Response) => {
  const data = await svc.getShopProducts(req.params.slug, req);
  return ok(res, data.data, 200, data.meta);
}));
router.post('/shops/:shopId/follow', requireAuth, asyncHandler(async (req, res: Response) => ok(res, await svc.followShop(req.user!.id, req.params.shopId, req.body.follow ?? true))));

// ── Admin management ──
router.get('/applications', requireAuth, requirePermission('seller:approve'), asyncHandler(async (req, res: Response) => {
  const data = await svc.listSellerApplications(req);
  return ok(res, data.data, 200, data.meta);
}));
router.post('/:sellerId/review', requireAuth, requirePermission('seller:approve'), asyncHandler(async (req, res: Response) => ok(res, await svc.reviewSeller(req.user!.id, req.params.sellerId, req.body.decision, req.body.reason))));
router.post('/:sellerId/verify', requireAuth, requirePermission('seller:manage'), asyncHandler(async (req, res: Response) => ok(res, await svc.setSellerVerified(req.user!.id, req.params.sellerId, req.body.verified ?? true))));
router.post('/:sellerId/tier', requireAuth, requirePermission('seller:manage'), asyncHandler(async (req, res: Response) => ok(res, await svc.setSellerTier(req.user!.id, req.params.sellerId, req.body.tier))));
router.post('/:sellerId/suspend', requireAuth, requirePermission('seller:manage'), asyncHandler(async (req, res: Response) => ok(res, await svc.suspendSeller(req.user!.id, req.params.sellerId, req.body.suspend ?? true, req.body.reason))));

export default router;
