import { env } from './env';
import type { ApiEnvelope } from '@/types';

const API_BASE = `${env.api_url}/api`;

export class ApiClientError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/* ── Access-token resolution ───────────────────────────────── */

// Browser-side token cache, kept in sync by <AuthSync/> (session → memory +
// sessionStorage so a hard refresh still has it before the session loads).
let clientToken: string | null = null;

export function setClientToken(token: string | null) {
  clientToken = token;
  if (typeof window !== 'undefined') {
    try {
      if (token) sessionStorage.setItem('access_token', token);
      else sessionStorage.removeItem('access_token');
    } catch {
      /* storage disabled */
    }
  }
}

export function getClientToken(): string | null {
  if (typeof window === 'undefined') return clientToken;
  if (clientToken) return clientToken;
  try {
    clientToken = sessionStorage.getItem('access_token');
  } catch {
    clientToken = null;
  }
  return clientToken;
}

async function serverToken(): Promise<string | null> {
  try {
    const { getToken } = await import('next-auth/jwt');
    const token = await getToken();
    return (token?.accessToken as string) ?? null;
  } catch {
    return null;
  }
}

/* ── Core request helper ───────────────────────────────────── */

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Plain object serialised as JSON (unless `body` is FormData). */
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Provide an explicit token (e.g. from getServerSession in a page). */
  token?: string | null;
  /** Next.js data-cache revalidation tag(s) for server fetches. */
  next?: { revalidate?: number; tags?: string[] };
  cache?: RequestCache;
}

async function resolveToken(explicit?: string | null): Promise<string | null> {
  if (explicit !== undefined) return explicit;
  if (typeof window !== 'undefined') return getClientToken();
  return serverToken();
}

export async function request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const { body, query, token: explicitToken, headers, ...rest } = opts;

  const url = new URL(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
  }

  const token = await resolveToken(explicitToken);
  const isForm = body instanceof FormData;

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string>),
  };
  if (!isForm && body !== undefined) finalHeaders['Content-Type'] = 'application/json';
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      ...rest,
      headers: finalHeaders,
      body: isForm ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
      ...(typeof window === 'undefined' && (opts.next || opts.cache)
        ? { next: opts.next, cache: opts.cache }
        : {}),
    });
  } catch (e) {
    throw new ApiClientError(e instanceof Error ? e.message : 'Network error', 0, 'NETWORK');
  }

  // 204 no content
  if (res.status === 204) {
    return { success: true, data: undefined as T };
  }

  let json: ApiEnvelope<T> & { message?: string; error?: { message?: string; code?: string; details?: unknown } };
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : ({} as never);
  } catch {
    throw new ApiClientError(res.statusText || 'Invalid response', res.status, 'PARSE');
  }

  if (!res.ok || json.success === false) {
    const message =
      json?.error?.message || json?.message || (json as unknown as { data?: { message: string } })?.data?.message || res.statusText || 'Request failed';
    throw new ApiClientError(message, res.status, json?.error?.code, json?.error?.details);
  }
  return json as ApiEnvelope<T>;
}

/* ── Convenience wrappers ──────────────────────────────────── */

export async function apiGet<T>(path: string, opts?: RequestOptions): Promise<T> {
  return (await request<T>(path, { method: 'GET', ...opts })).data;
}

export async function apiPost<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
  return (await request<T>(path, { method: 'POST', body, ...opts })).data;
}

export async function apiPut<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
  return (await request<T>(path, { method: 'PUT', body, ...opts })).data;
}

export async function apiPatch<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
  return (await request<T>(path, { method: 'PATCH', body, ...opts })).data;
}

export async function apiDelete<T>(path: string, opts?: RequestOptions): Promise<T> {
  return (await request<T>(path, { method: 'DELETE', ...opts })).data;
}

/** Returns envelope + meta (for paginated lists). */
export async function apiList<T>(path: string, opts?: RequestOptions): Promise<{ data: T; meta?: ApiEnvelope<T>['meta'] }> {
  const env = await request<T>(path, { method: 'GET', ...opts });
  return { data: env.data, meta: env.meta };
}
