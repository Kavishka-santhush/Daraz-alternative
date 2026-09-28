import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SearchView } from '@/components/shared/search-view';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Search' };

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="container space-y-4 py-6">
          <Skeleton className="h-8 w-56" />
          <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
            <Skeleton className="h-96 w-full rounded-lg" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <SearchView />
    </Suspense>
  );
}
