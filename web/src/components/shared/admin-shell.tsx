'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';

const STAFF = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_MANAGER', 'SUPPORT_AGENT', 'FINANCE_MANAGER'];

/** Guards the staff console: requires an authenticated staff role. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { status, data } = useSession();
  const router = useRouter();
  const isStaff = status === 'authenticated' && !!data?.user?.role && STAFF.includes(data.user.role);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
    } else if (status === 'authenticated' && !isStaff) {
      router.replace('/');
    }
  }, [status, isStaff, router]);

  if (status === 'loading') {
    return (
      <div className="container flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (status !== 'authenticated' || !isStaff) {
    return (
      <div className="container flex flex-col items-center gap-2 py-24 text-center">
        <ShieldAlert className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Restricted area — staff access only.</p>
      </div>
    );
  }

  return (
    <div className="container grid gap-6 py-8 lg:grid-cols-[240px_1fr]">
      <AdminSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
