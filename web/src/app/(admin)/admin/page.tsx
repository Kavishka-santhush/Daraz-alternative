'use client';

import Link from 'next/link';
import {
  Users,
  Store,
  Package,
  ShoppingBag,
  CircleDollarSign,
  Percent,
  LifeBuoy,
  RotateCcw,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/shared/stat-card';
import { useAdminOverview } from '@/hooks/use-admin';
import { formatMoney } from '@/lib/utils';

export default function AdminOverviewPage() {
  const { data, isLoading } = useAdminOverview();

  if (isLoading || !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const needsAttention: Array<{ label: string; value: number; href: string; tone: string }> = [
    { label: 'Pending seller approvals', value: data.pendingSellerApprovals, href: '/admin/sellers', tone: 'text-amber-600' },
    { label: 'Open support tickets', value: data.openTickets, href: '/admin/support', tone: 'text-blue-600' },
    { label: 'Pending returns', value: data.pendingReturns, href: '/admin/orders', tone: 'text-purple-600' },
    { label: 'Flagged fraud alerts', value: data.flaggedFraudAlerts, href: '/admin/fraud', tone: 'text-red-600' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform overview</h1>
        <p className="text-sm text-muted-foreground">Marketplace health at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Buyers" value={data.users} icon={Users} />
        <StatCard label="Sellers" value={data.sellers} icon={Store} />
        <StatCard label="Products" value={data.products.active} icon={Package} hint={`${data.products.total} total`} />
        <StatCard label="Orders" value={data.orders.total} icon={ShoppingBag} hint={`${data.orders.today} today`} />
        <StatCard label="GMV (all time)" value={formatMoney(data.gmv.all)} icon={CircleDollarSign} hint={`${formatMoney(data.gmv.thisMonth)} this month`} />
        <StatCard label="Commission" value={formatMoney(data.commissionRevenue.all)} icon={Percent} hint={`${formatMoney(data.commissionRevenue.thisMonth)} this month`} />
        <StatCard label="Open tickets" value={data.openTickets} icon={LifeBuoy} />
        <StatCard label="Pending returns" value={data.pendingReturns} icon={RotateCcw} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Needs attention</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {needsAttention.map((n) => (
            <Link
              key={n.href + n.label}
              href={n.href}
              className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
            >
              <div className="flex items-center gap-3">
                <ShieldAlert className={`h-5 w-5 ${n.value > 0 ? n.tone : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium">{n.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold ${n.value > 0 ? n.tone : 'text-muted-foreground'}`}>{n.value}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
