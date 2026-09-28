'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import { SellerSidebar } from '@/components/shared/seller-sidebar';

/** Guards the seller area: requires an authenticated SELLER, otherwise
 *  redirects guests to login and non-sellers to the onboarding page. */
export function SellerShell({ children }: { children: React.ReactNode }) {
  const { status, data } = useSession();
  const router = useRouter();
  const isSeller = status === 'authenticated' && data?.user?.role === 'SELLER';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
    } else if (status === 'authenticated' && !isSeller) {
      router.replace('/sell');
    }
  }, [status, isSeller, router]);

  if (status === 'loading') {
    return (
      <div className="container flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  // Guests / non-sellers are mid-redirect; render nothing to avoid a flash.
  if (status !== 'authenticated' || !isSeller) return null;

  return (
    <div className="container grid gap-6 py-8 lg:grid-cols-[240px_1fr]">
      <SellerSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
