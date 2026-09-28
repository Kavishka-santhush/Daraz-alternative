'use client';

import Link from 'next/link';
import { Heart, Trash2, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { ProductCard } from '@/components/shared/product-card';
import { useWishlist, useToggleWishlist } from '@/hooks/use-account';
import { formatMoney, num } from '@/lib/utils';
import type { WishlistItem } from '@/types';

function WishlistCard({ item }: { item: WishlistItem }) {
  const toggle = useToggleWishlist();
  const remove = () =>
    toggle.mutate(item.product.id, {
      onSuccess: () => toast.success('Removed from wishlist'),
    });

  return (
    <div className="relative">
      {item.priceDropped && (
        <Badge variant="success" className="absolute -top-2 left-2 z-10 shadow-sm">
          <TrendingDown className="mr-1 h-3 w-3" />
          Price drop
        </Badge>
      )}
      <ProductCard product={item.product} />
      <button
        type="button"
        onClick={remove}
        disabled={toggle.isPending}
        aria-label="Remove from wishlist"
        className="absolute bottom-[5.5rem] right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-500 shadow-sm transition-colors hover:text-destructive disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      {item.priceDropped && (
        <p className="px-3 text-xs text-muted-foreground">
          Was {formatMoney(num(item.priceAtAdd))} · now{' '}
          <span className="font-semibold text-brand">{formatMoney(num(item.currentPrice))}</span>
        </p>
      )}
    </div>
  );
}

export default function WishlistPage() {
  const { data, isLoading } = useWishlist(1);
  const items = data?.items ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">My wishlist</h1>
        <p className="text-sm text-muted-foreground">
          Saved products and alerts when prices drop.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Your wishlist is empty"
          description="Tap the heart on any product to save it here and track price changes."
          action={
            <Button asChild variant="brand">
              <Link href="/">Browse products</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 pt-2 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <WishlistCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
