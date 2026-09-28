'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  Store,
  ShieldAlert,
  Package,
  ShoppingBag,
  Users,
  Landmark,
  Banknote,
  LifeBuoy,
  Settings,
  ScrollText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Role } from '@/types';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
  exact?: boolean;
}

const ALL: Role[] = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_MANAGER', 'SUPPORT_AGENT', 'FINANCE_MANAGER'];
const MOD: Role[] = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_MANAGER'];

const ITEMS: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, roles: ALL, exact: true },
  { href: '/admin/sellers', label: 'Seller approvals', icon: Store, roles: MOD },
  { href: '/admin/products', label: 'Product review', icon: Package, roles: MOD },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag, roles: ALL },
  { href: '/admin/users', label: 'Users', icon: Users, roles: [...MOD, 'SUPPORT_AGENT'] },
  { href: '/admin/fraud', label: 'Fraud', icon: ShieldAlert, roles: MOD },
  { href: '/admin/finance', label: 'Finance', icon: Landmark, roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'] },
  { href: '/admin/payouts', label: 'Payouts', icon: Banknote, roles: ['SUPER_ADMIN', 'FINANCE_MANAGER'] },
  { href: '/admin/support', label: 'Support', icon: LifeBuoy, roles: ALL },
  { href: '/admin/settings', label: 'Settings', icon: Settings, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { href: '/admin/audit', label: 'Audit log', icon: ScrollText, roles: ['SUPER_ADMIN', 'ADMIN'] },
];

/** Staff navigation, filtered to the items the signed-in role may open. */
export function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;

  const visible = ITEMS.filter((i) => !role || i.roles.includes(role));
  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/');

  return (
    <aside className="lg:w-60 lg:shrink-0">
      <div className="mb-3 flex items-center gap-2 rounded-lg bg-brand/10 px-3 py-2 text-sm font-semibold text-brand">
        <ShieldAlert className="h-4 w-4" />
        Staff console
      </div>
      <nav className="space-y-1">
        {visible.map((item) => {
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
      </nav>
    </aside>
  );
}
