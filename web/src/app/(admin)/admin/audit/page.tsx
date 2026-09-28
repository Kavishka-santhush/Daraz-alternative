'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ScrollText, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { Pagination } from '@/components/shared/pagination';
import { useAuditLogs } from '@/hooks/use-admin';
import { formatDate } from '@/lib/utils';
import type { AuditLogRow } from '@/types';

const ENTITY_TYPES = ['', 'USER', 'SELLER', 'PRODUCT', 'ORDER', 'RETURN', 'PAYMENT', 'PAYOUT', 'TICKET', 'VOUCHER', 'SETTINGS'];

function LogRow({ log }: { log: AuditLogRow }) {
  const [open, setOpen] = useState(false);
  const hasDiff = Boolean(log.before || log.after);
  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!hasDiff}
          onClick={() => setOpen((v) => !v)}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent disabled:opacity-30"
          aria-label="Toggle details"
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{log.action}</p>
          <p className="truncate text-xs text-muted-foreground">
            {log.entityType} · {log.entityId ?? '—'} · {log.actor?.name ?? log.actorId} · {formatDate(log.createdAt)}
            {log.ip ? ` · ${log.ip}` : ''}
          </p>
        </div>
      </div>
      {open && hasDiff && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Before</p>
            <pre className="max-h-52 overflow-auto rounded-md bg-muted p-2 text-xs">{JSON.stringify(log.before ?? {}, null, 2)}</pre>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">After</p>
            <pre className="max-h-52 overflow-auto rounded-md bg-muted p-2 text-xs">{JSON.stringify(log.after ?? {}, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function Inner() {
  const router = useRouter();
  const search = useSearchParams();
  const entityType = search.get('entityType') ?? '';
  const page = Number(search.get('page') ?? 1);
  const { data, isLoading } = useAuditLogs({ entityType: entityType || undefined, page });

  const setType = (value: string) => {
    const sp = new URLSearchParams();
    if (value) sp.set('entityType', value);
    router.push(`/admin/audit${sp.toString() ? `?${sp.toString()}` : ''}`);
  };

  const meta = data?.meta;
  const pages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;
  const href = (p: number) =>
    `/admin/audit?${new URLSearchParams({ ...(entityType ? { entityType } : {}), page: String(p) }).toString()}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Audit log</h1>
        <p className="text-sm text-muted-foreground">Track staff actions across the platform.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {ENTITY_TYPES.map((t) => (
          <Button key={t || 'all'} variant={entityType === t ? 'brand' : 'outline'} size="sm" onClick={() => setType(t)}>
            {t || 'All'}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={ScrollText} title="No activity" description="No audit entries for this filter." />
      ) : (
        <>
          <Card>
            <CardContent className="divide-y p-0">
              {data.items.map((l) => (
                <LogRow key={l.id} log={l} />
              ))}
            </CardContent>
          </Card>
          <Pagination page={page} pages={pages} href={href} />
        </>
      )}
    </div>
  );
}

export default function AdminAuditPage() {
  return (
    <Suspense fallback={<div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>}>
      <Inner />
    </Suspense>
  );
}
