'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { HandCoins, Loader2, Check, X, Truck } from 'lucide-react';
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
import { usePayoutQueue, useBreakdown, useReviewPayout, useProcessPayout } from '@/hooks/use-admin';
import { formatMoney, num, formatDate } from '@/lib/utils';
import type { PayoutQueueRow } from '@/types';

const TABS = [
  { label: 'Requested', value: 'REQUESTED' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Processed', value: 'PROCESSED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'All', value: '' },
];

function Inner() {
  const router = useRouter();
  const search = useSearchParams();
  const status = search.get('status') ?? 'REQUESTED';
  const page = Number(search.get('page') ?? 1);
  const { data, isLoading } = usePayoutQueue({ status: status || undefined, page });
  const { data: breakdown } = useBreakdown();
  const review = useReviewPayout();
  const process = useProcessPayout();

  const [rejectTarget, setRejectTarget] = useState<PayoutQueueRow | null>(null);
  const [note, setNote] = useState('');

  const setTab = (value: string) => {
    const sp = new URLSearchParams();
    if (value) sp.set('status', value);
    router.push(`/admin/payouts${sp.toString() ? `?${sp.toString()}` : ''}`);
  };

  const meta = data?.meta;
  const pages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;
  const href = (p: number) =>
    `/admin/payouts?${new URLSearchParams({ ...(status ? { status } : {}), page: String(p) }).toString()}`;

  const sellerLabel = (r: PayoutQueueRow) => r.seller?.user?.name ?? r.seller?.user?.email ?? r.sellerId;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Payouts</h1>
        <p className="text-sm text-muted-foreground">Review seller withdrawal requests and mark transfers.</p>
      </div>

      {breakdown && breakdown.length > 0 && (
        <div className="flex flex-wrap gap-3 text-sm">
          {breakdown.map((b) => (
            <span key={b.status} className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1">
              <StatusBadge status={b.status} />
              <span className="text-muted-foreground">{b.count}</span>
              <span className="font-semibold">{formatMoney(num(b.amount))}</span>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button key={t.value || 'all'} variant={status === t.value ? 'brand' : 'outline'} size="sm" onClick={() => setTab(t.value)}>
            {t.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={HandCoins} title="No payouts" description="No withdrawal requests in this state." />
      ) : (
        <>
          <Card>
            <CardContent className="divide-y p-0">
              {data.items.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {r.payoutNumber} · {formatMoney(num(r.amount))}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {sellerLabel(r)} · {r.bankName} ••••{r.bankAccountNo.slice(-4)} · {r.accountHolder} · {formatDate(r.createdAt)}
                    </p>
                  </div>
                  <div className="w-28">
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {r.status === 'REQUESTED' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          disabled={review.isPending}
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
                          disabled={review.isPending}
                          onClick={() => review.mutate({ id: r.id, decision: 'approve' })}
                        >
                          {review.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                          Approve
                        </Button>
                      </>
                    )}
                    {r.status === 'APPROVED' && (
                      <Button
                        size="sm"
                        variant="brand"
                        disabled={process.isPending}
                        onClick={() => process.mutate(r.id)}
                      >
                        {process.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Truck className="mr-1 h-4 w-4" />}
                        Mark transferred
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Pagination page={page} pages={pages} href={href} />
        </>
      )}

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject payout</DialogTitle>
            <DialogDescription>{rejectTarget?.payoutNumber}</DialogDescription>
          </DialogHeader>
          <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for rejection…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={review.isPending || !note.trim()}
              onClick={() => {
                if (rejectTarget) review.mutate({ id: rejectTarget.id, decision: 'reject', note }, { onSuccess: () => setRejectTarget(null) });
              }}
            >
              {review.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminPayoutsPage() {
  return (
    <Suspense fallback={<div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>}>
      <Inner />
    </Suspense>
  );
}
