'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  pages: number;
  /** Base href builder — receives the target page number. */
  href: (page: number) => string;
  className?: string;
}

/** SEO-friendly anchor pagination (works with server components & next/link). */
export function Pagination({ page, pages, href, className }: PaginationProps) {
  if (pages <= 1) return null;

  const range: (number | '…')[] = [];
  const push = (n: number | '…') => range.push(n);
  const window = 1;
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || (i >= page - window && i <= page + window)) push(i);
    else if (range[range.length - 1] !== '…') push('…');
  }

  const linkCls = (active?: boolean) =>
    cn(
      buttonVariants({ variant: active ? 'brand' : 'outline', size: 'icon' }),
      'h-9 w-9 text-sm',
    );

  return (
    <nav className={cn('flex items-center justify-center gap-1.5', className)} aria-label="Pagination">
      {page > 1 ? (
        <Link href={href(page - 1)} className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'h-9 w-9')} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : (
        <span className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'h-9 w-9 pointer-events-none opacity-50')}>
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}

      {range.map((r, i) =>
        r === '…' ? (
          <span key={`gap-${i}`} className="px-1 text-muted-foreground">
            …
          </span>
        ) : (
          <Link key={r} href={href(r)} className={linkCls(r === page)} aria-current={r === page ? 'page' : undefined}>
            {r}
          </Link>
        ),
      )}

      {page < pages ? (
        <Link href={href(page + 1)} className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'h-9 w-9')} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'h-9 w-9 pointer-events-none opacity-50')}>
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}
