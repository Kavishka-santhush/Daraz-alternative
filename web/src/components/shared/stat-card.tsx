import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  /** Percentage change; positive → green up, negative → red down. */
  delta?: number;
  hint?: string;
  className?: string;
}

/** Compact KPI tile used across admin / seller / finance dashboards. */
export function StatCard({ label, value, icon: Icon, delta, hint, className }: StatCardProps) {
  const up = typeof delta === 'number' && delta >= 0;
  return (
    <Card className={className}>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
          {typeof delta === 'number' && (
            <p className={cn('mt-1 flex items-center gap-1 text-xs font-medium', up ? 'text-green-600' : 'text-red-600')}>
              {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {up ? '+' : ''}
              {delta.toFixed(1)}%
            </p>
          )}
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
