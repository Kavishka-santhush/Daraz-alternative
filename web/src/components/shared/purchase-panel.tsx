'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ShoppingCart, Zap, Truck, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/shared/price';
import { QuantityStepper } from '@/components/shared/quantity-stepper';
import { useCart } from '@/components/providers/cart-provider';
import { cn, num } from '@/lib/utils';
import type { Product, ProductVariant } from '@/types';

interface PurchasePanelProps {
  product: Product;
}

/** Variant picker, quantity, add-to-cart / buy-now and trust badges. */
export function PurchasePanel({ product }: PurchasePanelProps) {
  const router = useRouter();
  const { status } = useSession();
  const { addItem, isAdding } = useCart();

  const variants = product.variants ?? [];
  const [variantId, setVariantId] = useState<string | null>(variants[0]?.id ?? null);
  const [qty, setQty] = useState(1);

  const selected: ProductVariant | undefined = useMemo(
    () => variants.find((v) => v.id === variantId),
    [variants, variantId],
  );

  const price = selected ? num(selected.price) : num(product.salePrice ?? product.originalPrice);
  const compare = selected ? num(selected.compareAtPrice) || num(product.originalPrice) : num(product.originalPrice);
  const stock = selected ? selected.stockQuantity : product.stockQuantity;
  const outOfStock = stock <= 0;

  const requireAuth = () => {
    if (status !== 'authenticated') {
      toast.error('Please sign in to continue');
      router.push(`/login?callbackUrl=${encodeURIComponent(`/product/${product.slug}`)}`);
      return false;
    }
    return true;
  };

  const onAdd = () => {
    if (!requireAuth()) return;
    addItem({ productId: product.id, variantId: variantId ?? undefined, quantity: qty });
    toast.success('Added to cart');
  };

  const onBuyNow = () => {
    if (!requireAuth()) return;
    addItem({ productId: product.id, variantId: variantId ?? undefined, quantity: qty });
    router.push('/cart');
  };

  return (
    <div className="space-y-4">
      <Price sale={price} original={compare} size="lg" />

      {product.ratingCount > 0 && (
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{num(product.ratingAverage).toFixed(1)}</span> · {product.ratingCount} review
          {product.ratingCount === 1 ? '' : 's'}
        </p>
      )}

      {variants.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Options</p>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={!v.isActive || v.stockQuantity <= 0}
                onClick={() => setVariantId(v.id)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm transition-colors',
                  v.id === variantId ? 'border-brand bg-brand/5 font-medium text-brand' : 'hover:border-gray-400',
                  (!v.isActive || v.stockQuantity <= 0) && 'cursor-not-allowed opacity-40',
                )}
              >
                {v.optionLabel || v.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Quantity</span>
        <QuantityStepper value={qty} onChange={setQty} max={Math.max(1, stock)} disabled={outOfStock} />
        {!outOfStock && stock <= 10 && (
          <Badge variant="destructive" className="font-normal">Only {stock} left</Badge>
        )}
      </div>

      {outOfStock ? (
        <div className="rounded-md bg-muted p-3 text-center text-sm font-medium text-muted-foreground">
          This item is currently out of stock
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" size="lg" className="flex-1" onClick={onAdd} disabled={isAdding}>
            <ShoppingCart className="h-4 w-4" /> Add to Cart
          </Button>
          <Button variant="brand" size="lg" className="flex-1" onClick={onBuyNow}>
            <Zap className="h-4 w-4" /> Buy Now
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 rounded-lg border p-3 text-sm text-muted-foreground sm:grid-cols-3">
        <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-brand" /> Fast delivery</div>
        <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand" /> Secure payment</div>
        <div className="flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-brand" /> Easy returns</div>
      </div>
    </div>
  );
}
