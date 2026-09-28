'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Heart, ShoppingCart, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/shared/price';
import { RatingStars } from '@/components/shared/rating-stars';
import { useCart } from '@/components/providers/cart-provider';
import { mediaUrl } from '@/lib/env';
import { cn } from '@/lib/utils';
import type { Product } from '@/types';

interface ProductCardProps {
  product: Product;
  className?: string;
  priority?: boolean;
}

/** Grid tile for a product: image, discount, title, rating, price, add-to-cart. */
export function ProductCard({ product, className, priority }: ProductCardProps) {
  const { addItem, isAdding } = useCart();
  const [added, setAdded] = useState(false);

  const image = product.images?.find((i) => i.isPrimary) ?? product.images?.[0];
  const href = `/product/${product.slug}`;
  const outOfStock = product.stockQuantity <= 0;

  const onAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock) {
      toast.error('Out of stock');
      return;
    }
    addItem({ productId: product.id, quantity: 1 });
    setAdded(true);
    toast.success('Added to cart');
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <Link
      href={href}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md',
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {image ? (
          <Image
            src={mediaUrl(image.url)}
            alt={product.title}
            fill
            priority={priority}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No image</div>
        )}
        {Number(product.discountPercent) > 0 && (
          <Badge variant="brand" className="absolute left-2 top-2">
            -{Number(product.discountPercent)}%
          </Badge>
        )}
        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-sm font-semibold text-gray-700">
            Out of stock
          </div>
        )}
        <button
          type="button"
          aria-label="Add to wishlist"
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-500 opacity-0 shadow-sm transition-opacity hover:text-brand group-hover:opacity-100"
          onClick={(e) => {
            e.preventDefault();
            toast.info('Sign in to save items');
          }}
        >
          <Heart className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-tight" title={product.title}>
          {product.title}
        </h3>
        <RatingStars rating={product.ratingAverage} count={product.ratingCount} />
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <Price sale={product.salePrice ?? product.originalPrice} original={product.salePrice ? product.originalPrice : null} size="sm" />
          <button
            type="button"
            onClick={onAdd}
            disabled={isAdding}
            aria-label="Add to cart"
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white transition-colors',
              added ? 'bg-green-600' : 'bg-brand hover:bg-brand-dark',
            )}
          >
            {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
          </button>
        </div>
        {product.shop?.name && (
          <p className="truncate text-xs text-muted-foreground">{product.shop.name}</p>
        )}
      </div>
    </Link>
  );
}
