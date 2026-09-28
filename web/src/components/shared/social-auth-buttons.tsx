'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { env } from '@/lib/env';

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.86-.08-1.69-.22-2.49H12v4.71h6.46a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.59-5.17 3.59-8.85Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.87-3.01c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H3.34v3.09A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.64H3.34a12 12 0 0 0 0 10.72l1.93-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.43-3.43A11.97 11.97 0 0 0 12 0 11.99 11.99 0 0 0 3.34 6.64l1.93 3.09C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11.02 10.12 11.93v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.26h3.32l-.53 3.49h-2.79V24A12.01 12.01 0 0 0 24 12.07Z" />
    </svg>
  );
}

/**
 * Google / Facebook sign-in buttons. Renders nothing (or just the divider if
 * exactly one provider is configured) unless the matching
 * NEXT_PUBLIC_*_LOGIN_ENABLED flag is set — see lib/env.ts.
 */
export function SocialAuthButtons({ redirectTo = '/' }: { redirectTo?: string }) {
  const { google_login_enabled: google, facebook_login_enabled: facebook } = env;
  if (!google && !facebook) return null;

  const oauth = (provider: 'google' | 'facebook') =>
    signIn(provider, { callbackUrl: redirectTo });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs uppercase text-muted-foreground">or continue with</span>
        <Separator className="flex-1" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {google && (
          <Button type="button" variant="outline" onClick={() => oauth('google')}>
            <GoogleIcon /> Google
          </Button>
        )}
        {facebook && (
          <Button type="button" variant="outline" onClick={() => oauth('facebook')}>
            <FacebookIcon /> Facebook
          </Button>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Social accounts are created automatically on first sign-in.
      </p>
    </div>
  );
}
