import { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission, requireRoles } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/http';
import { uploader, withCategory } from '../../lib/upload';
import { UserRole } from '@prisma/client';
import * as ret from './return.service';

const router = Router();

const createReturnSchema = z.object({
  subOrderId: z.string().min(1),
  reason: z.string().min(3).max(300),
  description: z.string().max(2000).optional(),
  items: z
    .array(z.object({ orderItemId: z.string().min(1), quantity: z.number().int().positive() }))
    .min(1),
});

// ── Buyer ──
router.post('/', requireAuth, validate(createReturnSchema), asyncHandler(async (req: Request, res: Response) => created(res, await ret.createReturn(req.user!.id, req.body))));
router.get('/my', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const data = await ret.listBuyerReturns(req.user!.id, req);
  return ok(res, data.data, 200, data.meta);
}));
router.post('/:id/proof', requireAuth, withCategory('returns'), uploader(6).array('files', 6), asyncHandler(async (req: Request, res: Response) => {
  const files = (req.files ?? []) as Express.Multer.File[];
  if (!files.length) throw (await import('../../utils/ApiError')).default.badRequest('No files uploaded');
  let last: unknown;
  for (const f of files) last = await ret.addReturnProof(req.params.id, req.user!.id, f);
  return ok(res, last);
}));

// ── Seller ──
router.get('/seller', requireRoles(UserRole.SELLER), asyncHandler(async (req: Request, res: Response) => {
  const data = await ret.listReturns(req, { sellerUserId: req.user!.id });
  return ok(res, data.data, 200, data.meta);
}));
router.post('/:id/decision', requireRoles(UserRole.SELLER), validate(z.object({ decision: z.enum(['approve', 'reject']), note: z.string().max(1000).optional() })), asyncHandler(async (req: Request, res: Response) => ok(res, await ret.sellerDecision(req.user!.id, req.params.id, req.body.decision, req.body.note))));

// ── Admin / support ──
router.get('/', requireAuth, requirePermission('dispute:manage'), asyncHandler(async (req: Request, res: Response) => {
  const data = await ret.listReturns(req, { admin: true });
  return ok(res, data.data, 200, data.meta);
}));
router.post('/:id/refund', requireAuth, requirePermission('dispute:manage'), validate(z.object({ refundMethod: z.enum(['ORIGINAL', 'WALLET']).default('WALLET') })), asyncHandler(async (req: Request, res: Response) => ok(res, await ret.completeRefund(req.user!.id, req.params.id, req.body.refundMethod))));
router.post('/:id/dispute', requireAuth, requirePermission('dispute:manage'), validate(z.object({ note: z.string().min(3).max(2000) })), asyncHandler(async (req: Request, res: Response) => ok(res, await ret.openDispute(req.user!.id, req.params.id, req.body.note))));
router.post('/disputes/:disputeId/assign', requireAuth, requirePermission('dispute:manage'), validate(z.object({ agentId: z.string().min(1) })), asyncHandler(async (req: Request, res: Response) => ok(res, await ret.assignDispute(req.user!.id, req.params.disputeId, req.body.agentId))));
router.post('/disputes/:disputeId/resolve', requireAuth, requirePermission('dispute:manage'), validate(z.object({ resolution: z.string().min(3).max(2000) })), asyncHandler(async (req: Request, res: Response) => ok(res, await ret.resolveDispute(req.user!.id, req.params.disputeId, req.body.resolution))));

export default router;
