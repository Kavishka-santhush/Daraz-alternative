import { PrismaClient } from '@prisma/client';
import { env } from './env';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProd ? ['error', 'warn'] : ['query', 'error', 'warn'],
  });

if (!env.isProd) globalForPrisma.prisma = prisma;

export default prisma;
