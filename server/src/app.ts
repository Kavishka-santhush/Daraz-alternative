import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import logger from './config/logger';
import api from './routes';
import { apiLimiter } from './middleware/rateLimit';
import { notFoundHandler, errorHandler } from './middleware/error';
import { stripeWebhook } from './modules/payments/payment.routes';
import { UPLOAD_ROOT } from './lib/upload';
import { prisma } from './config/prisma';

/** Lightweight cached maintenance flag (refreshed every 30s) to avoid a DB hit per request. */
let maintenanceCache = { value: false, checkedAt: 0 };
async function isMaintenance(): Promise<boolean> {
  const now = Date.now();
  if (now - maintenanceCache.checkedAt > 30_000) {
    try {
      const s = await prisma.settings.findUnique({ where: { id: 'platform' }, select: { maintenanceMode: true } });
      maintenanceCache = { value: !!s?.maintenanceMode, checkedAt: now };
    } catch {
      maintenanceCache = { value: false, checkedAt: now };
    }
  }
  return maintenanceCache.value;
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: [env.webUrl, env.apiUrl], credentials: true }));
  app.use(compression());

  // Stripe webhook needs the *raw* request body for signature verification, so it
  // is registered before the JSON body parser.
  app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.debug(`${req.method} ${req.originalUrl}`);
    next();
  });

  // Locally stored uploads (Multer disk storage).
  app.use('/uploads', express.static(UPLOAD_ROOT, { maxAge: '7d', fallthrough: true }));

  app.get('/', (_req: Request, res: Response) => res.json({ success: true, data: { name: 'Marketplace API', health: '/api/health' } }));

  // Maintenance gate: auth + health stay reachable so users can still log in / ops can probe.
  app.use('/api', async (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/auth') || req.path.startsWith('/health')) return next();
    if (await isMaintenance()) {
      return res.status(503).json({ success: false, error: { code: 'MAINTENANCE', message: 'The platform is temporarily under maintenance. Please check back soon.' } });
    }
    next();
  });

  app.use('/api', apiLimiter, api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
