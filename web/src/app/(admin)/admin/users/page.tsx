'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Pagination } from '@/components/shared/pagination';
import { useAdminUsers, useSetUserStatus } from '@/hooks/use-admin';
import { formatDate } from '@/lib/utils';
import type { AdminUserRow, UserStatus } from '@/types';

const ROLE_OPTIONS = ['', 'BUYER', 'SELLER', 'SUPPORT_AGENT', 'OPERATIONS_MANAGER', 'FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'];

function Row({ user }: { user: AdminUserRow }) {
  const setStatus = useSetUserStatus();
  const [busy, setBusy] = useState(false);

  const change = (status: string) => {
    if (!status || status === user.status) return;
    setBusy(true);
    setStatus.mutate(
      { id: user.id, status: status as UserStatus },
      { onSettled: () => setBusy(false) },
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <Link href={`/admin/users/${user.id}`} className="truncate font-medium hover:text-brand hover:underline">
          {user.name}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {user.email} · joined {formatDate(user.createdAt)} · {user._count.orders} orders
        </p>
      </div>
      <span className="w-24 text-sm capitalize">{user.role.replace('_', ' ').toLowerCase()}</span>
      <div className="w-28">
        <StatusBadge status={user.status} />
      </div>
      <div className="relative w-40">
        <select
          defaultValue=""
          disabled={busy}
          onChange={(e) => change(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
          aria-label={`Change status for ${user.name}`}
        >
          <option value="" disabled>
            Change status…
          </option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="BANNED">Banned</option>
          <option value="PENDING_VERIFICATION">Pending</option>
        </select>
        {busy && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
    </div>
  );
}

function Inner() {
  const router = useRouter();
  const search = useSearchParams();
  const role = search.get('role') ?? '';
  const page = Number(search.get('page') ?? 1);
  const { data, isLoading } = useAdminUsers({ role: role || undefined, page });

  const [q, setQ] = useState('');

  const setRole = (value: string) => {
    const sp = new URLSearchParams(search.toString());
    if (value) sp.set('role', value);
    else sp.delete('role');
    sp.delete('page');
    router.push(`/admin/users?${sp.toString()}`);
  };

  const meta = data?.meta;
  const pages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;
  const href = (p: number) => {
    const sp = new URLSearchParams(search.toString());
    if (p > 1) sp.set('page', String(p));
    else sp.delete('page');
    return `/admin/users?${sp.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-sm text-muted-foreground">Search accounts and manage their status.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const sp = new URLSearchParams(search.toString());
            if (q) sp.set('search', q);
            else sp.delete('search');
            sp.delete('page');
            router.push(`/admin/users?${sp.toString()}`);
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or phone…" className="h-9 w-56" />
          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
        </form>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="ml-auto h-9 rounded-md border border-input bg-background px-2 text-sm"
          aria-label="Filter by role"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r || 'all'} value={r}>
              {r ? r.replace('_', ' ') : 'All roles'}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={Users} title="No users" description="No accounts match your filters." />
      ) : (
        <>
          <Card>
            <CardContent className="divide-y p-0">
              {data.items.map((u) => (
                <Row key={u.id} user={u} />
              ))}
            </CardContent>
          </Card>
          <Pagination page={page} pages={pages} href={href} />
        </>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>}>
      <Inner />
    </Suspense>
  );
}
