import { Request, Response } from 'express';
import { Router } from 'express';
import { requireAuth, requirePermission, requireRoles } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/http';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { constructWebhookEvent } from '../../lib/stripe';
import logger from '../../config/logger';
import * as pay from './payment.service';
import * as payout from './payout.service';

const router = Router();

// ── Buyer wallet & payments ──
router.get('/wallet', requireAuth, asyncHandler(async (req, res: Response) => ok(res, await pay.getWallet(req.user!.id))));
router.post('/wallet/topup', requireAuth, validate(z.object({ amount: z.coerce.number().positive() })), asyncHandler(async (req, res: Response) => ok(res, await pay.topupWallet(req.user!.id, req.body.amount))));
router.get('/transactions', requireAuth, asyncHandler(async (req, res: Response) => ok(res, await pay.listTransactions(req.user!.id))));

// ── Seller earnings & payouts ──
router.get('/seller/earnings', requireRoles(UserRole.SELLER), asyncHandler(async (req, res: Response) => ok(res, await payout.getEarnings(req.user!.id))));
router.post('/seller/bank', requireRoles(UserRole.SELLER), validate(z.object({ bankName: z.string().min(2), bankAccountNo: z.string().min(4), bankBranch: z.string().optional(), accountHolder: z.string().min(2) })), asyncHandler(async (req, res: Response) => ok(res, await payout.savePayoutBank(req.user!.id, req.body))));
router.post('/seller/payout', requireRoles(UserRole.SELLER), validate(z.object({ amount: z.coerce.number().positive() })), asyncHandler(async (req, res: Response) => ok(res, await payout.requestPayout(req.user!.id, req.body.amount))));

// ── Finance management ──
router.get('/payouts', requireAuth, requirePermission('seller:payout'), asyncHandler(async (req, res: Response) => {
  const data = await payout.listPayoutRequests(req);
  return ok(res, data.data, 200, data.meta);
}));
router.post('/payouts/:id/review', requireAuth, requirePermission('seller:payout'), asyncHandler(async (req, res: Response) => ok(res, await payout.reviewPayout(req.user!.id, req.params.id, req.body.decision, req.body.note))));
router.post('/payouts/:id/process', requireAuth, requirePermission('seller:payout'), asyncHandler(async (req, res: Response) => ok(res, await payout.processPayout(req.user!.id, req.params.id))));
router.get('/installments', requireAuth, requirePermission('finance:report'), asyncHandler(async (req, res: Response) => {
  const data = await payout.activeInstallmentPlans(req);
  return ok(res, data.data, 200, data.meta);
}));

export default router;

/** Stripe webhook — mounted with a raw body parser in app.ts. */
export const stripeWebhook = asyncHandler(async (req: Request, res: Response) => {
  let event;
  try {
    event = constructWebhookEvent(req.body, req.headers['stripe-signature'] as string);
  } catch (err) {
    logger.warn('Stripe signature verification failed', (err as Error).message);
    return res.status(400).send('Invalid signature');
  }
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object as any;
      if (intent.metadata?.type === 'wallet_topup') await pay.confirmTopup(intent.id);
      else await pay.confirmPaymentByIntent(intent.id);
      break;
    }
    case 'payment_intent.payment_failed': {
      const intent = event.data.object as any;
      await pay.markPaymentFailed(intent.id, intent.last_payment_error?.message ?? 'Payment failed');
      break;
    }
    case 'charge.refunded': {
      logger.info('Stripe charge refunded', event.data.object?.id);
      break;
    }
    default:
      break;
  }
  return res.json({ received: true });
});
