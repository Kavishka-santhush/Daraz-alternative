import Link from 'next/link';
import { CalendarClock, ShieldCheck, Ticket, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { apiList } from '@/lib/api';
import { formatMoney, num } from '@/lib/utils';
import { CopyCodeButton } from '@/components/shared/copy-code-button';
import type { Voucher } from '@/types';

export const metadata = {
  title: 'Vouchers & Offers',
  description: 'Collect platform voucher codes and save on your next MarketPlace order.',
};

export const revalidate = 300;

function valueLabel(v: Voucher): string {
  if (v.type === 'PERCENT' && v.percentOff) return `${num(v.percentOff)}% off`;
  if (v.type === 'FIXED' && v.fixedOff) return `${formatMoney(num(v.fixedOff))} off`;
  if (v.type === 'FREE_SHIPPING') return 'Free shipping';
  return 'Discount';
}

export default async function OffersPage() {
  let vouchers: Voucher[] = [];
  try {
    const { data } = await apiList<Voucher[]>('/vouchers', {
      query: { limit: 50 },
      next: { revalidate: 300 },
    });
    vouchers = data;
  } catch {
    vouchers = [];
  }

  return (
    <div className="container space-y-6 py-8">
      <div className="flex items-center gap-2">
        <Ticket className="h-6 w-6 text-brand" />
        <h1 className="text-2xl font-bold sm:text-3xl">Vouchers &amp; Offers</h1>
      </div>
      <p className="-mt-4 text-sm text-muted-foreground">
        Copy a code and paste it at checkout — platform codes apply to any shop, seller codes only
        to their own store.
      </p>

      {vouchers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <TrendingDown className="h-8 w-8 text-muted-foreground/50" />
            <p className="font-medium">No public vouchers right now</p>
            <p className="text-sm text-muted-foreground">
              New offers drop around every campaign — meanwhile try the{' '}
              <Link href="/deals" className="text-brand hover:underline">
                daily deals
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vouchers.map((v) => {
            const expired = new Date(v.expiresAt).getTime() < Date.now();
            return (
              <Card key={v.id} className="relative overflow-hidden border-dashed">
                <span
                  aria-hidden
                  className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-background"
                />
                <span
                  aria-hidden
                  className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-background"
                />
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xl font-extrabold text-brand">{valueLabel(v)}</p>
                      <p className="font-semibold">{v.name}</p>
                    </div>
                    <Badge variant={v.scope === 'PLATFORM' ? 'brand' : 'secondary'}>
                      {v.scope === 'PLATFORM' ? 'Any shop' : 'Seller'}
                    </Badge>
                  </div>
                  {v.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{v.description}</p>
                  )}
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {v.minOrderAmount && (
                      <li className="flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Min. spend {formatMoney(num(v.minOrderAmount))}
                      </li>
                    )}
                    {v.maxDiscount && (
                      <li className="flex items-center gap-1.5">
                        <TrendingDown className="h-3.5 w-3.5" />
                        Max discount {formatMoney(num(v.maxDiscount))}
                      </li>
                    )}
                    <li className="flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {expired ? 'Expired' : `Valid until ${new Date(v.expiresAt).toLocaleDateString()}`}
                    </li>
                  </ul>
                  <div className="pt-1">
                    <CopyCodeButton code={v.code} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground">
        See also{' '}
        <Link href="/flash-sale" className="font-medium text-brand hover:underline">
          live flash sales
        </Link>{' '}
        and{' '}
        <Link href="/deals" className="font-medium text-brand hover:underline">
          everyday deals
        </Link>
        .
      </p>
    </div>
  );
}
