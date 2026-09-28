'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldAlert, Loader2 } from 'lucide-react';
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
import { useFraudAlerts, useReviewFraud } from '@/hooks/use-admin';
import { formatDate } from '@/lib/utils';
import type { FraudAlertRow, FraudStatusValue } from '@/types';

const TABS: { label: string; value: string }[] = [
  { label: 'Flagged', value: 'FLAGGED' },
  { label: 'Reviewing', value: 'REVIEWING' },
  { label: 'Cleared', value: 'CLEARED' },
  { label: 'Action taken', value: 'ACTION_TAKEN' },
  { label: 'All', value: '' },
];

function scoreStyle(score: number) {
  if (score >= 0.75) return 'bg-destructive text-white';
  if (score >= 0.5) return 'bg-amber-500 text-white';
  return 'bg-emerald-500 text-white';
}

function AlertRow({ alert, onReview }: { alert: FraudAlertRow; onReview: (a: FraudAlertRow) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <div
        className={`flex h-10 w-14 shrink-0 items-center justify-center rounded-md text-sm font-bold ${scoreStyle(alert.score)}`}
        title={`Risk score ${Math.round(alert.score * 100)}%`}
      >
        {Math.round(alert.score * 100)}%
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{alert.signal}</p>
        <p className="truncate text-xs text-muted-foreground">
          {alert.subjectType} · {alert.subjectId} · {formatDate(alert.createdAt)}
        </p>
      </div>
      <div className="w-28">
        <StatusBadge status={alert.status} />
      </div>
      <Button size="sm" variant="outline" onClick={() => onReview(alert)}>
        Review
      </Button>
    </div>
  );
}

function Inner() {
  const router = useRouter();
  const search = useSearchParams();
  const status = search.get('status') ?? 'FLAGGED';
  const page = Number(search.get('page') ?? 1);
  const { data, isLoading } = useFraudAlerts({ status: status || undefined, page });
  const review = useReviewFraud();

  const [target, setTarget] = useState<FraudAlertRow | null>(null);
  const [decision, setDecision] = useState<FraudStatusValue>('CLEARED');
  const [actionTaken, setActionTaken] = useState('');

  const setTab = (value: string) => {
    const sp = new URLSearchParams();
    if (value) sp.set('status', value);
    router.push(`/admin/fraud${sp.toString() ? `?${sp.toString()}` : ''}`);
  };

  const meta = data?.meta;
  const pages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;
  const href = (p: number) =>
    `/admin/fraud?${new URLSearchParams({ ...(status ? { status } : {}), page: String(p) }).toString()}`;

  const openReview = (a: FraudAlertRow) => {
    setDecision(a.status === 'FLAGGED' ? 'REVIEWING' : a.status);
    setActionTaken('');
    setTarget(a);
  };

  const submit = () => {
    if (!target) return;
    review.mutate(
      { id: target.id, status: decision, actionTaken: actionTaken.trim() || undefined },
      { onSuccess: () => setTarget(null) },
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Fraud alerts</h1>
        <p className="text-sm text-muted-foreground">Review automated risk signals across sellers, orders and accounts.</p>
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
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="No alerts" description="Nothing flagged in this state." />
      ) : (
        <>
          <Card>
            <CardContent className="divide-y p-0">
              {data.items.map((a) => (
                <AlertRow key={a.id} alert={a} onReview={openReview} />
              ))}
            </CardContent>
          </Card>
          <Pagination page={page} pages={pages} href={href} />
        </>
      )}

      <Dialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review fraud alert</DialogTitle>
            <DialogDescription>
              {target?.signal} · risk {target ? Math.round(target.score * 100) : 0}%
            </DialogDescription>
          </DialogHeader>

          {target?.details && (
            <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(target.details, null, 2)}
            </pre>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Decision</p>
            <div className="flex flex-wrap gap-2">
              {(['REVIEWING', 'CLEARED', 'ACTION_TAKEN'] as FraudStatusValue[]).map((s) => (
                <Button key={s} size="sm" variant={decision === s ? 'brand' : 'outline'} onClick={() => setDecision(s)}>
                  {s === 'ACTION_TAKEN' ? 'Action taken' : s.charAt(0) + s.slice(1).toLowerCase()}
                </Button>
              ))}
            </div>
          </div>

          {decision === 'ACTION_TAKEN' && (
            <Textarea
              rows={3}
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              placeholder="Describe the action taken…"
            />
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              disabled={review.isPending || (decision === 'ACTION_TAKEN' && !actionTaken.trim())}
              onClick={submit}
            >
              {review.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminFraudPage() {
  return (
    <Suspense fallback={<div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>}>
      <Inner />
    </Suspense>
  );
}
