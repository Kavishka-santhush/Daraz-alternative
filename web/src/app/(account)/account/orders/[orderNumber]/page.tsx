'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle2,
  CreditCard,
  MapPin,
  Package,
  Store,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/shared/status-badge';
import { CardConfirm } from '@/components/shared/card-confirm';
import { apiGet, apiPost, ApiClientError } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { formatMoney, num } from '@/lib/utils';
import { mediaUrl } from '@/lib/env';
import type { Order } from '@/types';

function useOrderDetail() {
  const { status } = useSession();
  const params = useParams<{ orderNumber: string }>();
  const search = useSearchParams();
  const intent = search.get('intent');
  const justPlaced = search.get('placed') === '1' || Boolean(intent);
  const qc = useQueryClient();

  const orderNumber = decodeURIComponent(params.orderNumber);
  const q = useQuery({
    queryKey: queryKeys.order(orderNumber),
    queryFn: () => apiGet<Order>(`/orders/my/${encodeURIComponent(orderNumber)}`),
    enabled: status === 'authenticated' && Boolean(orderNumber),
    // While a card payment is outstanding, poll so the webhook outcome shows up.
    refetchInterval: (query) =>
      intent && query.state.data?.paymentStatus === 'PENDING' ? 4000 : false,
  });

  const cancelMut = useMutation({
    mutationFn: (reason: string) =>
      apiPost<Order>(`/orders/${encodeURIComponent(orderNumber)}/cancel`, { reason }),
    onSuccess: () => {
      toast.success('Order cancelled');
      qc.invalidateQueries({ queryKey: queryKeys.order(orderNumber) });
      qc.invalidateQueries({ queryKey: queryKeys.orders() });
    },
    onError: (e) =>
      toast.error('Could not cancel order', {
        description: e instanceof ApiClientError ? e.message : 'Please try again.',
      }),
  });

  return { order: q.data, isLoading: q.isLoading, error: q.error, intent, justPlaced, cancelMut, orderNumber };
}

function AddressBlock({ order }: { order: Order }) {
  const a = (order.addressSnapshot ?? {}) as Record<string, string | undefined>;
  if (!order.addressSnapshot) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <MapPin className="h-4 w-4 text-brand" /> Deliver to
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="font-medium">{a.contactName}</p>
        <p className="text-muted-foreground">
          {a.line1}{a.line2 ? `, ${a.line2}` : ''}
          <br />
          {a.city}{a.district ? ` · ${a.district}` : ''}{a.province ? ` · ${a.province}` : ''}
          {a.postalCode ? ` ${a.postalCode}` : ''}
        </p>
        <p className="text-muted-foreground">{a.contactPhone}</p>
      </CardContent>
    </Card>
  );
}

function TotalsCard({ order }: { order: Order }) {
  const rows: Array<[string, string, boolean?]> = [
    ['Subtotal', formatMoney(num(order.subtotal))],
    ['Shipping', formatMoney(num(order.shippingTotal))],
  ];
  if (num(order.discountTotal) > 0) rows.push(['Discounts', `-${formatMoney(num(order.discountTotal))}`, true]);
  if (num(order.taxTotal) > 0) rows.push(['Tax', formatMoney(num(order.taxTotal))]);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Payment summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {rows.map(([label, value, good]) => (
          <div key={label} className="flex justify-between">
            <span className="text-muted-foreground">{label}</span>
            <span className={good ? 'text-brand' : undefined}>{value}</span>
          </div>
        ))}
        <Separator className="my-2" />
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">Total</span>
          <span className="text-lg font-bold text-brand">{formatMoney(num(order.totalAmount))}</span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-muted-foreground">Method</span>
          <Badge variant="outline">{order.paymentMethod}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Payment status</span>
          <StatusBadge status={order.paymentStatus} />
        </div>
        {(order.loyaltyPointsEarned ?? 0) > 0 && (
          <p className="pt-1 text-xs text-muted-foreground">
            +{order.loyaltyPointsEarned?.toLocaleString()} loyalty points earned
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function OrderDetailInner() {
  const { order, isLoading, error, intent, justPlaced, cancelMut } = useOrderDetail();
  const [cancelReason, setCancelReason] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="container grid gap-6 py-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container py-16 text-center">
        <p className="text-muted-foreground">We couldn&apos;t load this order.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/account/orders">Back to my orders</Link>
        </Button>
      </div>
    );
  }

  const canCancel = ['PLACED', 'CONFIRMED', 'PROCESSING'].includes(order.status);
  const unpaid = order.paymentStatus === 'PENDING' || order.paymentStatus === 'FAILED';

  return (
    <div className="container grid gap-6 py-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {justPlaced && order.status !== 'CANCELLED' && (
          <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <div>
              <p className="font-semibold text-green-800">Order placed — thank you!</p>
              <p className="text-sm text-green-700">
                Order <span className="font-medium">{order.orderNumber}</span> confirmed. We&apos;ll
                keep you posted on every step.
              </p>
            </div>
          </div>
        )}

        {intent && unpaid && (
          <Card>
            <CardContent className="pt-6">
              <CardConfirm
                clientSecret={intent}
                onDone={() => window.location.reload()}
              />
            </CardContent>
          </Card>
        )}

        {unpaid && order.paymentMethod !== 'CARD' && order.paymentMethod !== 'INSTALLMENTS' && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <CreditCard className="h-4 w-4" />
            {order.paymentMethod === 'COD'
              ? `Please have ${formatMoney(num(order.totalAmount))} ready for the courier.`
              : 'Payment is still pending for this order.'}
          </div>
        )}

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4 text-brand" /> Order {order.orderNumber}
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Placed {new Date(order.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={order.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {(order.subOrders ?? []).map((sub) => (
              <div key={sub.id} className="rounded-lg border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Store className="h-4 w-4 text-muted-foreground" />
                    {sub.shop?.name ?? 'Shop'}
                    <span className="text-xs font-normal text-muted-foreground">{sub.subOrderNumber}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {sub.trackingNumber && (
                      <span className="text-xs text-muted-foreground">
                        {sub.courierName} · {sub.trackingNumber}
                      </span>
                    )}
                    <StatusBadge status={sub.status} />
                  </div>
                </div>
                <div className="divide-y">
                  {(sub.items ?? []).map((it) => (
                    <div key={it.id} className="flex items-center gap-3 p-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                        {it.imageSnapshot && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mediaUrl(it.imageSnapshot)} alt={it.titleSnapshot} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-medium">{it.titleSnapshot}</p>
                        <p className="text-xs text-muted-foreground">
                          {it.quantity} × {formatMoney(num(it.unitPrice))}
                        </p>
                      </div>
                      <p className="text-sm font-semibold">{formatMoney(num(it.totalPrice))}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
                  <span>Shipping {num(sub.shippingFee) === 0 ? 'free' : formatMoney(num(sub.shippingFee))}</span>
                  <span className="font-medium text-foreground">
                    Shop total {formatMoney(num(sub.subtotal) + num(sub.shippingFee) - num((sub as { discountAmount?: string }).discountAmount ?? 0))}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <AddressBlock order={order} />
      </div>

      <div className="space-y-4">
        <TotalsCard order={order} />

        <Card>
          <CardContent className="flex flex-col gap-2 pt-6">
            {canCancel && (
              <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="justify-start text-destructive hover:text-destructive">
                    <XCircle className="h-4 w-4" /> Cancel order
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cancel order {order.orderNumber}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="cancel-reason">Reason (helps us improve)</Label>
                    <Input
                      id="cancel-reason"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Changed my mind, found a better price…"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCancelOpen(false)}>
                      Keep order
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={cancelMut.isPending}
                      onClick={() => {
                        cancelMut.mutate(cancelReason || 'Cancelled by buyer');
                        setCancelOpen(false);
                      }}
                    >
                      {cancelMut.isPending ? 'Cancelling…' : 'Confirm cancellation'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            <Button asChild variant="ghost" className="justify-start">
              <Link href="/account/returns">Request a return</Link>
            </Button>
            <Button asChild variant="ghost" className="justify-start">
              <Link href="/account/support">Need help with this order?</Link>
            </Button>
            <Button asChild variant="ghost" className="justify-start">
              <Link href="/account/orders">All orders</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="container py-16">
          <Skeleton className="mx-auto h-40 max-w-2xl" />
        </div>
      }
    >
      <OrderDetailInner />
    </Suspense>
  );
}
