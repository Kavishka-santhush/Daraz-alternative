import { BadgePercent } from 'lucide-react';
import { ProductGrid } from '@/components/shared/product-grid';
import { apiList } from '@/lib/api';
import type { Product } from '@/types';

export const metadata = {
  title: 'Deals & Discounts',
  description: 'Everyday discounts across the marketplace — save on top-rated products.',
};

export const revalidate = 120;

export default async function DealsPage() {
  let products: Product[] = [];
  try {
    const { data } = await apiList<Product[]>('/search', {
      query: { onSale: 'true', sort: 'best_selling', limit: 40 },
      next: { revalidate: 120 },
    });
    products = data;
  } catch {
    products = [];
  }

  return (
    <div className="container space-y-6 py-6">
      <div className="flex items-center gap-2">
        <BadgePercent className="h-6 w-6 text-brand" />
        <h1 className="text-2xl font-bold sm:text-3xl">Deals &amp; Discounts</h1>
      </div>
      <p className="-mt-4 text-sm text-muted-foreground">
        Products currently priced below their list price. Quantities can be limited.
      </p>
      <ProductGrid products={products} />
    </div>
  );
}
