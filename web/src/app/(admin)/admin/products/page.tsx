'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Package, Loader2, Check, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { Pagination } from '@/components/shared/pagination';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { usePendingProducts, useModerateProduct } from '@/hooks/use-admin';
import { formatMoney, num } from '@/lib/utils';
import { mediaUrl } from '@/lib/env';
import type { Product } from '@/types';

function Inner() {
  const router = useRouter();
  const search = useSearchParams();
  const page = Number(search.get('page') ?? 1);
  const { data, isLoading } = usePendingProducts({ page });
  const moderate = useModerateProduct();

  const [rejectTarget, setRejectTarget] = useState<Product | null>(null);
  const [reason, setReason] = useState('');

  const meta = data?.meta;
  const pages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;
  const href = (p: number) => `/admin/products?page=${p}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Product review</h1>
        <p className="text-sm text-muted-foreground">Approve or reject listings awaiting moderation.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={Package} title="Queue is clear" description="No products are waiting for review." />
      ) : (
        <>
          <Card>
            <CardContent className="divide-y p-0">
              {data.items.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted">
                    {p.images?.[0]?.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl(p.images[0].url)} alt={p.title} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/product/${p.slug}`} target="_blank" className="truncate font-medium hover:text-brand hover:underline">
                      {p.title}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.shop?.name} · {p.category?.name} · {formatMoney(num(p.salePrice ?? p.originalPrice))} · SKU {p.sku}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      disabled={moderate.isPending}
                      onClick={() => {
                        setReason('');
                        setRejectTarget(p);
                      }}
                    >
                      <X className="mr-1 h-4 w-4" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="brand"
                      disabled={moderate.isPending}
                      onClick={() => moderate.mutate({ id: p.id, action: 'approve' })}
                    >
                      {moderate.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                      Approve
                    </Button>
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
            <DialogTitle>Reject listing</DialogTitle>
            <DialogDescription>{rejectTarget?.title}</DialogDescription>
          </DialogHeader>
          <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this being rejected?" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={moderate.isPending || !reason.trim()}
              onClick={() => {
                if (rejectTarget) moderate.mutate({ id: rejectTarget.id, action: 'reject', reason }, { onSuccess: () => setRejectTarget(null) });
              }}
            >
              {moderate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminProductsPage() {
  return (
    <Suspense fallback={<div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>}>
      <Inner />
    </Suspense>
  );
}
