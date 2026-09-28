'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Trash2, ShoppingBag, ArrowRight, Store, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { QuantityStepper } from '@/components/shared/quantity-stepper';
import { useCart } from '@/components/providers/cart-provider';
import { formatMoney, num } from '@/lib/utils';
import { mediaUrl } from '@/lib/env';

export default function CartPage() {
  const router = useRouter();
  const { status } = useSession();
  const { cart, isLoading, updateItem, removeItem, subtotal } = useCart();
  const [voucher, setVoucher] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login?callbackUrl=/cart');
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <div className="container py-16">
        <Skeleton className="mx-auto h-8 w-40" />
      </div>
    );
  }

  const groups = cart?.groups ?? [];
  const shipping = 0;
  const total = num(subtotal) + shipping;

  return (
    <div className="container py-6">
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold">
        <ShoppingBag className="h-6 w-6 text-brand" /> My Cart
      </h1>

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
          </div>
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Browse products and add them to your cart."
          action={
            <Button asChild variant="brand">
              <Link href="/">Start Shopping</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {groups.map((group) => (
              <Card key={group.shop.id}>
                <div className="flex items-center gap-2 border-b px-4 py-3">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  <Link href={`/shop/${group.shop.slug}`} className="text-sm font-semibold hover:text-brand">
                    {group.shop.name}
                  </Link>
                </div>
                <CardContent className="divide-y p-0">
                  {group.items.map((item) => (
                    <div key={item.id} className="flex gap-4 p-4">
                      <Link href={`/product/${item.productId}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-muted">
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mediaUrl(item.image)} alt={item.title} className="h-full w-full object-cover" />
                        ) : null}
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <Link href={`/product/${item.productId}`} className="line-clamp-2 text-sm font-medium hover:text-brand">
                          {item.title}
                        </Link>
                        <p className="mt-1 text-sm font-bold text-brand">{formatMoney(item.unitPrice)}</p>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <QuantityStepper
                            size="sm"
                            value={item.quantity}
                            max={item.stock}
                            onChange={(q) => updateItem(item.id, q)}
                          />
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" /> Remove
                          </button>
                        </div>
                      </div>
                      <div className="hidden shrink-0 text-right text-sm font-semibold sm:block">
                        {formatMoney(item.lineTotal)}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Summary */}
          <div>
            <Card className="sticky top-20">
              <CardContent className="space-y-4 p-5">
                <h2 className="text-base font-bold">Order Summary</h2>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={voucher} onChange={(e) => setVoucher(e.target.value)} placeholder="Voucher code" className="pl-9" />
                  </div>
                  <Button variant="outline" disabled>Apply</Button>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatMoney(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>{shipping === 0 ? 'Calculated at checkout' : formatMoney(shipping)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-base font-bold">
                    <span>Total</span>
                    <span className="text-brand">{formatMoney(total)}</span>
                  </div>
                </div>
                <Button variant="brand" size="lg" className="w-full" onClick={() => router.push('/checkout')}>
                  Proceed to Checkout <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
