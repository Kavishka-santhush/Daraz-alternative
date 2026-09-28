'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Store, Loader2, FileText, Check, X, BadgeCheck } from 'lucide-react';
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
import { useSellerApplications, useReviewSeller } from '@/hooks/use-admin';
import { formatDate } from '@/lib/utils';
import type { AdminSellerApplication } from '@/types';

const TABS = [
  { label: 'Pending', value: 'PENDING_APPROVAL' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'All', value: '' },
];

function Inner() {
  const router = useRouter();
  const search = useSearchParams();
  const status = search.get('status') ?? 'PENDING_APPROVAL';
  const page = Number(search.get('page') ?? 1);
  const { data, isLoading } = useSellerApplications({ status: status || undefined, page });
  const review = useReviewSeller();

  const [rejectTarget, setRejectTarget] = useState<AdminSellerApplication | null>(null);
  const [reason, setReason] = useState('');

  const setTab = (value: string) => {
    const sp = new URLSearchParams();
    if (value) sp.set('status', value);
    router.push(`/admin/sellers${sp.toString() ? `?${sp.toString()}` : ''}`);
  };

  const meta = data?.meta;
  const pages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;
  const href = (p: number) => `/admin/sellers?${new URLSearchParams({ ...(status ? { status } : {}), page: String(p) }).toString()}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Seller approvals</h1>
        <p className="text-sm text-muted-foreground">Review applications and business documents.</p>
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
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={Store} title="Nothing here" description="No applications match this filter." />
      ) : (
        <>
          <div className="space-y-4">
            {data.items.map((s) => (
              <Card key={s.id}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{s.user.name}</p>
                        {s.isVerified && <BadgeCheck className="h-4 w-4 text-brand" />}
                        <StatusBadge status={s.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">{s.user.email} · applied {formatDate(s.createdAt)}</p>
                      <p className="mt-1 text-sm">
                        {s.shops.length ? s.shops.map((x) => x.name).join(', ') : 'No shop named'}
                      </p>
                    </div>
                    {s.status === 'PENDING_APPROVAL' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          disabled={review.isPending}
                          onClick={() => {
                            setReason('');
                            setRejectTarget(s);
                          }}
                        >
                          <X className="mr-1 h-4 w-4" /> Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="brand"
                          disabled={review.isPending}
                          onClick={() => review.mutate({ sellerId: s.id, decision: 'approve' })}
                        >
                          {review.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                          Approve
                        </Button>
                      </div>
                    )}
                  </div>

                  {s.documents.length > 0 && (
                    <div className="flex flex-wrap gap-2 border-t pt-3">
                      {s.documents.map((d) => (
                        <a
                          key={d.id}
                          href={d.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {d.type} · <StatusBadge status={d.status} />
                        </a>
                      ))}
                    </div>
                  )}
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
            <DialogTitle>Reject application</DialogTitle>
            <DialogDescription>Tell the seller what's missing or wrong with their application.</DialogDescription>
          </DialogHeader>
          <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for rejection…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={review.isPending || !reason.trim()}
              onClick={() => {
                if (rejectTarget) review.mutate({ sellerId: rejectTarget.id, decision: 'reject', reason }, { onSuccess: () => setRejectTarget(null) });
              }}
            >
              {review.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminSellersPage() {
  return (
    <Suspense fallback={<div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>}>
      <Inner />
    </Suspense>
  );
}
