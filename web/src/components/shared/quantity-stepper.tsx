'use client';

import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuantityStepperProps {
  value: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}

/** - / qty / + control used in cart, product page and seller forms. */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = Number.MAX_SAFE_INTEGER,
  size = 'md',
  disabled = false,
  className,
}: QuantityStepperProps) {
  const dec = () => onChange?.(Math.max(min, value - 1));
  const inc = () => onChange?.(Math.min(max, value + 1));
  const btn = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const input = size === 'sm' ? 'h-8 w-10 text-sm' : 'h-10 w-12';

  return (
    <div className={cn('inline-flex items-center rounded-md border', className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(btn, 'rounded-r-none')}
        onClick={dec}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange?.(Math.min(max, Math.max(min, n)));
        }}
        className={cn(
          input,
          'border-x bg-transparent text-center font-medium outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        )}
        aria-label="Quantity"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(btn, 'rounded-l-none')}
        onClick={inc}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
