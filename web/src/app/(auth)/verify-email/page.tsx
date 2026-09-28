'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, MailCheck, MailWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { apiPost, ApiClientError } from '@/lib/api';

type State = 'loading' | 'ok' | 'error';

function VerifyEmailInner() {
  const params = useSearchParams();
  const [state, setState] = useState<State>('loading');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get('token');
    const uid = params.get('uid');
    if (!token || !uid) {
      setState('error');
      setMessage('This verification link is incomplete.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await apiPost('/auth/verify-email', { token, uid }, { token: null });
        if (!cancelled) setState('ok');
      } catch (e) {
        if (cancelled) return;
        setState('error');
        setMessage(
          e instanceof ApiClientError
            ? 'This link is invalid or was already used. Sign in and request a new one.'
            : 'Verification failed. Please try again later.',
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">
          {state === 'ok' ? 'Email verified' : state === 'error' ? 'Verification failed' : 'Verifying…'}
        </CardTitle>
        <CardDescription>
          {state === 'ok'
            ? 'Your email address has been confirmed. Enjoy shopping!'
            : state === 'error'
              ? (message ?? 'Please check your link and try again.')
              : 'One moment while we check your link.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center py-2">
        {state === 'loading' && <Loader2 className="h-8 w-8 animate-spin text-brand" />}
        {state === 'ok' && (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand">
            <MailCheck className="h-7 w-7" />
          </span>
        )}
        {state === 'error' && (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <MailWarning className="h-7 w-7" />
          </span>
        )}
      </CardContent>
      <CardFooter className="justify-center">
        <Button asChild={state !== 'loading'} variant="brand">
          {state === 'loading' ? (
            <span>Working…</span>
          ) : (
            <Link href={state === 'ok' ? '/' : '/login'}>
              {state === 'ok' ? 'Start shopping' : 'Go to sign in'}
            </Link>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}
