import { apiGet, type RequestOptions } from '@/lib/api';

/** Server Component data fetch with a safe fallback. Prevents a page crash when
 *  the backend is briefly unavailable during development; logs and returns the
 *  fallback instead of throwing. */
export async function safeApiGet<T>(path: string, fallback: T, opts?: RequestOptions): Promise<T> {
  try {
    return await apiGet<T>(path, opts);
  } catch (err) {
    console.error(`[safeApiGet] ${path} failed:`, err instanceof Error ? err.message : err);
    return fallback;
  }
}
