import bcrypt from 'bcryptjs';
import { User, UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import ApiError from '../../utils/ApiError';
import { signAccessToken, AuthUser } from '../../middleware/auth';
import { hashToken, randomToken, referenceNumber, shortCode, slugify, uniqueSlug } from '../../utils/nano';
import { templates } from '../../lib/email/templates';
import { sendMail } from '../../lib/email/mailer';
import { notify } from '../notifications/notification.service';
import logger from '../../config/logger';
import type { RegisterBuyerInput, RegisterSellerInput } from './auth.schema';

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ACCESS_TTL_MS = 15 * 60 * 1000;

interface DeviceContext {
  ip?: string;
  userAgent?: string;
  deviceId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

async function issueTokens(user: User, ctx: DeviceContext): Promise<AuthTokens> {
  const authUser: AuthUser = { id: user.id, email: user.email, role: user.role, name: user.name };
  const accessToken = signAccessToken(authUser);
  const refreshToken = randomToken(48);
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      deviceId: ctx.deviceId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_MS / 1000 };
}

function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl,
    emailVerified: !!user.emailVerifiedAt,
    phoneVerified: !!user.phoneVerifiedAt,
    referralCode: user.referralCode,
  };
}

async function logLogin(userId: string, ctx: DeviceContext, success: boolean, method = 'PASSWORD') {
  await prisma.loginActivity.create({
    data: { userId, ip: ctx.ip, userAgent: ctx.userAgent, deviceId: ctx.deviceId, success, method },
  });
}

async function ensureEmailAvailable(email: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw ApiError.conflict('An account with this email already exists');
}

async function sendVerification(user: User) {
  const token = randomToken(24);
  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hashToken(`verify:${user.id}:${token}`),
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  const link = `${env.webUrl}/verify-email?token=${token}&uid=${user.id}`;
  await sendMail({ to: user.email, subject: 'Verify your email', html: templates.verifyEmail(user.name, link) });
}

/** Buyer registration. Email verification required, but account is usable in PENDING state. */
export async function registerBuyer(input: RegisterBuyerInput, ctx: DeviceContext) {
  await ensureEmailAvailable(input.email);
  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: UserRole.BUYER,
      status: UserStatus.PENDING_VERIFICATION,
      referralCode: shortCode(8),
    },
  });

  await prisma.wallet.create({ data: { userId: user.id } });
  await ensurePrefs(user.id);
  // Signup bonus + (optional) pending referral link. Referral rewards themselves
  // unlock on the referee's first qualifying delivered order.
  import('../loyalty/loyalty.service').then((m) => m.awardSignupBonus(user.id)).catch(() => {});
  if (input.referralCode) {
    import('../referrals/referral.service').then((m) => m.attachReferral(user.id, input.referralCode!)).catch(() => {});
  }
  await sendVerification(user);
  await logLogin(user.id, ctx, true, 'REGISTER');

  const tokens = await issueTokens(user, ctx);
  return { user: publicUser(user), tokens };
}

/** Seller registration: creates user + pending seller profile + a starter shop. */
export async function registerSeller(input: RegisterSellerInput, ctx: DeviceContext) {
  await ensureEmailAvailable(input.email);
  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: UserRole.SELLER,
      status: UserStatus.PENDING_VERIFICATION,
      referralCode: shortCode(8),
    },
  });
  await prisma.wallet.create({ data: { userId: user.id } });
  await ensurePrefs(user.id);

  const seller = await prisma.sellerProfile.create({ data: { userId: user.id } });
  const slug = await uniqueSlug(slugify(input.shopName), async (s) => !!(await prisma.shop.findUnique({ where: { slug: s } })));
  await prisma.shop.create({
    data: { sellerId: seller.id, name: input.shopName, slug, description: input.shopDescription },
  });

  await sendVerification(user);
  await notifyAdminsNewSeller(user.name, input.shopName);
  await logLogin(user.id, ctx, true, 'REGISTER');

  const tokens = await issueTokens(user, ctx);
  return { user: publicUser(user), tokens };
}

async function notifyAdminsNewSeller(name: string, shopName: string) {
  const admins = await prisma.user.findMany({ where: { role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] } }, select: { id: true } });
  await Promise.all(
    admins.map((a) => notify({ userId: a.id, audience: 'ADMIN', type: 'NEW_SELLER_APPLICATION', title: 'New seller application', body: `${name} applied to sell (${shopName})`, actionUrl: '/admin/sellers' }))
  );
}

/** Staff (admin/manager/agent) login uses the same credentials flow, role is stored on the user. */
export async function login(email: string, password: string, ctx: DeviceContext) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    if (user) await logLogin(user.id, ctx, false);
    throw ApiError.unauthorized('Invalid email or password');
  }
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    await logLogin(user.id, ctx, false);
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (user.status === 'SUSPENDED' || user.status === 'BANNED') throw ApiError.forbidden('Account is not active');
  if (user.status === 'DELETED') throw ApiError.notFound();

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), deviceInfo: (ctx as any) ?? undefined } });
  await logLogin(user.id, ctx, true);
  const tokens = await issueTokens(user, ctx);
  return { user: publicUser(user), tokens };
}

/** Refresh-token rotation: old token is revoked and replaced. */
export async function refresh(refreshToken: string, ctx: DeviceContext) {
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) }, include: { user: true } });
  if (!record || record.revokedAt || record.expiresAt < new Date()) throw ApiError.unauthorized('Invalid refresh token');
  if (record.user.status !== 'ACTIVE' && record.user.status !== 'PENDING_VERIFICATION') throw ApiError.forbidden('Account is not active');

  const tokens = await issueTokens(record.user, ctx);
  await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
  return tokens;
}

export async function logout(refreshToken: string) {
  await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
  return { ok: true };
}

export async function verifyEmail(uid: string, token: string) {
  const hash = hashToken(`verify:${uid}:${token}`);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hash }, include: { user: { select: { status: true, sellerProfile: { select: { id: true } } } } } });
  if (!record || record.usedAt || record.expiresAt < new Date()) throw ApiError.badRequest('Verification link is invalid or expired');
  await prisma.$transaction([
    prisma.user.update({ where: { id: uid }, data: { emailVerifiedAt: new Date(), status: record.user.sellerProfile ? record.user.status : UserStatus.ACTIVE } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  return { ok: true };
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always return ok to avoid account enumeration.
  if (!user) return { ok: true };
  const token = randomToken(24);
  await prisma.passwordResetToken.create({
    data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });
  const link = `${env.webUrl}/reset-password?token=${token}`;
  await sendMail({ to: user.email, subject: 'Reset your password', html: templates.resetPassword(user.name, link) });
  return { ok: true };
}

export async function resetPassword(token: string, password: string) {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!record || record.usedAt || record.expiresAt < new Date()) throw ApiError.badRequest('Reset link is invalid or expired');
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  return { ok: true };
}

export async function requestOtp(phone: string) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  await prisma.otpCode.create({
    data: { phone, codeHash: hashToken(code), expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
  });
  // Mock in dev: log the code. In prod this would hit an SMS gateway.
  logger.info(`OTP for ${phone}: ${code}`);
  await sendMail({ to: phone, subject: 'Your verification code', html: templates.otp(phone, code) }).catch(() => {});
  return { ok: true, devCode: env.isProd ? undefined : code };
}

export async function verifyOtp(phone: string, code: string, userId: string) {
  const record = await prisma.otpCode.findFirst({
    where: { phone, verifiedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) throw ApiError.badRequest('No active code, request a new one');
  if (record.attempts >= 5) throw ApiError.tooMany('Too many attempts, request a new code');
  if (hashToken(code) !== record.codeHash) {
    await prisma.otpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    throw ApiError.badRequest('Incorrect code');
  }
  await prisma.$transaction([
    prisma.otpCode.update({ where: { id: record.id }, data: { verifiedAt: new Date() } }),
    prisma.user.update({ where: { id: userId }, data: { phoneVerifiedAt: new Date() } }),
  ]);
  return { ok: true };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash) throw ApiError.badRequest('Password not set for this account');
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw ApiError.unauthorized('Current password is incorrect');
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  return { ok: true };
}

async function ensurePrefs(userId: string) {
  const keys = ['ORDER_PLACED', 'ORDER_STATUS', 'RETURN_UPDATE', 'SELLER_NEW_ORDER', 'PAYOUT', 'PRICE_DROP', 'LOW_STOCK', 'REVIEW', 'PROMO'];
  await prisma.notificationPreference.createMany({
    data: keys.map((typeKey) => ({ userId, typeKey })),
    skipDuplicates: true,
  });
}

export async function listSessions(userId: string) {
  return prisma.refreshToken.findMany({
    where: { userId, revokedAt: null },
    select: { id: true, deviceId: true, ip: true, userAgent: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function revokeSession(userId: string, id: string) {
  await prisma.refreshToken.updateMany({ where: { id, userId }, data: { revokedAt: new Date() } });
  return { ok: true };
}

export { publicUser };
export { referenceNumber };
