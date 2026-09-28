import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/http';
import { prisma } from '../../config/prisma';
import * as svc from './auth.service';

interface DeviceContext {
  ip?: string;
  userAgent?: string;
  deviceId?: string;
}

function ctx(req: Request): DeviceContext {
  return {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    deviceId: (req.headers['x-device-id'] as string) || undefined,
  };
}

export const registerBuyer = asyncHandler(async (req: Request, res: Response) => {
  return created(res, await svc.registerBuyer(req.body, ctx(req)));
});

export const registerSeller = asyncHandler(async (req: Request, res: Response) => {
  return created(res, await svc.registerSeller(req.body, ctx(req)));
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  return ok(res, await svc.login(email, password, ctx(req)));
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  return ok(res, await svc.refresh(req.body.refreshToken, ctx(req)));
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await svc.logout(req.body.refreshToken);
  return ok(res, { loggedOut: true });
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const uid = req.body.uid ?? (req.query.uid as string);
  await svc.verifyEmail(uid, req.body.token);
  return ok(res, { verified: true });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  await svc.forgotPassword(req.body.email);
  return ok(res, { ok: true });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  await svc.resetPassword(req.body.token, req.body.password);
  return ok(res, { ok: true });
});

export const requestOtp = asyncHandler(async (req: Request, res: Response) => {
  return ok(res, await svc.requestOtp(req.body.phone));
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  await svc.verifyOtp(req.body.phone, req.body.code, req.user!.id);
  return ok(res, { verified: true });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  await svc.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
  return ok(res, { ok: true });
});

export const sessions = asyncHandler(async (req: Request, res: Response) => ok(res, await svc.listSessions(req.user!.id)));

export const revokeSession = asyncHandler(async (req: Request, res: Response) => {
  await svc.revokeSession(req.user!.id, req.params.id);
  return ok(res, { revoked: true });
});

/** Returns the currently authenticated user (used by NextAuth session hydration). */
export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true, email: true, name: true, phone: true, role: true, avatarUrl: true,
      status: true, emailVerifiedAt: true, phoneVerifiedAt: true, referralCode: true,
      loyaltyPoints: true, coins: true,
      sellerProfile: { select: { id: true, status: true, tier: true, isVerified: true } },
    },
  });
  return ok(res, user);
});
