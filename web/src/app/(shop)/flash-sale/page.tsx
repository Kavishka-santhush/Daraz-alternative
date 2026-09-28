import Link from 'next/link';
import { ChevronRight, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Countdown } from '@/components/shared/countdown';
import { EmptyState } from '@/components/shared/empty-state';
import { FlashSaleItemCard } from '@/components/shared/flash-sale-item-card';
import { apiGet } from '@/lib/api';
import { mediaUrl } from '@/lib/env';
import type { FlashSale } from '@/types';

export const metadata = {
  title: 'Flash Sales',
  description: 'Limited-time deals at lightning prices — while stock lasts.',
};

// Sales change frequently; keep this fresh without a full per-request SSR cost.
export const revalidate = 60;

function StatusBadge({ status }: { status: FlashSale['status'] }) {
  if (status === 'LIVE') return <Badge variant="brand">● Live now</Badge>;
  if (status === 'UPCOMING') return <Badge variant="secondary">Starts soon</Badge>;
  return <Badge variant="outline">Ended</Badge>;
}

function SaleSection({ sale }: { sale: FlashSale }) {
  return (
    <section className="rounded-xl border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-orange-50/50 px-4 py-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">
              <Link href={`/flash-sale/${sale.slug}`} className="hover:text-brand">
                {sale.title}
              </Link>
            </h2>
            <StatusBadge status={sale.status} />
          </div>
          {sale.description && (
            <p className="line-clamp-1 text-sm text-muted-foreground">{sale.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {sale.status === 'LIVE' ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">Ends in</span>
              <Countdown endsAt={sale.endsAt} compact />
            </>
          ) : sale.status === 'UPCOMING' ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">Starts in</span>
              <Countdown endsAt={sale.startsAt} compact />
            </>
          ) : null}
          <Link
            href={`/flash-sale/${sale.slug}`}
            className="flex items-center gap-0.5 text-sm font-medium text-brand hover:underline"
          >
            View all <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </header>
      <div className="p-4">
        {(sale.items?.length ?? 0) > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {sale.items!.slice(0, 6).map((item) => (
              <FlashSaleItemCard key={item.itemId} item={item} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Deals for this sale are coming soon.</p>
        )}
      </div>
    </section>
  );
}

export default async function FlashSaleListPage() {
  let sales: FlashSale[] = [];
  try {
    sales = await apiGet<FlashSale[]>('/flash-sales', { next: { revalidate: 60 } });
  } catch {
    sales = [];
  }

  return (
    <div className="container space-y-6 py-6">
      <div className="flex items-center gap-2">
        <Zap className="h-6 w-6 fill-brand text-brand" />
        <h1 className="text-2xl font-bold sm:text-3xl">Flash Sales</h1>
      </div>
      <p className="-mt-4 text-sm text-muted-foreground">
        Limited-time deals at lightning prices — when the timer runs out or stock sells out, the
        price goes back up.
      </p>

      {sales.length === 0 ? (
        <EmptyState
          title="No flash sales right now"
          description="New deals drop regularly — check back soon or browse our everyday discounts."
          action={
            <Link href="/deals" className="font-medium text-brand hover:underline">
              Browse deals →
            </Link>
          }
        />
      ) : (
        sales.map((sale) => <SaleSection key={sale.id} sale={sale} />)
      )}

      {/* Promo banner slot for this page */}
      <FlashSaleBannerSlot />
    </div>
  );
}

async function FlashSaleBannerSlot() {
  try {
    const banners = await apiGet<
      Array<{ id: string; title: string; imageUrl: string; targetUrl?: string | null }>
    >('/banners', { query: { placement: 'flash-sale' }, next: { revalidate: 300 } });
    const banner = banners[0];
    if (!banner) return null;
    const inner = (
      <img
        src={mediaUrl(banner.imageUrl)}
        alt={banner.title}
        className="w-full rounded-xl object-cover"
      />
    );
    return banner.targetUrl ? (
      <Link href={banner.targetUrl}>{inner}</Link>
    ) : (
      inner
    );
  } catch {
    return null;
  }
}
