import { Request, Response } from 'express';
import { Router } from 'express';
import { requireAuth, optionalAuth, requirePermission, requireRoles } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/http';
import { UserRole } from '@prisma/client';
import * as product from './product.service';
import * as media from './product.media';
import * as inventory from './inventory.service';
import * as s from './product.schema';

const router = Router();

// ── Public catalog ──
router.get('/', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  const data = await product.listProducts(req.query);
  return ok(res, data.data, 200, data.meta);
}));

router.get('/pending-review', requireAuth, requirePermission('product:moderate'), asyncHandler(async (req, res: Response) => {
  const data = await product.pendingReviewQueue(req.query);
  return ok(res, data.data, 200, data.meta);
}));

router.get('/:idOrSlug', optionalAuth, asyncHandler(async (req, res: Response) => ok(res, await product.getProduct(req.params.idOrSlug, req.user?.id))));

// ── Seller product management ──
router.get('/seller/list', requireRoles(UserRole.SELLER), asyncHandler(async (req, res: Response) => {
  const data = await product.sellerProducts(req.user!.id, { query: req.query });
  return ok(res, data.data, 200, data.meta);
}));

router.post('/', requireRoles(UserRole.SELLER), validate(s.createProductSchema), asyncHandler(async (req, res: Response) => created(res, await product.createProduct(req.user!.id, req.body))));
router.patch('/:id', requireRoles(UserRole.SELLER), validate(s.updateProductSchema), asyncHandler(async (req, res: Response) => ok(res, await product.updateProduct(req.user!.id, req.params.id, req.body))));
router.delete('/:id', requireRoles(UserRole.SELLER), asyncHandler(async (req, res: Response) => ok(res, await product.archiveProduct(req.user!.id, req.params.id))));
router.post('/:id/duplicate', requireRoles(UserRole.SELLER), asyncHandler(async (req, res: Response) => created(res, await product.duplicateProduct(req.user!.id, req.params.id))));

// images
router.post('/:id/images', requireRoles(UserRole.SELLER), media.productImageMiddleware, asyncHandler(async (req, res: Response) => created(res, await media.addProductImages(req.user!.id, req.params.id, (req as any).files ?? []))));
router.delete('/images/:imageId', requireRoles(UserRole.SELLER), asyncHandler(async (req, res: Response) => ok(res, await media.deleteProductImage(req.user!.id, req.params.imageId))));
router.post('/images/:imageId/primary', requireRoles(UserRole.SELLER), asyncHandler(async (req, res: Response) => ok(res, await media.setPrimaryImage(req.user!.id, req.params.imageId))));

// inventory
router.post('/:id/restock', requireRoles(UserRole.SELLER), validate(zNum('quantity')), asyncHandler(async (req, res: Response) => ok(res, { stock: await inventory.restock(req.user!.id, req.params.id, Number(req.body.quantity), req.body.warehouseId) })));
router.post('/:id/set-stock', requireRoles(UserRole.SELLER), validate(zNum('quantity')), asyncHandler(async (req, res: Response) => ok(res, { stock: await inventory.setStock(req.user!.id, req.params.id, Number(req.body.quantity)) })));
router.get('/:id/stock-history', requireRoles(UserRole.SELLER), asyncHandler(async (req, res: Response) => ok(res, await inventory.stockHistory(req.params.id))));
router.post('/bulk-stock', requireRoles(UserRole.SELLER), validate(s.bulkStockSchema), asyncHandler(async (req, res: Response) => ok(res, await inventory.bulkUpdateStock(req.user!.id, req.body.items))));

// warehouses
router.get('/meta/warehouses', requireRoles(UserRole.SELLER), asyncHandler(async (req, res: Response) => ok(res, await inventory.listWarehouses(req.user!.id))));
router.post('/meta/warehouses', requireRoles(UserRole.SELLER), asyncHandler(async (req, res: Response) => created(res, await inventory.createWarehouse(req.user!.id, req.body))));
router.delete('/meta/warehouses/:id', requireRoles(UserRole.SELLER), asyncHandler(async (req, res: Response) => ok(res, await inventory.deleteWarehouse(req.user!.id, req.params.id))));

// CSV import
router.post('/import/csv', requireRoles(UserRole.SELLER), media.productImageMiddleware, asyncHandler(async (req, res: Response) => {
  const file = (req as any).files?.[0];
  if (!file) return ok(res, { error: 'No CSV file uploaded' });
  const text = file.buffer.toString('utf-8');
  return ok(res, await media.importProductsCsv(req.user!.id, text));
}));

// ── Customer Q&A ──
router.post('/:id/questions', requireAuth, asyncHandler(async (req, res: Response) => created(res, await media.askQuestion(req.user!.id, req.params.id, req.body.body))));
router.post('/questions/:qaId/answer', requireRoles(UserRole.SELLER), asyncHandler(async (req, res: Response) => ok(res, await media.answerQuestion(req.user!.id, req.params.qaId, req.body.answer))));

// ── Admin moderation ──
router.post('/:id/moderate', requireAuth, requirePermission('product:moderate'), asyncHandler(async (req, res: Response) => ok(res, await product.moderateProduct(req.user!.id, req.params.id, req.body.action, req.body.reason))));

function zNum(field: string) {
  // tiny inline schema helper to avoid importing zod in every route file
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { z } = require('zod');
  return z.object({ [field]: z.coerce.number().int().nonnegative() }).passthrough();
}

export default router;
