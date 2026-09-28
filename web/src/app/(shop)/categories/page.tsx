import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { mediaUrl } from '@/lib/env';
import type { Category } from '@/types';

export const metadata = {
  title: 'All Categories',
  description: 'Browse the full category tree — everything you can shop on MarketPlace.',
};

export const revalidate = 600;

export default async function CategoriesPage() {
  let categories: Category[] = [];
  try {
    categories = await apiGet<Category[]>('/catalog/categories', { next: { revalidate: 600 } });
  } catch {
    categories = [];
  }

  const byParent = new Map<string, Category[]>();
  for (const c of categories) {
    const key = c.parentId ?? '';
    const list = byParent.get(key) ?? [];
    list.push(c);
    byParent.set(key, list);
  }
  const roots = (byParent.get('') ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="container space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">All Categories</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {roots.length} top-level categories · {categories.length} total
        </p>
      </div>

      {roots.length === 0 ? (
        <p className="rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          Categories are being set up — check back shortly.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roots.map((root) => {
            const kids = (byParent.get(root.id) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
            return (
              <section key={root.id} className="rounded-xl border bg-card">
                <header className="border-b bg-muted/30 px-4 py-3">
                  <Link
                    href={`/category/${root.slug}`}
                    className="flex items-center justify-between gap-2 font-semibold hover:text-brand"
                  >
                    <span className="flex items-center gap-2">
                      {root.iconUrl ? (
                        <Image
                          src={mediaUrl(root.iconUrl)}
                          alt=""
                          width={24}
                          height={24}
                          className="h-6 w-6 rounded object-cover"
                        />
                      ) : (
                        <span className="flex h-6 w-6 items-center justify-center rounded bg-brand/10 text-xs font-bold text-brand">
                          {root.name.charAt(0)}
                        </span>
                      )}
                      {root.name}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </header>
                <div className="p-4">
                  {kids.length ? (
                    <ul className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
                      {kids.slice(0, 12).map((k) => (
                        <li key={k.id}>
                          <Link href={`/category/${k.slug}`} className="text-muted-foreground hover:text-brand hover:underline">
                            {k.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      <Link href={`/category/${root.slug}`} className="hover:text-brand">
                        Shop {root.name} →
                      </Link>
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
