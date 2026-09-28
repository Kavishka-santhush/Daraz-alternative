import type { NextAuthOptions, DefaultSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';
import { env } from './env';
import type { LoginResult, MeUser, Role } from '@/types';

/** Call the backend refresh endpoint to mint a new access token. */
async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(`${env.api_url}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error('refresh failed');
  const tokens = json.data as { accessToken: string; refreshToken: string; expiresIn: number };
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExp: Date.now() / 1000 + (tokens.expiresIn ?? 900) - 30,
  };
}

const providers: NextAuthOptions['providers'] = [
  CredentialsProvider({
    id: 'credentials',
    name: 'Email & Password',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;
      try {
        const res = await fetch(`${env.api_url}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: credentials.email, password: credentials.password }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) return null;
        const { user, tokens } = json.data as LoginResult;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl ?? null,
          role: user.role,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          accessTokenExp: Date.now() / 1000 + tokens.expiresIn - 30,
        } as never;
      } catch {
        return null;
      }
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}
if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
  providers.push(
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Initial sign-in: copy fields off the `user` object.
      if (user) {
        token.id = (user as never as { id: string }).id ?? token.id;
        token.role = (user as never as { role?: Role }).role ?? token.role;
        token.accessToken = (user as never as { accessToken?: string }).accessToken;
        token.refreshToken = (user as never as { refreshToken?: string }).refreshToken;
        token.accessTokenExp = (user as never as { accessTokenExp?: number }).accessTokenExp;
      }

      // Proactively refresh the backend access token when it is close to expiry
      // (or when the client explicitly asks via unstable_update({})).
      const exp = token.accessTokenExp as number | undefined;
      const needsRefresh = Boolean(token.refreshToken) && (!exp || exp < Date.now() / 1000 || trigger === 'update');
      if (needsRefresh && token.refreshToken) {
        try {
          const refreshed = await refreshAccessToken(token.refreshToken as string);
          token.accessToken = refreshed.accessToken;
          token.refreshToken = refreshed.refreshToken;
          token.accessTokenExp = refreshed.accessTokenExp;
          token.error = undefined;
        } catch {
          token.error = 'RefreshTokenError';
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = (token.id as string) ?? '';
      session.user.role = (token.role as Role) ?? 'BUYER';
      session.user.accessToken = token.accessToken as string | undefined;
      session.user.refreshToken = token.refreshToken as string | undefined;
      return session;
    },
  },
};

/** Fetch the current backend user (richer than the JWT) on the server. */
export async function fetchMe(accessToken?: string): Promise<MeUser | null> {
  if (!accessToken) return null;
  try {
    const res = await fetch(`${env.api_url}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    const json = await res.json().catch(() => null);
    return json?.success ? (json.data as MeUser) : null;
  } catch {
    return null;
  }
}
