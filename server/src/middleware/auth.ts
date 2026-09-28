import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import ApiError from '../utils/ApiError';
import { Permission, roleHasPermission } from '../config/permissions';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export interface AccessTokenPayload extends AuthUser {
  type: 'access';
}

export function signAccessToken(user: AuthUser): string {
  return jwt.sign({ ...user, type: 'access' }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpires as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
}

function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  // NextAuth/server-side calls may pass the token via cookie set by web app
  if (req.cookies?.access_token) return req.cookies.access_token;
  return undefined;
}

/** Require a valid access token. Populates req.user. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized();
    let payload: AccessTokenPayload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw ApiError.unauthorized('Invalid or expired token');
    }
    // Verify the account is still active on every request.
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, role: true, name: true, status: true },
    });
    if (!user) throw ApiError.unauthorized('Account no longer exists');
    if (user.status === 'SUSPENDED' || user.status === 'BANNED' || user.status === 'DELETED') {
      throw ApiError.forbidden('Account is not active');
    }
    req.user = { id: user.id, email: user.email, role: user.role, name: user.name };
    next();
  } catch (err) {
    next(err);
  }
}

/** Attaches req.user when a token is present but never rejects. For public endpoints. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.id, email: payload.email, role: payload.role, name: payload.name };
  } catch {
    /* ignore invalid token on optional routes */
  }
  next();
}

/** Require the user to hold one of the given roles. */
export function requireRoles(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };
}

/** Require the user to hold a permission (see permissions.ts). */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roleHasPermission(req.user.role, permission)) return next(ApiError.forbidden());
    next();
  };
}
