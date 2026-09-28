import http from 'http';
import fs from 'fs';
import { env } from './config/env';
import logger from './config/logger';
import { createApp } from './app';
import { initSocket } from './lib/socket';
import { startJobs, stopJobs } from './jobs/scheduler';
import { prisma } from './config/prisma';
import { UPLOAD_ROOT } from './lib/upload';

function ensureUploadDir() {
  try {
    if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  } catch (err) {
    logger.warn('Could not create upload directory', (err as Error).message);
  }
}

async function main() {
  ensureUploadDir();
  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);
  startJobs();

  server.listen(env.port, () => {
    logger.info(`Marketplace API listening on ${env.apiUrl} (env=${env.nodeEnv})`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    stopJobs();
    server.close(async () => {
      try {
        await prisma.$disconnect();
      } catch (err) {
        logger.error('Error during Prisma disconnect', (err as Error).message);
      }
      process.exit(0);
    });
    // force-exit if connections linger
    setTimeout(() => process.exit(1), 10_000).unref?.();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection', reason as any));
  process.on('uncaughtException', (err) => logger.error('Uncaught exception', err.stack ?? err.message));
}

main().catch((err) => {
  logger.error('Fatal startup error', err?.stack ?? String(err));
  process.exit(1);
});
