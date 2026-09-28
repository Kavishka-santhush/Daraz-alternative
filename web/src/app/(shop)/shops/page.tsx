import Link from 'next/link';
import Image from 'next/image';
import { Store, Users, Package, BadgeCheck, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { apiList } from '@/lib/api';
import { num } from '@/lib/utils';
import { mediaUrl } from '@/lib/env';
import type { ShopCard } from '@/types';

export const metadata = {
  title: 'All Shops',
  description: 'Browse verified shops and independent sellers on MarketPlace.',
};

export const revalidate = 300;

export default async function ShopsDirectoryPage() {
  let shops: ShopCard[] = [];
  try {
    const { data } = await apiList<ShopCard[]>('/sellers/shops', {
      query: { limit: 60 },
      next: { revalidate: 300 },
    });
    shops = data;
  } catch {
    shops = [];
  }

  return (
    <div className="container space-y-6 py-8">
      <div className="flex items-center gap-2">
        <Store className="h-6 w-6 text-brand" />
        <h1 className="text-2xl font-bold sm:text-3xl">All Shops</h1>
      </div>
      <p className="-mt-4 text-sm text-muted-foreground">
        Independent sellers and brands trading on MarketPlace.
      </p>

      {shops.length === 0 ? (
        <EmptyState
          title="No shops to show yet"
          description="Shops appear here once sellers are approved. Want to be first? Open your store today."
          action={
            <Link href="/sell" className="font-medium text-brand hover:underline">
              Become a seller →
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((s) => (
            <Link key={s.id} href={`/shops/${s.slug}`} className="group">
              <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-md">
                <div className="relative h-20 bg-muted">
                  {s.coverUrl && (
                    <Image
                      src={mediaUrl(s.coverUrl)}
                      alt=""
                      fill
                      sizes="400px"
                      className="object-cover"
                    />
                  )}
                </div>
                <CardContent className="space-y-2 p-4 pt-0">
                  <div className="-mt-6 flex items-end justify-between gap-2">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-card">
                      {s.logoUrl ? (
                        <Image src={mediaUrl(s.logoUrl)} alt={s.name} width={44} height={44} className="object-cover" />
                      ) : (
                        <Store className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    {s.seller.isVerified && (
                      <Badge variant="brand" className="mb-1">
                        <BadgeCheck className="mr-1 h-3 w-3" /> Verified
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold group-hover:text-brand">{s.name}</p>
                    {s.description && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">{s.description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {num(s.seller.rating).toFixed(1)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Package className="h-3.5 w-3.5" /> {s._count.products} products
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {s._count.followers} followers
                    </span>
                    <span className="ml-auto">{s.seller.tier}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
