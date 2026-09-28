import { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth, requireAuth, requireRoles } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/http';
import { UserRole } from '@prisma/client';
import * as bot from './chatbot.service';

const router = Router();

// ── Shopper assistant (works for guests and signed-in buyers) ──
router.post('/chat', optionalAuth, validate(z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().optional(),
  productId: z.string().optional(),
  guestId: z.string().max(64).optional(),
})), asyncHandler(async (req: Request, res: Response) => ok(res, await bot.askChatbot({ ...req.body, userId: req.user?.id }))));

router.get('/chat/sessions', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const data = await bot.listSessions(req.user!.id, req);
  return ok(res, data.data, 200, data.meta);
}));
router.get('/chat/sessions/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => ok(res, await bot.getSession(req.user!.id, req.params.id))));
router.post('/chat/sessions/:id/rate', requireAuth, validate(z.object({ rating: z.number().int().min(1).max(5) })), asyncHandler(async (req: Request, res: Response) => ok(res, await bot.rateSession(req.user!.id, req.params.id, req.body.rating))));

// ── Seller copy tools ──
router.post('/tools/product-copy', requireRoles(UserRole.SELLER), validate(z.object({
  title: z.string().min(3).max(200),
  features: z.string().max(4000).optional(),
  category: z.string().max(120).optional(),
  tone: z.enum(['clear and benefit-led', 'premium', 'friendly', 'technical']).optional(),
})), asyncHandler(async (req: Request, res: Response) => ok(res, await bot.generateProductCopy(req.user!.id, req.body))));

router.post('/tools/review-reply', requireRoles(UserRole.SELLER), validate(z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().max(4000).optional(),
  tone: z.enum(['warm', 'formal', 'concise']).optional(),
})), asyncHandler(async (req: Request, res: Response) => ok(res, await bot.generateReviewReply(req.user!.id, req.body))));

// ── Support agent tools ──
router.post('/tools/support-reply', requireRoles(UserRole.SUPPORT_AGENT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OPERATIONS_MANAGER), validate(z.object({
  ticketSummary: z.string().min(3).max(1000),
  notes: z.string().min(3).max(4000),
})), asyncHandler(async (req: Request, res: Response) => ok(res, await bot.draftSupportReply(req.user!.id, req.body))));

export default router;
