import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { BadgeCheck, Clock, Star, Store } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchView } from '@/components/shared/search-view';
import { FollowShopButton } from '@/components/shared/follow-shop-button';
import { apiGet } from '@/lib/api';
import { num } from '@/lib/utils';
import { mediaUrl } from '@/lib/env';

export const revalidate = 300;

interface PublicShop {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  policyReturn?: string | null;
  policyShipping?: string | null;
  policyWarranty?: string | null;
  defaultDeliveryDays: number;
  isActive: boolean;
  createdAt: string;
  seller: { tier: string; isVerified: boolean; rating: string | number; approvedAt?: string | null };
}

interface Props {
  params: { slug: string };
}

async function getShop(slug: string): Promise<PublicShop | null> {
  try {
    return await apiGet<PublicShop>(`/sellers/shops/${slug}`, { next: { revalidate: 300 } });
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const shop = await getShop(params.slug);
  if (!shop) return { title: 'Shop not found' };
  return {
    title: `${shop.name} — MarketPlace Shop`,
    description: shop.description ?? `Products from ${shop.name}.`,
    openGraph: shop.coverUrl ? { images: [{ url: mediaUrl(shop.coverUrl) }] } : undefined,
  };
}

export default async function ShopProfilePage({ params }: Props) {
  const shop = await getShop(params.slug);
  if (!shop) notFound();

  const logo = mediaUrl(shop.logoUrl);
  const cover = mediaUrl(shop.coverUrl);
  const rating = num(shop.seller.rating);

  return (
    <div className="space-y-0">
      {/* Header band */}
      <div className="border-b bg-muted/30">
        <div className="container py-6">
          {cover && (
            <div className="relative mb-4 h-28 w-full overflow-hidden rounded-xl bg-muted sm:h-40">
              <Image src={cover} alt="" fill sizes="100vw" className="object-cover" priority />
            </div>
          )}
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-card">
              {logo ? (
                <Image src={logo} alt={shop.name} width={60} height={60} className="object-cover" />
              ) : (
                <Store className="h-7 w-7 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold">{shop.name}</h1>
                {shop.seller.isVerified && (
                  <Badge variant="brand">
                    <BadgeCheck className="mr-1 h-3 w-3" /> Verified
                  </Badge>
                )}
                <Badge variant="outline" className="capitalize">
                  {shop.seller.tier.toLowerCase()} seller
                </Badge>
              </div>
              {shop.description && (
                <p className="max-w-2xl text-sm text-muted-foreground">{shop.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-medium text-foreground">{rating.toFixed(1)}</span> seller rating
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Ships in ~{shop.defaultDeliveryDays} days
                </span>
                {shop.seller.approvedAt && (
                  <span>On MarketPlace since {new Date(shop.seller.approvedAt).getFullYear()}</span>
                )}
              </div>
            </div>
            <FollowShopButton shopId={shop.id} />
          </div>
        </div>
      </div>

      {/* Policies strip */}
      {(shop.policyReturn || shop.policyShipping || shop.policyWarranty) && (
        <div className="border-b bg-background">
          <div className="container grid gap-4 py-4 text-xs text-muted-foreground sm:grid-cols-3">
            {shop.policyReturn && (
              <p>
                <span className="block font-semibold text-foreground">Returns</span>
                <span className="line-clamp-2">{shop.policyReturn}</span>
              </p>
            )}
            {shop.policyShipping && (
              <p>
                <span className="block font-semibold text-foreground">Shipping</span>
                <span className="line-clamp-2">{shop.policyShipping}</span>
              </p>
            )}
            {shop.policyWarranty && (
              <p>
                <span className="block font-semibold text-foreground">Warranty</span>
                <span className="line-clamp-2">{shop.policyWarranty}</span>
              </p>
            )}
          </div>
        </div>
      )}

      <Separator />

      {/* Products (faceted, URL-driven) */}
      <Suspense
        fallback={
          <div className="container py-8">
            <Skeleton className="h-10 w-56" />
            <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
              <Skeleton className="hidden h-96 lg:block" />
              <Skeleton className="h-96" />
            </div>
          </div>
        }
      >
        <SearchView lockedShopId={shop.id} title={`${shop.name} · Products`} />
      </Suspense>

      <div className="container pb-8 text-sm text-muted-foreground">
        Looking for something specific?{' '}
        <Link href="/search" className="font-medium text-brand hover:underline">
          Search all products
        </Link>{' '}
        or browse{' '}
        <Link href="/shops" className="font-medium text-brand hover:underline">
          other shops
        </Link>
        .
      </div>
    </div>
  );
}
