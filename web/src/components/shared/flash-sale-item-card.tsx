import Link from 'next/link';
import Image from 'next/image';
import { Zap } from 'lucide-react';
import { Price } from '@/components/shared/price';
import { mediaUrl } from '@/lib/env';
import type { FlashSaleItem } from '@/types';

/**
 * Compact flash-sale deal card. `item` is the flattened shape returned by
 * GET /flash-sales[/ :slug] — price fields are plain numbers, `image` may be
 * null (products without photos are filtered out on the server side, but we
 * guard anyway).
 */
export function FlashSaleItemCard({ item, showProgress = true }: { item: FlashSaleItem; showProgress?: boolean }) {
  const soldPct = Math.min(100, Math.round((item.soldCount / Math.max(1, item.stockLimit)) * 100));
  const image = mediaUrl(item.image);

  return (
    <Link
      href={`/product/${item.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square bg-muted">
        {image ? (
          <Image src={image} alt={item.title} fill sizes="240px" className="object-cover transition-transform group-hover:scale-105" />
        ) : (
          <span className="flex h-full items-center justify-center text-3xl font-bold text-muted-foreground/40">
            {item.title.charAt(0)}
          </span>
        )}
        <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
          <Zap className="h-3 w-3 fill-white" />
          {item.discountPercent != null ? `-${item.discountPercent}%` : 'FLASH'}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <p className="line-clamp-2 min-h-8 text-xs font-medium">{item.title}</p>
        <Price sale={item.flashPrice} original={item.originalPrice} size="sm" />
        {showProgress && (
          <div className="mt-auto space-y-1 pt-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-orange-100">
              <div className="h-full rounded-full bg-brand" style={{ width: `${soldPct}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {item.remaining > 0 ? `${item.soldCount} sold · ${item.remaining} left` : 'Sold out'}
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}
