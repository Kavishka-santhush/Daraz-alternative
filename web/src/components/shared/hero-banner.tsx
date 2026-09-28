'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { mediaUrl } from '@/lib/env';
import { cn } from '@/lib/utils';
import type { Banner } from '@/types';

interface HeroBannerProps {
  banners: Banner[];
  intervalMs?: number;
}

/** Auto-rotating hero carousel of homepage banners. */
export function HeroBanner({ banners, intervalMs = 5000 }: HeroBannerProps) {
  const [index, setIndex] = useState(0);
  const count = banners.length;

  const go = useCallback((n: number) => setIndex((prev) => (n + count) % count), [count]);

  useEffect(() => {
    if (count <= 1) return;
    const id = setInterval(() => setIndex((p) => (p + 1) % count), intervalMs);
    return () => clearInterval(id);
  }, [count, intervalMs]);

  if (count === 0) {
    return (
      <div className="flex aspect-[2/1] w-full items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white sm:aspect-[3/1]">
        <p className="text-lg font-semibold">Welcome to MarketPlace</p>
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-xl">
      <div className="relative aspect-[2/1] w-full sm:aspect-[3/1]">
        {banners.map((b, i) => (
          <div
            key={b.id}
            className={cn('absolute inset-0 transition-opacity duration-500', i === index ? 'opacity-100' : 'pointer-events-none opacity-0')}
          >
            {b.targetUrl ? (
              <Link href={b.targetUrl}>
                <Image src={mediaUrl(b.imageUrl)} alt={b.altText || b.title} fill priority={i === 0} sizes="100vw" className="object-cover" />
              </Link>
            ) : (
              <Image src={mediaUrl(b.imageUrl)} alt={b.altText || b.title} fill priority={i === 0} sizes="100vw" className="object-cover" />
            )}
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => go(index - 1)}
            className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 opacity-0 shadow transition-opacity group-hover:opacity-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => go(index + 1)}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 opacity-0 shadow transition-opacity group-hover:opacity-100"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/60')}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
