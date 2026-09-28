'use client';

import Link from 'next/link';
import {
  ShoppingCart,
  Clock,
  Boxes,
  Wallet,
  Star,
  PackagePlus,
  ListChecks,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/status-badge';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { useSellerDashboard, useSellerMetrics, useSellerOrders } from '@/hooks/use-seller';
import { formatMoney, num } from '@/lib/utils';

export default function SellerOverviewPage() {
  const { data, isLoading } = useSellerDashboard();
  const { data: metrics } = useSellerMetrics();
  const { data: recent } = useSellerOrders({ page: 1 });

  if (isLoading || !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { stats, seller } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Seller dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back — here&apos;s how your shop is performing.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/seller/orders">
              <ListChecks className="mr-2 h-4 w-4" /> Orders
            </Link>
          </Button>
          <Button asChild size="sm" variant="brand">
            <Link href="/seller/products/new">
              <PackagePlus className="mr-2 h-4 w-4" /> Add product
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's orders" value={stats.todayOrders} icon={ShoppingCart} />
        <StatCard label="Pending orders" value={stats.pendingOrders} icon={Clock} hint="Awaiting confirmation or dispatch" />
        <StatCard label="Active products" value={stats.productsCount} icon={Boxes} />
        <StatCard label="Available balance" value={formatMoney(num(stats.availableBalance))} icon={Wallet} hint={`Pending ${formatMoney(num(stats.pending))}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent orders</CardTitle>
            <Link href="/seller/orders" className="text-sm font-medium text-brand hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {!recent || recent.items.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="No orders yet"
                description="Orders will appear here as soon as customers buy from your shop."
              />
            ) : (
              <div className="divide-y">
                {recent.items.slice(0, 6).map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{o.subOrderNumber}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {o.order?.buyer?.name ?? 'Customer'} · {new Date(o.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold">{formatMoney(num(o.sellerEarning))}</span>
                      <StatusBadge status={o.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shop performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-brand">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Lifetime net earnings</p>
                <p className="text-lg font-bold">{formatMoney(num(stats.lifetimeNet))}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="font-semibold">{(metrics ? num(metrics.avgRating) : num(seller.rating)).toFixed(2)}</span>
              <span className="text-muted-foreground">
                ({metrics?.reviewCount ?? 0} review{metrics?.reviewCount === 1 ? '' : 's'})
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Total orders</dt>
              <dd className="text-right font-medium">{metrics?.totalOrders ?? 0}</dd>
              <dt className="text-muted-foreground">Completion rate</dt>
              <dd className="text-right font-medium">{metrics ? `${Math.round(metrics.completionRate)}%` : '—'}</dd>
              <dt className="text-muted-foreground">Disputes</dt>
              <dd className="text-right font-medium">{metrics?.disputes ?? 0}</dd>
              <dt className="text-muted-foreground">Tier</dt>
              <dd className="text-right font-medium capitalize">{seller.tier.toLowerCase()}</dd>
            </dl>

            <Button asChild variant="outline" className="w-full">
              <Link href="/seller/earnings">View earnings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
