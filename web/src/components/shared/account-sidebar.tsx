'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  Package,
  RotateCcw,
  Wallet,
  Heart,
  MapPin,
  Bell,
  Settings,
  LifeBuoy,
  Store,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUnreadCount } from '@/hooks/use-account';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
}

/** Buyer account navigation with active-route highlighting. */
export function AccountSidebar() {
  const pathname = usePathname();
  const { data, status } = useSession();
  const { data: unread } = useUnreadCount(status === 'authenticated');

  const isActive = (href: string) =>
    href === '/account' ? pathname === '/account' : pathname.startsWith(href);

  const items: NavItem[] = [
    { href: '/account', label: 'Overview', icon: LayoutDashboard },
    { href: '/account/orders', label: 'My orders', icon: Package },
    { href: '/account/returns', label: 'Returns & refunds', icon: RotateCcw },
    { href: '/account/wallet', label: 'Wallet', icon: Wallet },
    { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
    { href: '/account/addresses', label: 'Addresses', icon: MapPin },
    { href: '/account/notifications', label: 'Notifications', icon: Bell, badge: unread?.count ?? 0 },
    { href: '/account/support', label: 'Help & support', icon: LifeBuoy },
    { href: '/account/settings', label: 'Settings', icon: Settings },
  ];

  const role = data?.user?.role;
  const extras: NavItem[] = [];
  if (role === 'SELLER') extras.push({ href: '/seller', label: 'Seller dashboard', icon: Store });
  if (role && ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_MANAGER', 'FINANCE_MANAGER', 'SUPPORT_AGENT'].includes(role))
    extras.push({ href: '/admin', label: 'Admin dashboard', icon: ShieldCheck });

  return (
    <aside className="lg:w-60 lg:shrink-0">
      <nav className="space-y-1">
        {items.map((item) => {
          const active = isActive(item.href);
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
              {item.badge ? (
                <span className="rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}

        {extras.length > 0 && (
          <>
            <div className="my-3 border-t" />
            {extras.map((item) => {
              const active = isActive(item.href);
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
          </>
        )}
      </nav>
    </aside>
  );
}
