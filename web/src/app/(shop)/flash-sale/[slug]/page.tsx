import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Countdown } from '@/components/shared/countdown';
import { FlashSaleItemCard } from '@/components/shared/flash-sale-item-card';
import { apiGet } from '@/lib/api';
import { mediaUrl } from '@/lib/env';
import type { FlashSale } from '@/types';

export const revalidate = 60;

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props) {
  try {
    const sale = await apiGet<FlashSale>(`/flash-sales/${params.slug}`, {
      next: { revalidate: 60 },
    });
    return {
      title: `${sale.title} — Flash Sale`,
      description: sale.description ?? `Limited-time deals on ${sale.items?.length ?? 0} products.`,
    };
  } catch {
    return { title: 'Flash Sale' };
  }
}

export default async function FlashSaleDetailPage({ params }: Props) {
  let sale: FlashSale | null = null;
  try {
    sale = await apiGet<FlashSale>(`/flash-sales/${params.slug}`, {
      next: { revalidate: 60 },
    });
  } catch {
    sale = null;
  }
  if (!sale) notFound();

  const items = sale.items ?? [];
  const banner = mediaUrl(sale.bannerUrl);

  return (
    <div className="container space-y-6 py-6">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-brand">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/flash-sale" className="hover:text-brand">Flash Sales</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="truncate text-foreground">{sale.title}</span>
      </nav>

      <section className="overflow-hidden rounded-xl border bg-card">
        {banner && (
          <div className="relative h-32 w-full bg-muted sm:h-44">
            <Image src={banner} alt={sale.title} fill sizes="100vw" className="object-cover" priority />
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="h-6 w-6 fill-brand text-brand" />
              <h1 className="text-2xl font-bold sm:text-3xl">{sale.title}</h1>
              {sale.status === 'LIVE' && <Badge variant="brand">● Live now</Badge>}
              {sale.status === 'UPCOMING' && <Badge variant="secondary">Starts soon</Badge>}
              {sale.status === 'ENDED' && <Badge variant="outline">Ended</Badge>}
            </div>
            {sale.description && (
              <p className="max-w-2xl text-sm text-muted-foreground">{sale.description}</p>
            )}
          </div>
          <div className="flex flex-col items-start gap-1">
            <span className="text-xs uppercase text-muted-foreground">
              {sale.status === 'LIVE' ? 'Ends in' : sale.status === 'UPCOMING' ? 'Starts in' : 'Sale window'}
            </span>
            <Countdown
              endsAt={sale.status === 'UPCOMING' ? sale.startsAt : sale.endsAt}
              compact
            />
          </div>
        </div>
      </section>

      {items.length > 0 ? (
        <section>
          <h2 className="mb-4 text-lg font-bold">
            All deals <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {items.map((item) => (
              <FlashSaleItemCard key={item.itemId} item={item} />
            ))}
          </div>
        </section>
      ) : (
        <p className="rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          Deals for this sale will appear here shortly.
        </p>
      )}

      <div className="text-center">
        <Link href="/flash-sale" className="text-sm font-medium text-brand hover:underline">
          ← Browse all flash sales
        </Link>
      </div>
    </div>
  );
}
