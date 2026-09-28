import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Store, BadgeCheck, MessageSquareQuestion } from 'lucide-react';
import { ProductGallery } from '@/components/shared/product-gallery';
import { PurchasePanel } from '@/components/shared/purchase-panel';
import { ProductGrid } from '@/components/shared/product-grid';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { safeApiGet } from '@/lib/server-api';
import { timeAgo } from '@/lib/utils';
import type { Product, ProductDetail } from '@/types';

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps) {
  const product = await safeApiGet<ProductDetail | null>(`/products/${params.slug}`, null);
  if (!product) return { title: 'Product not found' };
  return {
    title: product.title,
    description: product.subtitle || product.description?.slice(0, 160),
  };
}

export default async function ProductPage({ params }: PageProps) {
  const product = await safeApiGet<ProductDetail | null>(`/products/${params.slug}`, null);
  if (!product) notFound();

  const related = await safeApiGet<Product[]>('/search', [], {
    query: { categoryId: product.category?.id, limit: 12 },
  }).then((list) => list.filter((p) => p.id !== product.id).slice(0, 8));

  const attributes = (product.attributes ?? {}) as Record<string, unknown>;

  return (
    <div className="container py-6">
      {/* Breadcrumb */}
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-brand">Home</Link>
        {product.category && (
          <>
            <span>/</span>
            <Link href={`/category/${product.category.slug}`} className="hover:text-brand">{product.category.name}</Link>
          </>
        )}
        <span>/</span>
        <span className="line-clamp-1 text-foreground">{product.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery images={product.images ?? []} title={product.title} videoUrl={product.videoUrl} />

        <div>
          <h1 className="text-xl font-bold sm:text-2xl">{product.title}</h1>
          {product.subtitle && <p className="mt-1 text-sm text-muted-foreground">{product.subtitle}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {product.brand && <span>Brand: <Link href={`/search?brandId=${product.brand.id}`} className="font-medium text-brand hover:underline">{product.brand.name}</Link></span>}
            <span>·</span>
            <span>SKU: {product.sku}</span>
            {product.condition && (
              <>
                <span>·</span>
                <Badge variant="secondary" className="text-xs">{product.condition}</Badge>
              </>
            )}
          </div>

          <Separator className="my-4" />
          <PurchasePanel product={product} />

          {product.shop && (
            <div className="mt-4 flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <Store className="h-5 w-5 text-brand" />
                </div>
                <div>
                  <p className="flex items-center gap-1 text-sm font-semibold">
                    {product.shop.name}
                    {(product.shop as { seller?: { isVerified?: boolean } }).seller?.isVerified && (
                      <BadgeCheck className="h-4 w-4 text-blue-600" />
                    )}
                  </p>
                  <Link href={`/shop/${product.shop.slug}`} className="text-xs text-brand hover:underline">
                    Visit store
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Description + attributes */}
      <section className="mt-10 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-bold">Description</h2>
          <div className="prose prose-sm max-w-none whitespace-pre-line text-sm text-foreground/90">
            {product.description}
          </div>

          {Object.keys(attributes).length > 0 && (
            <>
              <h2 className="mb-3 mt-8 text-lg font-bold">Specifications</h2>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                {Object.entries(attributes).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b py-1.5">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>

        {/* Q&A */}
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <MessageSquareQuestion className="h-5 w-5 text-brand" /> Questions &amp; Answers
          </h2>
          {(!product.qa || product.qa.length === 0) ? (
            <p className="text-sm text-muted-foreground">No questions yet.</p>
          ) : (
            <ul className="space-y-4">
              {product.qa.slice(0, 5).map((qa) => (
                <li key={qa.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{qa.question}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{qa.askedBy?.name} · {timeAgo(qa.createdAt)}</p>
                  {qa.answer && (
                    <div className="mt-2 border-l-2 border-brand pl-3">
                      <p>{qa.answer}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{qa.answeredBy?.name ?? 'Seller'}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-lg font-bold sm:text-xl">Related Products</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
