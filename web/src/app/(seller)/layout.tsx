import { SiteHeader } from '@/components/shared/site-header';
import { SiteFooter } from '@/components/shared/site-footer';
import { SellerShell } from '@/components/shared/seller-shell';
import { safeApiGet } from '@/lib/server-api';
import type { Category } from '@/types';

export const revalidate = 300;

/** Seller dashboard shell: storefront header + guarded sidebar layout + footer. */
export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const categories = await safeApiGet<Category[]>('/catalog/categories', []);
  const topLevel = categories.filter((c) => !c.parentId);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader categories={topLevel} />
      <main className="flex-1">
        <SellerShell>{children}</SellerShell>
      </main>
      <SiteFooter />
    </div>
  );
}
