'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Package, Heart, Wallet, Coins, ChevronRight, ShoppingBag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/status-badge';
import { StatCard } from '@/components/shared/stat-card';
import { useProfile, useMyOrders, useWallet, useLoyalty } from '@/hooks/use-account';
import { formatMoney, num } from '@/lib/utils';

function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}

/** Account landing: KPIs, quick links and the latest orders. */
export default function AccountOverviewPage() {
  const { data: session } = useSession();
  const { data: profile, isLoading } = useProfile();
  const { data: orders } = useMyOrders({ page: 1 });
  const { data: wallet } = useWallet();
  const { data: loyalty } = useLoyalty();

  if (isLoading) return <Loading />;

  const firstName = (profile?.name ?? session?.user?.name ?? 'there').split(' ')[0];
  const recentOrders = orders?.items?.slice(0, 3) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {firstName} 👋</h1>
        <p className="text-sm text-muted-foreground">Here&apos;s what&apos;s happening with your account.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total orders" value={profile?._count.orders ?? 0} icon={ShoppingBag} />
        <StatCard
          label="Wallet balance"
          value={formatMoney(num(wallet?.balance ?? 0))}
          icon={Wallet}
        />
        <StatCard
          label="Loyalty points"
          value={(loyalty?.points ?? profile?.loyaltyPoints ?? 0).toLocaleString()}
          hint={loyalty ? `≈ ${formatMoney(loyalty.currencyValue)} value` : undefined}
          icon={Coins}
        />
        <StatCard label="Wishlist" value={profile?._count.wishlists ?? 0} icon={Heart} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { href: '/account/orders', label: 'View my orders', icon: Package },
          { href: '/account/wallet', label: 'Top up wallet', icon: Wallet },
          { href: '/account/addresses', label: 'Manage addresses', icon: ChevronRight },
        ].map((q) => (
          <Link key={q.href} href={q.href}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <q.icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium">{q.label}</span>
                <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base font-semibold">Recent orders</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/account/orders">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <div className="py-8 text-center">
              <Package className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">No orders yet.</p>
              <Button asChild variant="brand" size="sm" className="mt-4">
                <Link href="/">Start shopping</Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {recentOrders.map((o) => (
                <Link
                  key={o.id}
                  href={`/account/orders/${o.orderNumber}`}
                  className="flex items-center gap-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">Order {o.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString()} ·{' '}
                      {(o.subOrders ?? []).reduce((n, s) => n + (s.items?.length ?? 0), 0)} item(s)
                    </p>
                  </div>
                  <span className="text-sm font-semibold">{formatMoney(num(o.totalAmount))}</span>
                  <StatusBadge status={o.status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
