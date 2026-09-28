/* Typed accessors for public runtime env vars. Server-only vars (OAuth secrets,
 * NEXTAUTH_SECRET) are read directly via process.env where used and are never
 * exported to the client. */

function pub(name: string, fallback = ''): string {
  const v = process.env[name];
  return v && v.length ? v : fallback;
}

export const env = {
  api_url: pub('NEXT_PUBLIC_API_URL', 'http://localhost:5000'),
  socket_url: pub('NEXT_PUBLIC_SOCKET_URL', pub('NEXT_PUBLIC_API_URL', 'http://localhost:5000')),
  web_url: pub('NEXT_PUBLIC_WEB_URL', 'http://localhost:3000'),
  currency: pub('NEXT_PUBLIC_CURRENCY', 'LKR'),
  currency_symbol: pub('NEXT_PUBLIC_CURRENCY_SYMBOL', 'Rs'),
  stripe_publishable_key: pub('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
  vapid_public_key: pub('NEXT_PUBLIC_VAPID_PUBLIC_KEY'),
  /* Social-login buttons are shown client-side, but the OAuth secrets are
   * server-only — these explicit public flags tell the UI they are wired up. */
  google_login_enabled: pub('NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED') === 'true',
  facebook_login_enabled: pub('NEXT_PUBLIC_FACEBOOK_LOGIN_ENABLED') === 'true',
} as const;

/** Resolve a media URL (relative upload path or absolute) to a full URL. */
export function mediaUrl(path?: string | null): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  return `${env.api_url}${path.startsWith('/') ? '' : '/'}${path}`;
}
