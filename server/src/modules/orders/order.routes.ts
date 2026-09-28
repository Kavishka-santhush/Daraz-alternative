import { Request, Response } from 'express';
import { Router } from 'express';
import { requireAuth, requirePermission, requireRoles } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/http';
import { z } from 'zod';
import { UserRole, OrderStatus } from '@prisma/client';
import * as order from './order.service';
import * as fulfill from './order.fulfillment';

const router = Router();

const checkoutSchema = z.object({
  addressId: z.string().min(1),
  paymentMethod: z.enum(['CARD', 'WALLET', 'COD', 'INSTALLMENTS']),
  installmentPlan: z.enum(['MONTH_3', 'MONTH_6', 'MONTH_12']).optional(),
  vouchers: z.record(z.string()).optional(),
  useLoyalty: z.boolean().optional(),
  buyerNotes: z.string().max(500).optional(),
});

// ── Buyer ──
router.post('/checkout', requireAuth, validate(checkoutSchema), asyncHandler(async (req, res: Response) => created(res, await order.checkout(req.user!.id, req.body))));
router.get('/my', requireAuth, asyncHandler(async (req, res: Response) => {
  const data = await order.listBuyerOrders(req.user!.id, req);
  return ok(res, data.data, 200, data.meta);
}));
router.get('/my/:orderNumber', requireAuth, asyncHandler(async (req, res: Response) => ok(res, await order.getOrderForBuyer(req.user!.id, req.params.orderNumber))));
router.post('/:orderNumber/cancel', requireAuth, asyncHandler(async (req, res: Response) => ok(res, await order.cancelOrder(req.user!.id, req.params.orderNumber, req.body.reason))));

// ── Seller fulfillment ──
router.get('/seller', requireRoles(UserRole.SELLER), asyncHandler(async (req, res: Response) => {
  const data = await fulfill.listSellerOrders(req.user!.id, { query: req.query });
  return ok(res, data.data, 200, data.meta);
}));
router.post('/seller/:subId/confirm', requireRoles(UserRole.SELLER), asyncHandler(async (req, res: Response) => ok(res, await fulfill.confirmOrder(req.user!.id, req.params.subId, Number(req.body.estimatedDispatchHours ?? 24)))));
router.post('/seller/:subId/status', requireRoles(UserRole.SELLER), validate(z.object({ status: z.enum(['PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED']) })), asyncHandler(async (req, res: Response) => ok(res, await fulfill.advanceStatus(req.user!.id, req.params.subId, req.body.status, { trackingNumber: req.body.trackingNumber, courierName: req.body.courierName }))));
router.post('/seller/:subId/tracking', requireRoles(UserRole.SELLER), validate(z.object({ trackingNumber: z.string().min(1), courierName: z.string().min(1) })), asyncHandler(async (req, res: Response) => ok(res, await fulfill.addTracking(req.user!.id, req.params.subId, req.body.trackingNumber, req.body.courierName))));
router.post('/seller/:subId/cancel', requireRoles(UserRole.SELLER), asyncHandler(async (req, res: Response) => ok(res, await fulfill.sellerCancel(req.user!.id, req.params.subId, req.body.reason))));

// ── Admin order management ──
router.get('/admin', requireAuth, requirePermission('order:manage'), asyncHandler(async (req, res: Response) => {
  const { paginated } = await import('../../utils/pagination');
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const { prisma } = await import('../../config/prisma');
  const where: any = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.paymentStatus) where.paymentStatus = req.query.paymentStatus;
  const [items, total] = await prisma.$transaction([
    prisma.order.findMany({ where, include: { buyer: { select: { name: true, email: true } }, subOrders: { include: { shop: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.order.count({ where }),
  ]);
  const data = paginated(items, total, page, limit);
  return ok(res, data.data, 200, data.meta);
}));

export default router;
