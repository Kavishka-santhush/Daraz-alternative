import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Dedicated Prisma client for seeding.
 * Kept separate from the app client so seeds do not depend on env parsing /
 * logging configuration.
 */
export const prisma = new PrismaClient({ log: ['warn', 'error'] });

/** Demo password used across all seeded accounts. */
export const DEMO_PASSWORD = 'Passw0rd!';

export async function hashPassword(plain: string = DEMO_PASSWORD): Promise<string> {
  return bcrypt.hash(plain, 12);
}

/** Pretty section logging. */
export function section(name: string) {
  console.log(`\n──────── ${name} ────────`);
}

export function info(msg: string) {
  console.log(`  • ${msg}`);
}

/** Idempotent date helper: N days from now (negative = past). */
export function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export async function disconnect() {
  await prisma.$disconnect();
}
