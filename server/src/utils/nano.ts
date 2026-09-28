import crypto from 'crypto';

/** URL-safe slug from arbitrary text. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

/** Ensures a unique slug by appending a numeric suffix if needed. */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  let slug = slugify(base);
  let i = 1;
  while (await exists(slug)) {
    slug = `${slugify(base)}-${++i}`;
  }
  return slug;
}

/** Human-friendly, non-sequential order/reference numbers. */
export function referenceNumber(prefix: string): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const rand = crypto.randomInt(100000, 999999).toString();
  return `${prefix}${y}${m}${rand}`;
}

/** Short public code for vouchers/referrals. */
export function shortCode(len = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function sixDigitOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}
