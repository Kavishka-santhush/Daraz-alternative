import { cn, formatMoney, discountPercent, num } from '@/lib/utils';

interface PriceProps {
  sale?: string | number | null;
  original?: string | number | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showDiscount?: boolean;
}

const sizeMap = {
  sm: { price: 'text-sm', compare: 'text-xs', badge: 'text-[10px]' },
  md: { price: 'text-lg', compare: 'text-sm', badge: 'text-xs' },
  lg: { price: 'text-2xl', compare: 'text-sm', badge: 'text-xs' },
};

/** Renders a sale price with optional struck-through compare price + discount %. */
export function Price({ sale, original, className, size = 'md', showDiscount = true }: PriceProps) {
  const saleN = num(sale);
  const origN = num(original);
  const pct = discountPercent(origN, saleN);
  const s = sizeMap[size];

  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-1', className)}>
      <span className={cn('font-bold text-brand', s.price)}>{formatMoney(saleN)}</span>
      {pct > 0 && (
        <>
          <span className={cn('text-muted-foreground line-through', s.compare)}>{formatMoney(origN)}</span>
          {showDiscount && (
            <span className={cn('rounded bg-brand/10 font-semibold text-brand', s.badge, 'px-1.5 py-0.5')}>
              -{pct}%
            </span>
          )}
        </>
      )}
    </div>
  );
}
