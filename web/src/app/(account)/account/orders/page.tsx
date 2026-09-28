'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Package, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Pagination } from '@/components/shared/pagination';
import { useMyOrders } from '@/hooks/use-account';
import { formatMoney, num } from '@/lib/utils';
import { mediaUrl } from '@/lib/env';

const STATUS_TABS: Array<{ label: string; value: string }> = [
  { label: 'All', value: '' },
  { label: 'Processing', value: 'PROCESSING' },
  { label: 'Shipped', value: 'SHIPPED' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

function OrdersInner() {
  const router = useRouter();
  const search = useSearchParams();
  const status = search.get('status') ?? '';
  const page = Number(search.get('page') ?? 1);
  const { data, isLoading } = useMyOrders({ status: status || undefined, page });

  const setTab = (value: string) => {
    const sp = new URLSearchParams(search.toString());
    if (value) sp.set('status', value);
    else sp.delete('status');
    sp.delete('page');
    router.push(`/account/orders?${sp.toString()}`);
  };

  const meta = data?.meta;
  const pages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;
  const href = (p: number) => {
    const sp = new URLSearchParams(search.toString());
    if (p > 1) sp.set('page', String(p));
    else sp.delete('page');
    return `/account/orders?${sp.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">My orders</h1>
        <p className="text-sm text-muted-foreground">Track, review and manage your purchases.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <Button
            key={t.value || 'all'}
            variant={status === t.value ? 'brand' : 'outline'}
            size="sm"
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders found"
          description={status ? 'No orders match this filter.' : "You haven't placed any orders yet."}
          action={
            <Button asChild variant="brand">
              <Link href="/">Start shopping</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-4">
            {data.items.map((o) => (
              <Link key={o.id} href={`/account/orders/${o.orderNumber}`} className="block">
                <Card className="group overflow-hidden transition-shadow hover:shadow-md">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">Order {o.orderNumber}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(o.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={o.paymentStatus} label={`Payment ${o.paymentStatus.toLowerCase()}`} />
                      <StatusBadge status={o.status} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                  <CardContent className="space-y-3 p-4">
                    {(o.subOrders ?? []).map((sub) => (
                      <div key={sub.id} className="flex flex-wrap items-center gap-3">
                        <div className="flex -space-x-2">
                          {(sub.items ?? []).slice(0, 4).map((it) => (
                            <div
                              key={it.id}
                              className="relative h-12 w-12 overflow-hidden rounded-md border bg-muted"
                            >
                              {it.imageSnapshot && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={mediaUrl(it.imageSnapshot)}
                                  alt={it.titleSnapshot}
                                  className="h-full w-full object-cover"
                                />
                              )}
                            </div>
                          ))}
                          {(sub.items?.length ?? 0) > 4 && (
                            <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-muted text-xs font-medium text-muted-foreground">
                              +{(sub.items?.length ?? 0) - 4}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 text-sm">
                          <p className="truncate font-medium">{sub.shop?.name ?? 'Shop'}</p>
                          <p className="text-xs text-muted-foreground">{sub.subOrderNumber}</p>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t pt-3">
                      <span className="text-sm text-muted-foreground">
                        {(o.subOrders ?? [])
                          .flatMap((s) => s.items ?? [])
                          .reduce((n, it) => n + it.quantity, 0)}{' '}
                        items total
                      </span>
                      <span className="text-base font-bold text-brand">
                        {formatMoney(num(o.totalAmount))}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <Pagination page={page} pages={pages} href={href} />
        </>
      )}
    </div>
  );
}

export default function OrdersListPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-8 w-40" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      }
    >
      <OrdersInner />
    </Suspense>
  );
}
