import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { env } from './env';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Rs 1,299.00 style currency formatting (locale-aware, cached formatter). */
export function formatMoney(amount: number | string | null | undefined, opts?: { compact?: boolean; decimals?: boolean }): string {
  const n = typeof amount === 'string' ? Number(amount) : amount ?? 0;
  if (Number.isNaN(n)) return `${env.currency_symbol} 0`;
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: env.currency,
    currencyDisplay: 'narrowSymbol',
    notation: opts?.compact ? 'compact' : 'standard',
    minimumFractionDigits: opts?.decimals === false ? 0 : 2,
    maximumFractionDigits: opts?.decimals === false ? 0 : 2,
  })
    .format(n)
    .replace(/^[A-Za-z]{1,3}\s?/, env.currency_symbol + ' ');
}

export function formatDate(input: string | number | Date | null | undefined, withTime = false): string {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function timeAgo(input: string | number | Date): string {
  const d = new Date(input).getTime();
  const secs = Math.round((Date.now() - d) / 1000);
  if (Number.isNaN(secs)) return '';
  const table: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, secsPer] of table) {
    if (Math.abs(secs) >= secsPer) return rtf.format(-Math.round(secs / secsPer), unit);
  }
  return 'just now';
}

export function initials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function truncate(text: string, max = 120): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function pluralize(count: number, one: string, many?: string): string {
  return count === 1 ? one : many ?? `${one}s`;
}

export function classNamesForStatus(status: string): string {
  const s = status.toUpperCase();
  if (['DELIVERED', 'ACTIVE', 'APPROVED', 'SUCCEEDED', 'PAID', 'RESOLVED', 'COMPLETED'].includes(s))
    return 'bg-green-100 text-green-700 border-green-200';
  if (['PENDING', 'PENDING_APPROVAL', 'PROCESSING', 'REQUESTED', 'CONFIRMED', 'SCHEDULED', 'OPEN'].includes(s))
    return 'bg-amber-100 text-amber-700 border-amber-200';
  if (['CANCELLED', 'REJECTED', 'FAILED', 'BANNED', 'SUSPENDED', 'EXPIRED', 'OVERDUE', 'FLAGGED'].includes(s))
    return 'bg-red-100 text-red-700 border-red-200';
  if (['SHIPPED', 'OUT_FOR_DELIVERY', 'IN_PROGRESS'].includes(s))
    return 'bg-blue-100 text-blue-700 border-blue-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

/** Read a nested decimal (Prisma Decimal serialised as string) as a number. */
export function num(value: unknown): number {
  const n = typeof value === 'string' ? parseFloat(value) : (value as number);
  return Number.isFinite(n) ? n : 0;
}

export function discountPercent(original?: number | string | null, sale?: number | string | null): number {
  const o = num(original);
  const s = num(sale);
  if (!o || !s || s >= o) return 0;
  return Math.round(((o - s) / o) * 100);
}

/** Build a querystring from an object, skipping empty values. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Sleep helper for optimistic UI / retry backoff. */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
