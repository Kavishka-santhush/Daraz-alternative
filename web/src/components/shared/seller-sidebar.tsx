'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  Package,
  Boxes,
  RotateCcw,
  Banknote,
  Store,
  ExternalLink,
  BadgeCheck,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSellerDashboard } from '@/hooks/use-seller';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}

const ITEMS: NavItem[] = [
  { href: '/seller', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/seller/orders', label: 'Orders', icon: Package },
  { href: '/seller/products', label: 'Products', icon: Boxes },
  { href: '/seller/returns', label: 'Returns', icon: RotateCcw },
  { href: '/seller/earnings', label: 'Earnings', icon: Banknote },
  { href: '/seller/shop', label: 'My shop', icon: Store },
];

/** Seller account navigation with active highlighting + approval status. */
export function SellerSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { data } = useSellerDashboard(session?.user?.role === 'SELLER');
  const status = data?.seller.status;

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <aside className="lg:w-60 lg:shrink-0">
      {status && status !== 'APPROVED' && (
        <div
          className={cn(
            'mb-3 flex items-start gap-2 rounded-lg border p-3 text-xs',
            status === 'PENDING_APPROVAL'
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-red-200 bg-red-50 text-red-800',
          )}
        >
          {status === 'PENDING_APPROVAL' ? (
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>
            {status === 'PENDING_APPROVAL'
              ? 'Your seller account is pending approval. Shops unlock once approved.'
              : status === 'REJECTED'
                ? 'Your application was rejected. Update your documents or contact support.'
                : 'Your account is suspended. Contact support to resolve.'}
          </span>
        </div>
      )}

      <nav className="space-y-1">
        {ITEMS.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-brand/10 text-brand' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}

        <div className="my-3 border-t" />
        <Link
          href={data?.seller.shops?.[0]?.slug ? `/shops/${data.seller.shops[0].slug}` : '/'}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4" />
          <span className="flex-1">View storefront</span>
        </Link>
      </nav>
    </aside>
  );
}
