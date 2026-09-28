import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import ApiError from '../utils/ApiError';
import { env } from '../config/env';
import logger from '../config/logger';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const error = err;
  if (error instanceof ApiError) {
    return res.status(error.status).json({
      success: false,
      error: { code: error.code, message: error.message, details: error.details },
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = (error.meta?.target as string[] | string) ?? 'field';
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: `A record with this ${target} already exists` },
      });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Record not found' } });
    }
    if (error.code === 'P2003') {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid reference' } });
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid data supplied' } });
  }

  if ((error as { code?: string })?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: { code: 'FILE_TOO_LARGE', message: 'File exceeds size limit' } });
  }

  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, (error as Error)?.stack ?? error);
  const message = error instanceof Error ? error.message : 'Internal server error';
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: env.isProd ? 'Something went wrong' : message },
  });
}
