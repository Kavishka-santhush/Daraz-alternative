import { SiteHeader } from '@/components/shared/site-header';
import { SiteFooter } from '@/components/shared/site-footer';
import { safeApiGet } from '@/lib/server-api';
import type { Category } from '@/types';

export const revalidate = 300;

/** Storefront shell: sticky header + footer around every public shopping page. */
export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const categories = await safeApiGet<Category[]>('/catalog/categories', []);
  const topLevel = categories.filter((c) => !c.parentId);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader categories={topLevel} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
