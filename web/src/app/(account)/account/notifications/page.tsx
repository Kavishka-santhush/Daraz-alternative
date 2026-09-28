'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Trash2, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { useNotifications, useMarkNotificationsRead, useDeleteNotification } from '@/hooks/use-account';
import { timeAgo, cn } from '@/lib/utils';
import type { NotificationItem } from '@/types';

function Row({ n }: { n: NotificationItem }) {
  const mark = useMarkNotificationsRead();
  const del = useDeleteNotification();
  const inner = (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
          n.isRead ? 'bg-transparent' : 'bg-brand',
        )}
      />
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm', n.isRead ? 'text-muted-foreground' : 'font-medium')}>
          {n.title}
        </p>
        {n.body && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{n.body}</p>}
        <p className="mt-1 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!n.isRead && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Mark as read"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              mark.one.mutate(n.id);
            }}
          >
            <Check className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          aria-label="Delete notification"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            del.mutate(n.id);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return n.actionUrl ? (
    <Link href={n.actionUrl} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export default function NotificationsPage() {
  const [page] = useState(1);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const { data, isLoading } = useNotifications(page);
  const markAll = useMarkNotificationsRead().all;

  const all = data?.items ?? [];
  const items = onlyUnread ? all.filter((n) => !n.isRead) : all;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">Order updates, offers and account activity.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={onlyUnread ? 'brand' : 'outline'}
            size="sm"
            onClick={() => setOnlyUnread((v) => !v)}
          >
            Unread only
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={onlyUnread ? 'No unread notifications' : "You're all caught up"}
          description="We'll let you know about order updates, price drops and offers here."
        />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {items.map((n) => (
              <div key={n.id} className={cn('px-4 py-3', !n.isRead && 'bg-brand/[0.03]')}>
                <Row n={n} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
