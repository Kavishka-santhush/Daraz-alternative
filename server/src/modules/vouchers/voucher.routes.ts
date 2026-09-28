import { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission, requireRoles } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/http';
import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';
import { UserRole } from '@prisma/client';
import * as voucher from './voucher.service';

const router = Router();

const voucherBody = z.object({
  code: z.string().regex(/^[A-Za-z0-9-_]{3,25}$/).optional(),
  name: z.string().min(3).max(120),
  description: z.string().max(500).optional(),
  type: z.enum(['PERCENT', 'FIXED', 'FREE_SHIPPING']),
  percentOff: z.coerce.number().min(0).max(100).optional(),
  fixedOff: z.coerce.number().min(0).optional(),
  maxDiscount: z.coerce.number().min(0).optional(),
  minOrderAmount: z.coerce.number().min(0).optional(),
  categoryIds: z.array(z.string()).optional(),
  productIds: z.array(z.string()).optional(),
  newBuyersOnly: z.boolean().optional(),
  oneTimePerUser: z.boolean().optional(),
  usageLimit: z.coerce.number().int().positive().optional(),
  startsAt: z.string().datetime({ offset: true }).or(z.string().min(4)),
  expiresAt: z.string().datetime({ offset: true }).or(z.string().min(4)),
  targetUrl: z.string().max(300).optional(),
});

// ── Public ──
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const data = await voucher.listVouchers(req, {});
  return ok(res, data.data, 200, data.meta);
}));

// ── Buyer validation (needs a cart context) ──
router.post('/validate', requireAuth, validate(z.object({
  code: z.string().min(3).max(25),
  shopId: z.string().optional(),
  groupSubtotal: z.coerce.number().min(0),
  categoryIds: z.array(z.string()).default([]),
  productIds: z.array(z.string()).default([]),
})), asyncHandler(async (req: Request, res: Response) => {
  const { evaluateVoucher } = await import('../orders/order.pricing');
  const ctx = {
    buyerId: req.user!.id,
    shopId: req.body.shopId ?? '',
    sellerId: req.body.shopId ? (await prisma.shop.findUnique({ where: { id: req.body.shopId }, select: { sellerId: true } }))?.sellerId ?? '' : '',
    groupSubtotal: req.body.groupSubtotal,
    categoryIds: req.body.categoryIds,
    productIds: req.body.productIds,
  };
  ok(res, await evaluateVoucher(req.body.code, ctx));
}));

// ── Seller vouchers ──
router.get('/seller', requireRoles(UserRole.SELLER), asyncHandler(async (req: Request, res: Response) => {
  const profile = await prisma.sellerProfile.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
  if (!profile) throw ApiError.forbidden('Approved seller account required');
  const data = await voucher.listVouchers(req, { ownerId: profile.id });
  return ok(res, data.data, 200, data.meta);
}));
router.post('/seller', requireRoles(UserRole.SELLER), validate(voucherBody), asyncHandler(async (req: Request, res: Response) => created(res, await voucher.createSellerVoucher(req.user!.id, req.body))));

// ── Admin / promo management ──
router.get('/admin', requireAuth, requirePermission('promo:manage'), asyncHandler(async (req: Request, res: Response) => {
  const data = await voucher.listVouchers(req, { staff: true });
  return ok(res, data.data, 200, data.meta);
}));
router.post('/admin', requireAuth, requirePermission('promo:manage'), validate(voucherBody), asyncHandler(async (req: Request, res: Response) => created(res, await voucher.createPlatformVoucher(req.user!.id, req.body))));
router.patch('/admin/:id', requireAuth, requirePermission('promo:manage'), validate(voucherBody.partial()), asyncHandler(async (req: Request, res: Response) => ok(res, await voucher.updateVoucher(req.user!.id, req.params.id, req.body))));
router.post('/admin/:id/status', requireAuth, requirePermission('promo:manage'), validate(z.object({ status: z.enum(['ACTIVE', 'SCHEDULED', 'EXPIRED', 'DEACTIVATED']) })), asyncHandler(async (req: Request, res: Response) => ok(res, await voucher.updateVoucherStatus(req.user!.id, req.params.id, req.body.status))));
router.delete('/admin/:id', requireAuth, requirePermission('promo:manage'), asyncHandler(async (req: Request, res: Response) => ok(res, await voucher.deleteVoucher(req.user!.id, req.params.id))));
router.get('/admin/:id/report', requireAuth, requirePermission('promo:manage'), asyncHandler(async (req: Request, res: Response) => ok(res, await voucher.voucherReport(req.user!.id, req.params.id))));

export default router;
