'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  className?: string;
  placeholder?: string;
}

/** Header search box — submits to /search?q=. Preserves an existing query. */
export function SearchBar({ className, placeholder = 'Search products, brands and more…' }: SearchBarProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <form onSubmit={onSubmit} className={cn('flex w-full items-center gap-2', className)}>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="pl-9"
          aria-label="Search products"
        />
      </div>
      <Button type="submit" variant="brand" className="shrink-0">
        <Search className="h-4 w-4 sm:hidden" />
        <span className="hidden sm:inline">Search</span>
      </Button>
    </form>
  );
}
