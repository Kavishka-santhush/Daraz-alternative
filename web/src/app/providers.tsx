'use client';

import { useEffect, useState } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from '@tanstack/react-query';
import { Toaster as SonnerToaster } from 'sonner';
import { setClientToken } from '@/lib/api';
import { CartProvider } from '@/components/providers/cart-provider';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

/** Keeps the API client's bearer token in sync with the NextAuth session. */
function AuthSync() {
  const { data, status } = useSession();
  useEffect(() => {
    if (status === 'authenticated') {
      setClientToken(data.user?.accessToken ?? null);
    } else if (status === 'unauthenticated') {
      setClientToken(null);
    }
  }, [data, status]);
  return null;
}

/** Recreate the query cache on navigation-relevant focus changes is disabled;
 *  we only bridge window focus → react-query focusManager. */
function FocusBridge() {
  useEffect(() => {
    const onVis = () => focusManager.setFocused(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus={false}>
      <QueryClientProvider client={queryClient}>
        <AuthSync />
        <FocusBridge />
        <CartProvider>{children}</CartProvider>
        <SonnerToaster position="top-right" richColors closeButton />
      </QueryClientProvider>
    </SessionProvider>
  );
}
