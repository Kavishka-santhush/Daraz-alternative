'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Pagination } from '@/components/shared/pagination';
import { useAdminOrders } from '@/hooks/use-admin';
import { formatMoney, num, formatDate } from '@/lib/utils';

const TABS = [
  { label: 'All', value: '' },
  { label: 'Placed', value: 'PLACED' },
  { label: 'Shipped', value: 'SHIPPED' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

function Inner() {
  const router = useRouter();
  const search = useSearchParams();
  const status = search.get('status') ?? '';
  const page = Number(search.get('page') ?? 1);
  const { data, isLoading } = useAdminOrders({ status: status || undefined, page });

  const setTab = (value: string) => {
    const sp = new URLSearchParams();
    if (value) sp.set('status', value);
    router.push(`/admin/orders${sp.toString() ? `?${sp.toString()}` : ''}`);
  };

  const meta = data?.meta;
  const pages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;
  const href = (p: number) => `/admin/orders?${new URLSearchParams({ ...(status ? { status } : {}), page: String(p) }).toString()}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-sm text-muted-foreground">All marketplace orders across sellers.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button key={t.value || 'all'} variant={status === t.value ? 'brand' : 'outline'} size="sm" onClick={() => setTab(t.value)}>
            {t.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No orders" description="No orders match this filter." />
      ) : (
        <>
          <div className="space-y-3">
            {data.items.map((o) => (
              <Card key={o.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold">{o.orderNumber}</span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {o.buyer?.name ?? 'Buyer'} · {formatDate(o.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={o.paymentStatus} label={`Payment ${o.paymentStatus.toLowerCase()}`} />
                      <StatusBadge status={o.status} />
                      <span className="ml-2 font-bold text-brand">{formatMoney(num(o.totalAmount))}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {(o.subOrders ?? []).map((s) => (
                      <span key={s.id} className="inline-flex items-center gap-1 rounded border px-2 py-0.5">
                        {s.shop?.name ?? 'Shop'} · <StatusBadge status={s.status} />
                      </span>
                    ))}
                    <span className="ml-auto">Payment: {o.paymentMethod}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Pagination page={page} pages={pages} href={href} />
        </>
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>}>
      <Inner />
    </Suspense>
  );
}
