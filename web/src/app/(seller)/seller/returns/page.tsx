'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { RotateCcw, Loader2, Check, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Pagination } from '@/components/shared/pagination';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useSellerReturns, useReturnDecision } from '@/hooks/use-seller';
import { formatMoney, num, formatDate } from '@/lib/utils';
import type { ReturnRequestRow } from '@/types';

function ReturnsInner() {
  const search = useSearchParams();
  const page = Number(search.get('page') ?? 1);
  const { data, isLoading } = useSellerReturns(page);
  const decision = useReturnDecision();

  const [rejectTarget, setRejectTarget] = useState<ReturnRequestRow | null>(null);
  const [note, setNote] = useState('');

  const meta = data?.meta;
  const pages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;
  const href = (p: number) => {
    const sp = new URLSearchParams(search.toString());
    if (p > 1) sp.set('page', String(p));
    else sp.delete('page');
    return `/seller/returns?${sp.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Returns</h1>
        <p className="text-sm text-muted-foreground">Review and decide on customer return requests.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={RotateCcw} title="No return requests" description="Returns raised against your shop will appear here." />
      ) : (
        <>
          <div className="space-y-4">
            {data.items.map((r) => (
              <Card key={r.id}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{r.returnNumber}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.subOrder?.shop?.name ?? 'Shop'} · {formatDate(r.createdAt)}
                    </span>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <CardContent className="space-y-3 p-4">
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <p>
                      <span className="text-muted-foreground">Reason: </span>
                      {r.reason}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Requested refund: </span>
                      <span className="font-semibold">{formatMoney(num(r.requestedRefund))}</span>
                      {r.isPartial && <span className="ml-1 text-xs text-muted-foreground">(partial)</span>}
                    </p>
                  </div>
                  {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}

                  {(r.items ?? []).length > 0 && (
                    <ul className="list-inside list-disc text-sm text-muted-foreground">
                      {r.items!.map((it) => (
                        <li key={it.id}>
                          {it.quantity} × item · {it.reason ?? r.reason}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                    <Link href={`/seller/orders?status=DELIVERED`} className="text-sm text-brand hover:underline">
                      View related orders
                    </Link>
                    {r.status === 'REQUESTED' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          disabled={decision.isPending}
                          onClick={() => {
                            setNote('');
                            setRejectTarget(r);
                          }}
                        >
                          <X className="mr-1 h-4 w-4" /> Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="brand"
                          disabled={decision.isPending}
                          onClick={() => decision.mutate({ id: r.id, decision: 'approve' })}
                        >
                          {decision.isPending ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="mr-1 h-4 w-4" />
                          )}
                          Approve
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Pagination page={page} pages={pages} href={href} />
        </>
      )}

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject return request</DialogTitle>
            <DialogDescription>Explain why this return is being rejected — the customer will be notified.</DialogDescription>
          </DialogHeader>
          <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for rejection…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={decision.isPending || !note.trim()}
              onClick={() => {
                if (rejectTarget)
                  decision.mutate(
                    { id: rejectTarget.id, decision: 'reject', note },
                    { onSuccess: () => setRejectTarget(null) },
                  );
              }}
            >
              {decision.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SellerReturnsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-8 w-40" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      }
    >
      <ReturnsInner />
    </Suspense>
  );
}
