import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { SearchView } from '@/components/shared/search-view';
import { Skeleton } from '@/components/ui/skeleton';
import { safeApiGet } from '@/lib/server-api';
import type { Category } from '@/types';

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const category = await safeApiGet<Category | null>(`/catalog/categories/${params.slug}`, null);
  return { title: category?.name ?? 'Category' };
}

export default async function CategoryPage({ params }: PageProps) {
  const category = await safeApiGet<Category | null>(`/catalog/categories/${params.slug}`, null);
  if (!category) notFound();

  return (
    <Suspense
      fallback={
        <div className="container grid gap-6 py-6 lg:grid-cols-[240px_1fr]">
          <Skeleton className="h-96 w-full rounded-lg" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] w-full rounded-lg" />
            ))}
          </div>
        </div>
      }
    >
      <SearchView lockedCategoryId={category.id} title={category.name} />
    </Suspense>
  );
}
