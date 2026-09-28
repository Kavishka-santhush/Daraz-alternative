'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import { AccountSidebar } from '@/components/shared/account-sidebar';

/** Guards the account area and lays out the sidebar + content grid. */
export function AccountShell({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="container flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  // Guests are mid-redirect; render nothing to avoid a flash.
  if (status === 'unauthenticated') return null;

  return (
    <div className="container grid gap-6 py-8 lg:grid-cols-[240px_1fr]">
      <AccountSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
