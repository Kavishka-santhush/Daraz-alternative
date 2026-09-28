'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Package, Loader2, Truck, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Pagination } from '@/components/shared/pagination';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useSellerOrders, useConfirmSubOrder, useAdvanceSubOrder } from '@/hooks/use-seller';
import { formatMoney, num } from '@/lib/utils';
import { mediaUrl } from '@/lib/env';
import type { SellerSubOrderRow } from '@/types';

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'New', value: 'PLACED' },
  { label: 'Confirmed', value: 'CONFIRMED' },
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
  const { data, isLoading } = useSellerOrders({ status: status || undefined, page });

  const confirm = useConfirmSubOrder();
  const advance = useAdvanceSubOrder();
  const [shipTarget, setShipTarget] = useState<SellerSubOrderRow | null>(null);
  const [tracking, setTracking] = useState('');
  const [courier, setCourier] = useState('');

  const setTab = (value: string) => {
    const sp = new URLSearchParams(search.toString());
    if (value) sp.set('status', value);
    else sp.delete('status');
    sp.delete('page');
    router.push(`/seller/orders?${sp.toString()}`);
  };

  const meta = data?.meta;
  const pages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;
  const href = (p: number) => {
    const sp = new URLSearchParams(search.toString());
    if (p > 1) sp.set('page', String(p));
    else sp.delete('page');
    return `/seller/orders?${sp.toString()}`;
  };

  const ship = () => {
    if (!shipTarget) return;
    advance.mutate(
      { subId: shipTarget.id, status: 'SHIPPED', trackingNumber: tracking, courierName: courier },
      { onSuccess: () => setShipTarget(null) },
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-sm text-muted-foreground">Confirm, prepare and ship your orders.</p>
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
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={Package} title="No orders" description={status ? 'No orders match this filter.' : 'New orders will show up here.'} />
      ) : (
        <>
          <div className="space-y-4">
            {data.items.map((o) => (
              <Card key={o.id}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{o.subOrderNumber}</span>
                    <span className="text-xs text-muted-foreground">
                      {o.order?.orderNumber} · {new Date(o.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {(o.trackingNumber || o.courierName) && (
                      <span className="text-xs text-muted-foreground">
                        {o.courierName}: {o.trackingNumber}
                      </span>
                    )}
                    <StatusBadge status={o.status} />
                  </div>
                </div>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap gap-2">
                    {(o.items ?? []).map((it) => (
                      <div key={it.id} className="flex items-center gap-2 rounded-md border p-1.5 pr-3">
                        <div className="h-10 w-10 overflow-hidden rounded bg-muted">
                          {it.imageSnapshot && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={mediaUrl(it.imageSnapshot)} alt={it.titleSnapshot} className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="text-xs">
                          <p className="max-w-[180px] truncate font-medium">{it.titleSnapshot}</p>
                          <p className="text-muted-foreground">
                            {it.quantity} × {formatMoney(num(it.unitPrice))}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Your earning: </span>
                      <span className="font-semibold text-green-700">{formatMoney(num(o.sellerEarning))}</span>
                      <span className="ml-3 text-muted-foreground">Commission: </span>
                      <span>{formatMoney(num(o.commissionAmount))}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {o.status === 'PLACED' && (
                        <Button
                          size="sm"
                          variant="brand"
                          disabled={confirm.isPending}
                          onClick={() => confirm.mutate({ subId: o.id })}
                        >
                          {confirm.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                          Confirm order
                        </Button>
                      )}
                      {o.status === 'CONFIRMED' && (
                        <Button size="sm" variant="outline" disabled={advance.isPending} onClick={() => advance.mutate({ subId: o.id, status: 'PROCESSING' })}>
                          Start processing
                        </Button>
                      )}
                      {o.status === 'PROCESSING' && (
                        <Button
                          size="sm"
                          variant="brand"
                          onClick={() => {
                            setTracking(o.trackingNumber ?? '');
                            setCourier(o.courierName ?? '');
                            setShipTarget(o);
                          }}
                        >
                          <Truck className="mr-2 h-4 w-4" /> Mark shipped
                        </Button>
                      )}
                      {o.status === 'SHIPPED' && (
                        <Button size="sm" variant="outline" disabled={advance.isPending} onClick={() => advance.mutate({ subId: o.id, status: 'OUT_FOR_DELIVERY' })}>
                          Out for delivery
                        </Button>
                      )}
                      {o.status === 'OUT_FOR_DELIVERY' && (
                        <Button size="sm" variant="brand" disabled={advance.isPending} onClick={() => advance.mutate({ subId: o.id, status: 'DELIVERED' })}>
                          Mark delivered
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Pagination page={page} pages={pages} href={href} />
        </>
      )}

      <Dialog open={!!shipTarget} onOpenChange={(open) => !open && setShipTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ship order</DialogTitle>
            <DialogDescription>Add the courier and tracking number so the buyer can follow their parcel.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="courier">Courier name</Label>
              <Input id="courier" value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="e.g. BlueDart" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tracking">Tracking number</Label>
              <Input id="tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="AWB / consignment no." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipTarget(null)}>
              Cancel
            </Button>
            <Button variant="brand" disabled={advance.isPending || !tracking || !courier} onClick={ship}>
              {advance.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm shipment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SellerOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-8 w-40" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      }
    >
      <OrdersInner />
    </Suspense>
  );
}
