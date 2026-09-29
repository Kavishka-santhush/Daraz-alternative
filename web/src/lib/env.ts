/* Typed accessors for public runtime env vars. Server-only vars (OAuth secrets,
 * NEXTAUTH_SECRET) are read directly via process.env where used and are never
 * exported to the client. */

// Each value must be written as a literal `process.env.NEXT_PUBLIC_*` reference:
// Next.js replaces only those at build time, so a dynamic `process.env[name]`
// lookup compiles to undefined in the browser bundle and silently uses the
// fallback — which pointed a deployed storefront at http://localhost:5000.
const pick = (value: string | undefined, fallback: string): string => (value && value.length ? value : fallback);

const apiUrl = pick(process.env.NEXT_PUBLIC_API_URL, 'http://localhost:5000');

export const env = {
  api_url: apiUrl,
  socket_url: pick(process.env.NEXT_PUBLIC_SOCKET_URL, apiUrl),
  web_url: pick(process.env.NEXT_PUBLIC_WEB_URL, 'http://localhost:3000'),
  currency: pick(process.env.NEXT_PUBLIC_CURRENCY, 'LKR'),
  currency_symbol: pick(process.env.NEXT_PUBLIC_CURRENCY_SYMBOL, 'Rs'),
  stripe_publishable_key: pick(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, ''),
  vapid_public_key: pick(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, ''),
  /* Social-login buttons are shown client-side, but the OAuth secrets are
   * server-only — these explicit public flags tell the UI they are wired up. */
  google_login_enabled: pick(process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED, '') === 'true',
  facebook_login_enabled: pick(process.env.NEXT_PUBLIC_FACEBOOK_LOGIN_ENABLED, '') === 'true',
} as const;

/** Resolve a media URL (relative upload path or absolute) to a full URL. */
export function mediaUrl(path?: string | null): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  return `${env.api_url}${path.startsWith('/') ? '' : '/'}${path}`;
}
