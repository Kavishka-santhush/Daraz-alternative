import { Star } from 'lucide-react';
import { cn, num } from '@/lib/utils';

interface RatingStarsProps {
  rating?: string | number | null;
  count?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showValue?: boolean;
}

const starSize = { sm: 'h-3 w-3', md: 'h-4 w-4', lg: 'h-5 w-5' };

/** Read-only 5-star rating with optional review count. */
export function RatingStars({ rating, count, size = 'sm', className, showValue = false }: RatingStarsProps) {
  const value = num(rating);
  const rounded = Math.round(value);
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div className="flex items-center">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              starSize[size],
              i < rounded ? 'fill-amber-400 text-amber-400' : 'fill-none text-gray-300',
            )}
          />
        ))}
      </div>
      {showValue && <span className="text-xs font-medium text-gray-700">{value.toFixed(1)}</span>}
      {typeof count === 'number' && (
        <span className="text-xs text-muted-foreground">({count})</span>
      )}
    </div>
  );
}
