import { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission, requireRoles } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/http';
import { uploader, withCategory } from '../../lib/upload';
import { UserRole } from '@prisma/client';
import * as promo from './promo.service';

export const flashSaleRouter = Router();
export const bundleRouter = Router();
export const bannerRouter = Router();

const dateField = z.string().min(4);

// ══════════════════════════ FLASH SALES ══════════════════════════
flashSaleRouter.get('/', asyncHandler(async (req: Request, res: Response) => ok(res, await promo.listFlashSales())));
flashSaleRouter.get('/admin', requireAuth, requirePermission('promo:manage'), asyncHandler(async (req: Request, res: Response) => ok(res, await promo.listFlashSales(req, { staff: true }))));
flashSaleRouter.get('/:slug', asyncHandler(async (req: Request, res: Response) => ok(res, await promo.getFlashSaleBySlug(req.params.slug))));
flashSaleRouter.post('/', requireAuth, requirePermission('promo:manage'), validate(z.object({
  title: z.string().min(3).max(140),
  description: z.string().max(1000).optional(),
  bannerUrl: z.string().max(400).optional(),
  startsAt: dateField,
  endsAt: dateField,
})), asyncHandler(async (req: Request, res: Response) => created(res, await promo.createFlashSale(req.user!.id, req.body))));
flashSaleRouter.patch('/:id', requireAuth, requirePermission('promo:manage'), validate(z.object({
  title: z.string().min(3).max(140).optional(),
  description: z.string().max(1000).optional(),
  bannerUrl: z.string().max(400).optional(),
  startsAt: dateField.optional(),
  endsAt: dateField.optional(),
  isActive: z.boolean().optional(),
})), asyncHandler(async (req: Request, res: Response) => ok(res, await promo.updateFlashSale(req.user!.id, req.params.id, req.body))));
flashSaleRouter.post('/:id/items', requireAuth, requirePermission('promo:manage'), validate(z.object({
  items: z.array(z.object({ productId: z.string().min(1), salePrice: z.coerce.number().positive(), stockLimit: z.coerce.number().int().positive(), sortOrder: z.coerce.number().int().optional() })).min(1),
})), asyncHandler(async (req: Request, res: Response) => ok(res, await promo.addFlashSaleItems(req.user!.id, req.params.id, req.body.items))));
flashSaleRouter.delete('/items/:itemId', requireAuth, requirePermission('promo:manage'), asyncHandler(async (req: Request, res: Response) => ok(res, await promo.removeFlashSaleItem(req.user!.id, req.params.itemId))));

// ══════════════════════════ BUNDLE DEALS ══════════════════════════
bundleRouter.get('/', asyncHandler(async (req: Request, res: Response) => ok(res, await promo.listBundles({ shopId: req.query.shopId as string | undefined }))));
bundleRouter.get('/seller', requireRoles(UserRole.SELLER), asyncHandler(async (req: Request, res: Response) => {
  const shop = await (await import('../../config/prisma')).prisma.shop.findFirst({ where: { seller: { userId: req.user!.id } }, select: { id: true } });
  ok(res, shop ? await promo.listBundles({ shopId: shop.id, includeInactive: true }) : []);
}));
bundleRouter.post('/seller', requireRoles(UserRole.SELLER), validate(z.object({
  title: z.string().min(3).max(140),
  description: z.string().max(1000).optional(),
  dealType: z.enum(['MULTI_BUY', 'FIXED_PRICE', 'PERCENT_OFF']),
  buyQuantity: z.coerce.number().int().min(2).max(20).optional(),
  getConfigQty: z.coerce.number().int().min(1).max(20).optional(),
  discountPercent: z.coerce.number().min(1).max(90).optional(),
  fixedPrice: z.coerce.number().min(0).optional(),
  productIds: z.array(z.string()).min(2),
  startsAt: dateField.optional(),
  endsAt: dateField.optional(),
})), asyncHandler(async (req: Request, res: Response) => created(res, await promo.createBundle(req.user!.id, req.body))));
bundleRouter.patch('/:id/active', requireRoles(UserRole.SELLER), validate(z.object({ isActive: z.boolean() })), asyncHandler(async (req: Request, res: Response) => ok(res, await promo.setBundleActive(req.user!.id, req.params.id, req.body.isActive))));

// ══════════════════════════ BANNERS ══════════════════════════
bannerRouter.get('/', asyncHandler(async (req: Request, res: Response) => ok(res, await promo.listBanners(req))));
bannerRouter.get('/announcements', asyncHandler(async (req: Request, res: Response) => ok(res, await promo.activeAnnouncements())));
bannerRouter.get('/admin', requireAuth, requirePermission('banner:manage'), asyncHandler(async (req: Request, res: Response) => {
  const data = await promo.listBanners(req, { staff: true });
  return 'data' in data ? ok(res, data.data, 200, data.meta) : ok(res, data);
}));
bannerRouter.post('/upload', requireAuth, requirePermission('banner:manage'), withCategory('banners'), uploader(2).fields([{ name: 'image', maxCount: 1 }, { name: 'mobileImage', maxCount: 1 }]), asyncHandler(async (req: Request, res: Response) => {
  const { toPublicUrl } = await import('../../lib/upload');
  const fields = req.files as { [key: string]: Express.Multer.File[] } | undefined;
  if (!fields?.image?.length) throw (await import('../../utils/ApiError')).default.badRequest('An image is required');
  ok(res, { imageUrl: toPublicUrl(fields.image[0].path), mobileImageUrl: fields.mobileImage?.[0] ? toPublicUrl(fields.mobileImage[0].path) : undefined });
}));
bannerRouter.post('/', requireAuth, requirePermission('banner:manage'), validate(z.object({
  title: z.string().min(3).max(140),
  placement: z.string().min(2).max(60),
  imageUrl: z.string().min(1).max(400),
  mobileImageUrl: z.string().max(400).optional(),
  targetUrl: z.string().max(400).optional(),
  altText: z.string().max(200).optional(),
  sortOrder: z.coerce.number().int().optional(),
  startsAt: dateField.optional(),
  endsAt: dateField.optional(),
  isActive: z.boolean().optional(),
})), asyncHandler(async (req: Request, res: Response) => created(res, await promo.createBanner(req.user!.id, req.body))));
bannerRouter.patch('/:id', requireAuth, requirePermission('banner:manage'), validate(z.object({
  title: z.string().min(3).max(140).optional(),
  placement: z.string().min(2).max(60).optional(),
  imageUrl: z.string().min(1).max(400).optional(),
  mobileImageUrl: z.string().max(400).nullable().optional(),
  targetUrl: z.string().max(400).nullable().optional(),
  altText: z.string().max(200).nullable().optional(),
  sortOrder: z.coerce.number().int().optional(),
  startsAt: dateField.nullable().optional(),
  endsAt: dateField.nullable().optional(),
  isActive: z.boolean().optional(),
})), asyncHandler(async (req: Request, res: Response) => ok(res, await promo.updateBanner(req.user!.id, req.params.id, req.body))));
bannerRouter.delete('/:id', requireAuth, requirePermission('banner:manage'), asyncHandler(async (req: Request, res: Response) => ok(res, await promo.deleteBanner(req.user!.id, req.params.id))));

// ── Announcements (admin) ──
bannerRouter.post('/announcements', requireAuth, requirePermission('settings:manage'), validate(z.object({
  id: z.string().optional(),
  title: z.string().min(3).max(140),
  body: z.string().min(3).max(2000),
  placement: z.enum(['SITE_WIDE_BANNER', 'CHECKOUT_BANNER', 'CATEGORY_PAGE_BANNER', 'HOME_POPUP']).optional(),
  bgColor: z.string().max(20).optional(),
  textColor: z.string().max(20).optional(),
  ctaLabel: z.string().max(40).optional(),
  ctaUrl: z.string().max(400).optional(),
  isActive: z.boolean().optional(),
  startsAt: dateField.optional(),
  endsAt: dateField.optional(),
})), asyncHandler(async (req: Request, res: Response) => created(res, await promo.upsertAnnouncement(req.user!.id, req.body))));
bannerRouter.delete('/announcements/:id', requireAuth, requirePermission('settings:manage'), asyncHandler(async (req: Request, res: Response) => ok(res, await promo.deleteAnnouncement(req.user!.id, req.params.id))));
