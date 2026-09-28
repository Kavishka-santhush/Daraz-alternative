'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Ban, ShieldCheck, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/status-badge';
import { useAdminUserDetail, useSetUserStatus } from '@/hooks/use-admin';
import { formatMoney, num, formatDate } from '@/lib/utils';
import type { UserStatus } from '@/types';

export default function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const { data, isLoading } = useAdminUserDetail(params.id);
  const setStatus = useSetUserStatus();
  const [busy, setBusy] = useState<string | null>(null);

  const act = (status: UserStatus) => {
    if (!data) return;
    setBusy(status);
    setStatus.mutate({ id: data.id, status }, { onSettled: () => setBusy(null) });
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All users
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            {data.name} <StatusBadge status={data.status} />
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.email} · {data.phone ?? 'no phone'} · joined {formatDate(data.createdAt)}
          </p>
        </div>
        <div className="flex gap-2">
          {data.status !== 'ACTIVE' && (
            <Button size="sm" variant="outline" disabled={busy === 'ACTIVE'} onClick={() => act('ACTIVE')}>
              {busy === 'ACTIVE' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1 h-4 w-4" />}
              Activate
            </Button>
          )}
          {data.status !== 'SUSPENDED' && (
            <Button size="sm" variant="outline" disabled={busy === 'SUSPENDED'} onClick={() => act('SUSPENDED')}>
              {busy === 'SUSPENDED' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Ban className="mr-1 h-4 w-4" />}
              Suspend
            </Button>
          )}
          {data.status !== 'BANNED' && (
            <Button size="sm" variant="destructive" disabled={busy === 'BANNED'} onClick={() => act('BANNED')}>
              {busy === 'BANNED' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
              Ban
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Role</p>
            <p className="mt-1 font-semibold capitalize">{data.role.replace('_', ' ').toLowerCase()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Orders</p>
            <p className="mt-1 font-semibold">{data._count.orders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Wallet</p>
            <p className="mt-1 font-semibold">{formatMoney(num(data.wallet?.balance ?? 0))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Loyalty</p>
            <p className="mt-1 font-semibold">{data.loyaltyPoints} pts · {data.coins} coins</p>
          </CardContent>
        </Card>
      </div>

      {data.sellerProfile && (
        <Card>
          <CardHeader>
            <CardTitle>Seller profile</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 text-sm">
            <StatusBadge status={data.sellerProfile.status} />
            <span className="capitalize">Tier: {data.sellerProfile.tier.toLowerCase()}</span>
            {data.sellerProfile.shop && (
              <Link href={`/shops/${data.sellerProfile.shop.slug}`} className="text-brand hover:underline">
                {data.sellerProfile.shop.name}
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent logins</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(data.loginHistory ?? []).length === 0 ? (
              <p className="text-muted-foreground">No login history.</p>
            ) : (
              data.loginHistory!.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2 border-b pb-2 last:border-0">
                  <span className="truncate">{l.ip ?? 'unknown ip'}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {l.success ? 'success' : 'failed'} · {formatDate(l.createdAt)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Reviews</dt>
              <dd className="text-right font-medium">{data._count.reviews}</dd>
              <dt className="text-muted-foreground">Tickets</dt>
              <dd className="text-right font-medium">{data._count.tickets}</dd>
              <dt className="text-muted-foreground">Email verified</dt>
              <dd className="text-right font-medium">{data.emailVerifiedAt ? 'Yes' : 'No'}</dd>
              <dt className="text-muted-foreground">Last login</dt>
              <dd className="text-right font-medium">{data.lastLoginAt ? formatDate(data.lastLoginAt) : '—'}</dd>
              <dt className="text-muted-foreground">Referral code</dt>
              <dd className="text-right font-medium">{data.referralCode}</dd>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
