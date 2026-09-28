import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate, cuid } from '../../middleware/validate';
import { authLimiter } from '../../middleware/rateLimit';
import * as c from './auth.controller';
import * as s from './auth.schema';

const router = Router();

// Public
router.post('/register/buyer', authLimiter, validate(s.registerBuyerSchema), c.registerBuyer);
router.post('/register/seller', authLimiter, validate(s.registerSellerSchema), c.registerSeller);
router.post('/login', authLimiter, validate(s.loginSchema), c.login);
router.post('/refresh', authLimiter, validate(s.refreshSchema), c.refresh);
router.post('/logout', c.logout);
router.post('/verify-email', validate(s.verifyEmailSchema.extend({ uid: cuid })), c.verifyEmail);
router.post('/forgot-password', authLimiter, validate(s.forgotPasswordSchema), c.forgotPassword);
router.post('/reset-password', authLimiter, validate(s.resetPasswordSchema), c.resetPassword);
router.post('/otp/request', authLimiter, validate(s.requestOtpSchema), c.requestOtp);

// Protected
router.get('/me', requireAuth, c.me);
router.post('/otp/verify', requireAuth, validate(s.verifyOtpSchema), c.verifyOtp);
router.post('/change-password', requireAuth, validate(s.changePasswordSchema), c.changePassword);
router.get('/sessions', requireAuth, c.sessions);
router.delete('/sessions/:id', requireAuth, c.revokeSession);

export default router;
