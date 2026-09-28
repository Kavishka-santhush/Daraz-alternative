'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Boxes, Pencil, Trash2, Plus, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Pagination } from '@/components/shared/pagination';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSellerProducts, useArchiveProduct, useSetProductStock } from '@/hooks/use-seller';
import { formatMoney, num } from '@/lib/utils';
import { mediaUrl } from '@/lib/env';
import type { Product } from '@/types';

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Pending review', value: 'PENDING_REVIEW' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Out of stock', value: 'OUT_OF_STOCK' },
  { label: 'Archived', value: 'ARCHIVED' },
];

/** Inline stock editor with local draft value to avoid parent re-render churn. */
function StockCell({ product }: { product: Product }) {
  const setStock = useSetProductStock();
  const [qty, setQty] = useState(String(product.stockQuantity));
  const dirty = qty !== String(product.stockQuantity);

  return (
    <div className="flex items-center gap-1.5">
      <Input
        value={qty}
        onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ''))}
        inputMode="numeric"
        className="h-8 w-16 text-sm"
        aria-label={`Stock for ${product.title}`}
      />
      {dirty && (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-brand"
          disabled={setStock.isPending}
          onClick={() => setStock.mutate({ id: product.id, quantity: Number(qty) || 0 })}
        >
          {setStock.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
        </Button>
      )}
    </div>
  );
}

function ProductsInner() {
  const router = useRouter();
  const search = useSearchParams();
  const status = search.get('status') ?? '';
  const q = search.get('q') ?? '';
  const page = Number(search.get('page') ?? 1);
  const archive = useArchiveProduct();

  const { data, isLoading } = useSellerProducts({
    status: status || undefined,
    q: q || undefined,
    page,
  });

  const [confirm, setConfirm] = useState<Product | null>(null);

  const applyQuery = (next: Record<string, string>) => {
    const sp = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    if (!('page' in next)) sp.delete('page');
    router.push(`/seller/products?${sp.toString()}`);
  };

  const meta = data?.meta;
  const pages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;
  const href = (p: number) => {
    const sp = new URLSearchParams(search.toString());
    if (p > 1) sp.set('page', String(p));
    else sp.delete('page');
    return `/seller/products?${sp.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground">Manage your catalogue, pricing and stock.</p>
        </div>
        <Button asChild variant="brand">
          <Link href="/seller/products/new">
            <Plus className="mr-2 h-4 w-4" /> Add product
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((t) => (
          <Button
            key={t.value || 'all'}
            variant={status === t.value ? 'brand' : 'outline'}
            size="sm"
            onClick={() => applyQuery({ status: t.value })}
          >
            {t.label}
          </Button>
        ))}
        <form
          className="ml-auto flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            applyQuery({ q: String(form.get('q') ?? '') });
          }}
        >
          <Input name="q" defaultValue={q} placeholder="Search products…" className="h-9 w-48" />
          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
        </form>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No products found"
          description={q || status ? 'Try adjusting your filters.' : 'Add your first product to start selling.'}
          action={
            <Button asChild variant="brand">
              <Link href="/seller/products/new">Add product</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {data.items.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                      {p.images?.[0]?.url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrl(p.images[0].url)} alt={p.title} className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.title}</p>
                      <p className="truncate text-xs text-muted-foreground">SKU {p.sku}</p>
                    </div>
                    <div className="w-24 text-sm">
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="w-28 text-sm font-semibold">{formatMoney(num(p.salePrice ?? p.originalPrice))}</div>
                    <div className="w-40">
                      <StockCell product={p} />
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                        <Link href={`/seller/products/${p.id}`} aria-label="Edit product">
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      {p.status !== 'ARCHIVED' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          aria-label="Archive product"
                          onClick={() => setConfirm(p)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Pagination page={page} pages={pages} href={href} />
        </>
      )}

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive product?</DialogTitle>
            <DialogDescription>
              {confirm?.title} will be hidden from your storefront. You can recreate it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={archive.isPending}
              onClick={() => {
                if (confirm) archive.mutate(confirm.id, { onSettled: () => setConfirm(null) });
              }}
            >
              {archive.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SellerProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-8 w-40" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      }
    >
      <ProductsInner />
    </Suspense>
  );
}
