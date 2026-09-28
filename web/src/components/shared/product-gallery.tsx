'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { mediaUrl } from '@/lib/env';
import type { ProductImage } from '@/types';

interface ProductGalleryProps {
  images: ProductImage[];
  title: string;
  videoUrl?: string | null;
}

/** Main product image with thumbnail strip and prev/next. */
export function ProductGallery({ images, title, videoUrl }: ProductGalleryProps) {
  const sorted = [...images].sort((a, b) => a.position - b.position);
  const [active, setActive] = useState(0);
  const current = sorted[active];
  const hasVideo = Boolean(videoUrl && /youtube|vimeo/i.test(videoUrl));

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border bg-muted">
        {hasVideo ? (
          <iframe
            src={videoUrl!}
            title={`${title} video`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        ) : current ? (
          <Image
            src={mediaUrl(current.url)}
            alt={current.altText || title}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No image</div>
        )}
      </div>

      {(sorted.length > 1 || hasVideo) && (
        <div className="flex flex-wrap gap-2">
          {hasVideo && (
            <button
              type="button"
              onClick={() => setActive(0)}
              className={cn('flex aspect-square h-16 w-16 items-center justify-center rounded-md border text-[10px] font-semibold', 'text-muted-foreground')}
            >
              Video
            </button>
          )}
          {sorted.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                'relative aspect-square h-16 w-16 overflow-hidden rounded-md border',
                i === active ? 'border-brand ring-1 ring-brand' : 'border-transparent hover:border-gray-300',
              )}
            >
              <Image src={mediaUrl(img.url)} alt={img.altText || `${title} ${i + 1}`} fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
