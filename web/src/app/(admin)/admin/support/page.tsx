'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LifeBuoy, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Pagination } from '@/components/shared/pagination';
import { StatCard } from '@/components/shared/stat-card';
import { useStaffTickets, useTicketStats } from '@/hooks/use-admin';
import { formatDate } from '@/lib/utils';

const TABS = [
  { label: 'Open', value: 'OPEN' },
  { label: 'In progress', value: 'IN_PROGRESS' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Closed', value: 'CLOSED' },
  { label: 'All', value: '' },
];

const PRIORITY_TONE: Record<string, string> = {
  URGENT: 'text-red-600',
  HIGH: 'text-orange-600',
  MEDIUM: 'text-amber-600',
  LOW: 'text-muted-foreground',
};

function Inner() {
  const router = useRouter();
  const search = useSearchParams();
  const status = search.get('status') ?? 'OPEN';
  const mine = search.get('mine') === '1';
  const page = Number(search.get('page') ?? 1);
  const { data, isLoading } = useStaffTickets({ status: status || undefined, mine, page });
  const { data: stats } = useTicketStats();

  const [q, setQ] = useState('');

  const build = (over: Record<string, string>) => {
    const sp = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(over)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    return sp.toString();
  };

  const setTab = (value: string) => router.push(`/admin/support?${build({ status: value, page: '', q: '' })}`);
  const toggleMine = () => router.push(`/admin/support?${build({ mine: mine ? '' : '1', page: '' })}`);

  const meta = data?.meta;
  const pages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;
  const href = (p: number) => `/admin/support?${build({ page: String(p) })}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Support queue</h1>
        <p className="text-sm text-muted-foreground">Customer tickets awaiting staff response.</p>
      </div>

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Open" value={stats.open} />
          <StatCard label="In progress" value={stats.inProgress} />
          <StatCard label="Resolved today" value={stats.resolvedToday} />
          <StatCard label="Unassigned" value={stats.unassigned} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Button key={t.value || 'all'} variant={status === t.value ? 'brand' : 'outline'} size="sm" onClick={() => setTab(t.value)}>
            {t.label}
          </Button>
        ))}
        <Button variant={mine ? 'brand' : 'outline'} size="sm" className="ml-auto" onClick={toggleMine}>
          Assigned to me
        </Button>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/admin/support?${build({ q, page: '' })}`);
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tickets…" className="h-9 w-48" />
          <Button type="submit" variant="outline" size="sm">
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="No tickets" description="The queue is clear for this filter." />
      ) : (
        <>
          <Card>
            <CardContent className="divide-y p-0">
              {data.items.map((t) => (
                <Link key={t.id} href={`/admin/support/${t.id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-accent/50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {t.ticketNumber} · {t.subject}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.creator.name} · {t.type.replace('_', ' ').toLowerCase()} · {formatDate(t.createdAt)}
                    </p>
                  </div>
                  <span className={`w-16 text-xs font-medium capitalize ${PRIORITY_TONE[t.priority] ?? ''}`}>
                    {t.priority.toLowerCase()}
                  </span>
                  <div className="w-28">
                    <StatusBadge status={t.status} />
                  </div>
                  <span className="w-24 truncate text-right text-xs text-muted-foreground">
                    {t.assignedTo ? t.assignedTo.name : 'Unassigned'}
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
          <Pagination page={page} pages={pages} href={href} />
        </>
      )}
    </div>
  );
}

export default function AdminSupportPage() {
  return (
    <Suspense fallback={<div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>}>
      <Inner />
    </Suspense>
  );
}
