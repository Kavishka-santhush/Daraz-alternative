'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal, X } from 'lucide-react';
import { apiList } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { ProductGrid } from '@/components/shared/product-grid';
import { Pagination } from '@/components/shared/pagination';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PageMeta, Product, SearchFacets } from '@/types';

const SORTS: Array<{ value: string; label: string }> = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'best_selling', label: 'Best Selling' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
];

export function SearchView({
  lockedCategoryId,
  lockedShopId,
  title,
}: {
  lockedCategoryId?: string;
  lockedShopId?: string;
  title?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const query = useMemo(() => {
    const o: Record<string, string> = {};
    params.forEach((v, k) => (o[k] = v));
    if (lockedCategoryId) o.categoryId = lockedCategoryId;
    if (lockedShopId) o.shopId = lockedShopId;
    return o;
  }, [params, lockedCategoryId, lockedShopId]);

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.search({ ...query, facets: 'true' }),
    queryFn: async () => {
      const { data: items, meta } = await apiList<Product[]>('/search', {
        query: { ...query, facets: 'true' },
      });
      return { items, meta: meta as PageMeta & { facets?: SearchFacets } };
    },
  });

  const facets = data?.meta?.facets;
  const meta = data?.meta;
  const page = Number(query.page ?? 1);
  const pages = meta?.pages ?? Math.ceil((meta?.total ?? 0) / (meta?.limit ?? 24)) ?? 1;

  const setParam = (key: string, value?: string | null) => {
    const sp = new URLSearchParams(params.toString());
    if (value === null || value === '' || value === undefined) sp.delete(key);
    else sp.set(key, value);
    if (key !== 'page') sp.delete('page');
    router.push(`${pathname}${sp.toString() ? `?${sp}` : ''}`, { scroll: false });
  };

  const heading = title ?? (query.q ? `Results for “${query.q}”` : 'All Products');

  return (
    <div className="container py-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold sm:text-2xl">{heading}</h1>
        <Select value={query.sort ?? 'relevance'} onValueChange={(v) => setParam('sort', v)}>
          <SelectTrigger className="w-48 shrink-0">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {meta && <p className="mt-1 text-sm text-muted-foreground">{meta.total} products found</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Filters sidebar */}
        <aside className="space-y-5">
          <div className="flex items-center gap-2 lg:hidden">
            <SlidersHorizontal className="h-4 w-4" />
            <span className="font-semibold">Filters</span>
          </div>

          {/* Price */}
          <div>
            <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold">Price</h3>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder={facets ? String(facets.price.min) : 'Min'}
                defaultValue={query.minPrice}
                onBlur={(e) => setParam('minPrice', e.target.value || null)}
                className="h-9"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="number"
                placeholder={facets ? String(facets.price.max) : 'Max'}
                defaultValue={query.maxPrice}
                onBlur={(e) => setParam('maxPrice', e.target.value || null)}
                className="h-9"
              />
            </div>
          </div>

          <Separator />

          {/* Categories */}
          {!lockedCategoryId && facets?.categories?.length ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Category</h3>
              <ul className="space-y-1.5">
                {facets.categories.map((c) => (
                  <li key={c.id}>
                    <Label className="flex cursor-pointer items-center justify-between text-sm font-normal">
                      <span className="flex items-center gap-2">
                        <Checkbox
                          checked={query.categoryId === c.id}
                          onCheckedChange={(chk) => setParam('categoryId', chk === true ? c.id : null)}
                        />
                        {c.name}
                      </span>
                      <span className="text-xs text-muted-foreground">{c.count}</span>
                    </Label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Brands */}
          {facets?.brands?.length ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Brand</h3>
              <ul className="max-h-52 space-y-1.5 overflow-auto pr-1">
                {facets.brands.map((b) => (
                  <li key={b.id}>
                    <Label className="flex cursor-pointer items-center justify-between text-sm font-normal">
                      <span className="flex items-center gap-2">
                        <Checkbox
                          checked={query.brandId === b.id}
                          onCheckedChange={(chk) => setParam('brandId', chk === true ? b.id : null)}
                        />
                        {b.name}
                      </span>
                      <span className="text-xs text-muted-foreground">{b.count}</span>
                    </Label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Conditions */}
          {facets?.conditions?.length ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Condition</h3>
              <ul className="space-y-1.5">
                {facets.conditions.map((c) => (
                  <li key={c.condition ?? 'any'}>
                    <Label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                      <Checkbox
                        checked={query.condition === c.condition}
                        onCheckedChange={(chk) => setParam('condition', chk === true ? String(c.condition) : null)}
                      />
                      {c.condition ?? 'Any'}
                    </Label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Separator />
          <div className="space-y-2">
            <Label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
              <Checkbox checked={query.onSale === 'true'} onCheckedChange={(c) => setParam('onSale', c === true ? 'true' : null)} />
              On sale
            </Label>
            <Label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
              <Checkbox checked={query.inStock === 'true'} onCheckedChange={(c) => setParam('inStock', c === true ? 'true' : null)} />
              In stock only
            </Label>
          </div>

          {(query.q || query.categoryId || query.brandId || query.minPrice || query.maxPrice || query.onSale) && (
            <Button variant="ghost" size="sm" className="w-full" onClick={() => router.push(pathname)}>
              <X className="h-4 w-4" /> Clear all
            </Button>
          )}
        </aside>

        {/* Results */}
        <div>
          {isFetching && !data ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4] w-full rounded-lg" />)}
            </div>
          ) : (
            <>
              <ProductGrid products={data?.items} isLoading={isFetching} cols="lg:grid-cols-3 xl:grid-cols-4" />
              {pages > 1 && (
                <Pagination className="mt-8" page={page} pages={pages} href={(p) => `${pathname}?${new URLSearchParams({ ...query, page: String(p) }).toString()}`} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
