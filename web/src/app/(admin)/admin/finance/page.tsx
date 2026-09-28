'use client';

import { TrendingUp, Wallet, RotateCcw, HandCoins } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/shared/stat-card';
import { useFinanceOverview, useRevenueSeries, useTopSellers, usePaymentMethods } from '@/hooks/use-admin';
import { formatMoney, num, formatDate } from '@/lib/utils';

function barRows(rows: { key: string; label: string; value: number; caption: string }[]) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="flex items-center justify-between text-sm">
            <span className="truncate font-medium">{r.label}</span>
            <span className="shrink-0 text-muted-foreground">{r.caption}</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminFinancePage() {
  const { data: overview, isLoading } = useFinanceOverview();
  const { data: series } = useRevenueSeries(30);
  const { data: topSellers } = useTopSellers(8);
  const { data: methods } = usePaymentMethods();

  if (isLoading || !overview) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const peak = Math.max(1, ...(series ?? []).map((p) => num(p.gmv)));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Finance overview</h1>
        <p className="text-sm text-muted-foreground">Marketplace revenue, take rate, liabilities and payout exposure.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={TrendingUp} label="GMV (all time)" value={formatMoney(num(overview.gmv.all))} hint={`This month ${formatMoney(num(overview.gmv.thisMonth))}`} />
        <StatCard icon={Wallet} label="Commission revenue" value={formatMoney(num(overview.commissionRevenue.all))} hint={`Take rate ${num(overview.effectiveTakeRate).toFixed(1)}%`} />
        <StatCard icon={HandCoins} label="Payout liability" value={formatMoney(num(overview.payoutLiability))} hint={`Processed ${formatMoney(num(overview.payoutsProcessed))}`} />
        <StatCard icon={RotateCcw} label="Refunds" value={formatMoney(num(overview.refundsTotal))} hint={`${overview.paidOrders} paid orders`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Wallet float</p>
            <p className="mt-1 font-semibold">{formatMoney(num(overview.walletFloat))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Seller escrow pending</p>
            <p className="mt-1 font-semibold">{formatMoney(num(overview.sellerEscrowPending))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Commission this month</p>
            <p className="mt-1 font-semibold">{formatMoney(num(overview.commissionRevenue.thisMonth))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">GMV this month</p>
            <p className="mt-1 font-semibold">{formatMoney(num(overview.gmv.thisMonth))}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue (last 30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {!series || series.length === 0 ? (
            <p className="text-sm text-muted-foreground">No revenue recorded yet.</p>
          ) : (
            <div className="flex h-40 items-end gap-1">
              {series.map((p) => (
                <div key={p.date} className="group relative flex flex-1 flex-col items-center justify-end">
                  <div
                    className="w-full rounded-t bg-brand/70 transition-colors group-hover:bg-brand"
                    style={{ height: `${(num(p.gmv) / peak) * 100}%`, minHeight: num(p.gmv) > 0 ? '2px' : '0' }}
                  />
                  <span className="pointer-events-none absolute -top-8 hidden whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background group-hover:block">
                    {formatDate(p.date)} · {formatMoney(num(p.gmv))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top sellers</CardTitle>
          </CardHeader>
          <CardContent>
            {!topSellers || topSellers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No seller revenue yet.</p>
            ) : (
              barRows(
                topSellers.map((s) => ({
                  key: s.sellerId,
                  label: s.shopName ?? s.email ?? s.sellerId,
                  value: num(s.grossRevenue),
                  caption: formatMoney(num(s.grossRevenue)),
                })),
              )
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment methods</CardTitle>
          </CardHeader>
          <CardContent>
            {!methods || methods.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              barRows(
                methods.map((m) => ({
                  key: m.method,
                  label: `${m.method.replace('_', ' ').toLowerCase()} · ${m.orders} orders`,
                  value: num(m.amount),
                  caption: formatMoney(num(m.amount)),
                })),
              )
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
