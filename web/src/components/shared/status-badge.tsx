import { cn, classNamesForStatus } from '@/lib/utils';

/** Turn SCREAMING_SNAKE enum values into Title Case ("Out_For_Delivery" → "Out For Delivery"). */
function humanise(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

/** Coloured pill for order / product / payment / return / payout statuses. */
export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        classNamesForStatus(status),
        className,
      )}
    >
      {label ?? humanise(status)}
    </span>
  );
}
