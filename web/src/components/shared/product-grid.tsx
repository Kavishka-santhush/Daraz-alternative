import { PackageSearch } from 'lucide-react';
import { ProductCard } from '@/components/shared/product-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Product } from '@/types';

interface ProductGridProps {
  products?: Product[];
  isLoading?: boolean;
  skeletonCount?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  cols?: string;
}

/** Responsive product grid with loading skeletons and an empty state. */
export function ProductGrid({
  products,
  isLoading,
  skeletonCount = 8,
  emptyTitle = 'No products found',
  emptyDescription = 'Try adjusting your filters or search for something else.',
  className,
  cols,
}: ProductGridProps) {
  const grid = cn('grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4', cols, className);

  if (isLoading) {
    return (
      <div className={grid}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-lg border p-3">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-6 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return <EmptyState icon={PackageSearch} title={emptyTitle} description={emptyDescription} className={className} />;
  }

  return (
    <div className={grid}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
