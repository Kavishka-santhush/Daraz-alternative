import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, Flame, Zap } from 'lucide-react';
import { HeroBanner } from '@/components/shared/hero-banner';
import { ProductGrid } from '@/components/shared/product-grid';
import { FlashSaleItemCard } from '@/components/shared/flash-sale-item-card';
import { Countdown } from '@/components/shared/countdown';
import { safeApiGet } from '@/lib/server-api';
import { mediaUrl } from '@/lib/env';
import type { Banner, Category, FlashSale, Product } from '@/types';

export const metadata = { title: 'Home' };

function SectionHeading({ title, href, icon }: { title: string; href?: string; icon?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-lg font-bold sm:text-xl">
        {icon}
        {title}
      </h2>
      {href && (
        <Link href={href} className="flex items-center gap-0.5 text-sm font-medium text-brand hover:underline">
          View all <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  const [banners, categories, flashSales, trending, onSale] = await Promise.all([
    safeApiGet<Banner[]>('/banners', [], { query: { placement: 'home-hero' } }),
    safeApiGet<Category[]>('/catalog/categories', []),
    safeApiGet<FlashSale[]>('/flash-sales', []),
    safeApiGet<Product[]>('/search', [], { query: { limit: 12, sort: 'best_selling' } }),
    safeApiGet<Product[]>('/search', [], { query: { limit: 12, onSale: 'true' } }),
  ]);

  // /flash-sales returns a computed status ('LIVE' | 'UPCOMING' | 'ENDED').
  const activeSale = flashSales.find((s) => s.status === 'LIVE');
  const topLevel = categories.filter((c) => !c.parentId).slice(0, 10);

  return (
    <div className="container space-y-10 py-6">
      <HeroBanner banners={banners} />

      {/* Category chips */}
      {topLevel.length > 0 && (
        <section>
          <SectionHeading title="Shop by Category" href="/categories" />
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-10">
            {topLevel.map((c) => (
              <Link key={c.id} href={`/category/${c.slug}`} className="group flex flex-col items-center gap-2 rounded-lg border p-3 text-center hover:border-brand hover:shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-muted">
                  {c.iconUrl ? (
                    <Image src={mediaUrl(c.iconUrl)} alt={c.name} width={40} height={40} className="object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-brand">{c.name.charAt(0)}</span>
                  )}
                </div>
                <span className="line-clamp-2 text-xs font-medium group-hover:text-brand">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Flash sale */}
      {activeSale && (
        <section className="rounded-xl border border-orange-200 bg-orange-50/50 p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold text-brand sm:text-xl">
              <Zap className="h-5 w-5 fill-brand" /> Flash Sale
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Ends in</span>
              <Countdown endsAt={activeSale.endsAt} compact />
              <Link href="/flash-sale" className="hidden items-center gap-0.5 text-sm font-medium text-brand hover:underline sm:flex">
                View all <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {(activeSale.items ?? []).slice(0, 6).map((item) => (
              <FlashSaleItemCard key={item.itemId} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* Trending */}
      <section>
        <SectionHeading title="Trending Now" href="/search?sort=best_selling" icon={<Flame className="h-5 w-5 text-brand" />} />
        <ProductGrid products={trending} />
      </section>

      {/* On sale */}
      {onSale.length > 0 && (
        <section>
          <SectionHeading title="Deals For You" href="/deals" />
          <ProductGrid products={onSale} />
        </section>
      )}
    </div>
  );
}
