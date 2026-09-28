'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface CountdownProps {
  endsAt: string | number | Date;
  className?: string;
  compact?: boolean;
  onExpire?: () => void;
}

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { days, hours, minutes, seconds, done: total === 0 };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Live countdown timer to a target date (flash sales, deals, limited offers). */
export function Countdown({ endsAt, className, compact = false, onExpire }: CountdownProps) {
  const [state, setState] = useState(() => parts(new Date(endsAt).getTime() - Date.now()));

  useEffect(() => {
    const target = new Date(endsAt).getTime();
    const tick = () => {
      const p = parts(target - Date.now());
      setState(p);
      if (p.done) {
        onExpire?.();
        clearInterval(id);
      }
    };
    const id = setInterval(tick, 1000);
    tick();
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);

  const unit = (v: number, label: string) => (
    <div className="flex flex-col items-center">
      <span className={cn('min-w-[2ch] rounded bg-brand px-1.5 py-1 font-mono text-sm font-bold text-white', compact && 'px-1 py-0.5 text-xs')}>
        {pad(v)}
      </span>
      {!compact && <span className="mt-1 text-[10px] uppercase text-muted-foreground">{label}</span>}
    </div>
  );

  if (state.done) return <span className={cn('text-sm font-medium text-muted-foreground', className)}>Offer ended</span>;

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {state.days > 0 && (
        <>
          {unit(state.days, 'days')}
          <span className={cn(state.days > 0 && 'text-brand', compact && 'hidden')}>d</span>
        </>
      )}
      {unit(state.hours, 'hrs')}
      <span className="text-brand">:</span>
      {unit(state.minutes, 'min')}
      <span className="text-brand">:</span>
      {unit(state.seconds, 'sec')}
    </div>
  );
}
