'use client';

import Link from 'next/link';
import { RotateCcw, Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { useMyReturns } from '@/hooks/use-account';
import { formatMoney, num, formatDate } from '@/lib/utils';

export default function ReturnsPage() {
  const { data, isLoading } = useMyReturns(1);
  const items = data?.items ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Returns &amp; refunds</h1>
        <p className="text-sm text-muted-foreground">
          Track the status of your return requests.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={RotateCcw}
          title="No return requests"
          description="Open a delivered order to start a return within its eligible window."
          action={
            <Button asChild variant="brand">
              <Link href="/account/orders">Go to my orders</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {items.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <RotateCcw className="h-4 w-4 text-brand" />
                  {r.returnNumber}
                </div>
                <StatusBadge status={r.status} />
              </div>
              <CardContent className="space-y-3 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    Sub-order{' '}
                    <span className="font-medium text-foreground">
                      {r.subOrder?.subOrderNumber ?? r.subOrderId}
                    </span>
                    {r.subOrder?.shop?.name ? ` · ${r.subOrder.shop.name}` : ''}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Requested {formatDate(r.createdAt)}
                  </span>
                </div>
                <p>
                  <span className="text-muted-foreground">Reason: </span>
                  {r.reason}
                </p>
                {r.description && (
                  <p className="line-clamp-3 text-muted-foreground">{r.description}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Package className="h-3.5 w-3.5" />
                  {(r.items ?? []).length} item(s) ·{' '}
                  {r.isPartial ? 'Partial' : 'Full'} return
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <span className="text-muted-foreground">
                    Refund requested:{' '}
                    <span className="font-semibold text-foreground">
                      {formatMoney(num(r.requestedRefund))}
                    </span>
                  </span>
                  {r.approvedRefund != null && (
                    <span className="text-muted-foreground">
                      Approved:{' '}
                      <span className="font-semibold text-brand">
                        {formatMoney(num(r.approvedRefund))}
                      </span>
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
