import { SiteHeader } from '@/components/shared/site-header';
import { SiteFooter } from '@/components/shared/site-footer';
import { AccountShell } from '@/components/shared/account-shell';
import { safeApiGet } from '@/lib/server-api';
import type { Category } from '@/types';

export const revalidate = 300;

/** Buyer account shell: storefront header + guarded sidebar layout + footer. */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const categories = await safeApiGet<Category[]>('/catalog/categories', []);
  const topLevel = categories.filter((c) => !c.parentId);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader categories={topLevel} />
      <main className="flex-1">
        <AccountShell>{children}</AccountShell>
      </main>
      <SiteFooter />
    </div>
  );
}
