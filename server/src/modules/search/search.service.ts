import { Prisma, ProductStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { paginated } from '../../utils/pagination';
import { chatJson } from '../../lib/ai/openrouter';
import { slugify } from '../../utils/nano';

/** Fields that make a product card renderable in the storefront. */
const cardInclude = {
  images: { where: { isPrimary: true }, take: 1, select: { url: true } },
  shop: { select: { name: true, slug: true } },
  brand: { select: { name: true, slug: true } },
  category: { select: { name: true, slug: true } },
} satisfies Prisma.ProductInclude;

function shapeCard(p: any) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    image: p.images?.[0]?.url ?? null,
    price: p.salePrice != null ? Number(p.salePrice) : Number(p.originalPrice),
    originalPrice: Number(p.originalPrice),
    discountPercent: Number(p.discountPercent),
    ratingAverage: Number(p.ratingAverage),
    ratingCount: p.ratingCount,
    soldCount: p.soldCount,
    stockQuantity: p.stockQuantity,
    condition: p.condition,
    isFeatured: p.isFeatured,
    shop: p.shop,
    brand: p.brand?.name ?? null,
    category: p.category?.name ?? null,
  };
}

export interface SearchInput {
  q?: string;
  categoryId?: string;
  brandId?: string;
  shopId?: string;
  condition?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStock?: boolean;
  onSale?: boolean;
  attributes?: Record<string, string | string[]>;
  sort?: 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'rating' | 'best_selling';
  page?: number;
  limit?: number;
}

/**
 * pg_trgm-backed keyword search plus faceted filtering.
 * Title/description use similarity() ordering (trigram index) with an ILIKE
 * fallback so results are returned even before the extension is created.
 */
export async function searchProducts(input: SearchInput, viewerId?: string) {
  const page = Number(input.page ?? 1);
  const limit = Number(input.limit ?? 24);
  const where: Prisma.ProductWhereInput = { status: ProductStatus.ACTIVE };
  const and: Prisma.ProductWhereInput[] = [];

  const term = (input.q ?? '').trim();
  if (term) {
    and.push({
      OR: [
        { title: { contains: term, mode: 'insensitive' } },
        { subtitle: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { tags: { has: slugify(term) } },
        { brand: { name: { contains: term, mode: 'insensitive' } } },
        { category: { name: { contains: term, mode: 'insensitive' } } },
      ],
    });
  }
  if (input.categoryId) {
    const descendants = await prisma.category.findMany({ where: { path: { contains: input.categoryId } }, select: { id: true } });
    where.categoryId = { in: [input.categoryId, ...descendants.map((d) => d.id)] };
  }
  if (input.brandId) where.brandId = input.brandId;
  if (input.shopId) where.shopId = input.shopId;
  if (input.condition) where.condition = input.condition as never;
  if (input.minRating) where.ratingAverage = { gte: Number(input.minRating) };
  if (input.inStock) where.stockQuantity = { gt: 0 };
  if (input.onSale) where.OR = [{ salePrice: { not: null } }, { discountPercent: { gt: 0 } }];
  for (const [key, value] of Object.entries(input.attributes ?? {})) {
    const values = Array.isArray(value) ? value : [value];
    and.push({ variants: { some: { attributeValues: { some: { attribute: { slug: key }, attributeValue: { in: values } } } } } });
  }
  if (input.minPrice != null || input.maxPrice != null) {
    const gte = input.minPrice != null ? Number(input.minPrice) : undefined;
    const lte = input.maxPrice != null ? Number(input.maxPrice) : undefined;
    and.push({
      OR: [
        { salePrice: { gte, lte } },
        { salePrice: null, originalPrice: { gte, lte } },
      ],
    });
  }
  if (and.length) where.AND = and;

  const orderBy = mapSort(input.sort);
  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({ where, include: cardInclude, orderBy, skip: (page - 1) * limit, take: limit }),
    prisma.product.count({ where }),
  ]);

  // Trigram re-ranking of the result page (best effort; ignores failure when
  // pg_trgm has not been created yet).
  let ranked: any[] = items.map(shapeCard);
  if (term && items.length > 1) {
    try {
      const scores = await prisma.$queryRaw<{ id: string; score: number }[]>`
        SELECT id, similarity(title, ${term}) AS score
        FROM "Product"
        WHERE id IN (${Prisma.join(items.map((i) => i.id))})`;
      const map = new Map<string, number>(scores.map((s) => [s.id, Number(s.score)]));
      ranked = [...ranked].sort((a: any, b: any) => (map.get(b.id) ?? 0) - (map.get(a.id) ?? 0));
    } catch {
      /* pg_trgm unavailable — keep the database ordering */
    }
  }

  if (term) void logSearch(viewerId ?? null, term, total, ranked[0]?.id);
  return { ...paginated(ranked, total, page, limit), facets: undefined };
}

function mapSort(sort?: SearchInput['sort']): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'price_asc':
      return [{ salePrice: { sort: 'asc', nulls: 'last' } }, { originalPrice: 'asc' }];
    case 'price_desc':
      return [{ salePrice: { sort: 'desc', nulls: 'first' } }, { originalPrice: 'desc' }];
    case 'newest':
      return [{ createdAt: 'desc' }];
    case 'best_selling':
      return [{ soldCount: 'desc' }];
    case 'rating':
      return [{ ratingAverage: 'desc' }, { ratingCount: 'desc' }];
    default:
      return [{ isFeatured: 'desc' }, { soldCount: 'desc' }, { createdAt: 'desc' }];
  }
}

/** Aggregations used to render the filter sidebar. */
export async function getFacets(input: SearchInput) {
  const base: Prisma.ProductWhereInput = { status: ProductStatus.ACTIVE };
  if (input.q) base.OR = [{ title: { contains: input.q, mode: 'insensitive' } }, { description: { contains: input.q, mode: 'insensitive' } }];
  const [categories, brands, price, conditions] = await prisma.$transaction([
    prisma.product.groupBy({ by: ['categoryId'], where: base, _count: { categoryId: true }, orderBy: { _count: { categoryId: 'desc' } }, take: 12 }),
    prisma.product.groupBy({ by: ['brandId'], where: { ...base, brandId: { not: null } }, _count: { brandId: true }, orderBy: { _count: { brandId: 'desc' } }, take: 12 }),
    prisma.product.aggregate({ where: base, _min: { originalPrice: true }, _max: { originalPrice: true } }),
    prisma.product.groupBy({ by: ['condition'], where: base, _count: true, orderBy: { condition: 'asc' } }),
  ]);
  const categoryIds = categories.map((c) => c.categoryId).filter(Boolean);
  const brandIds = brands.map((b) => b.brandId).filter(Boolean) as string[];
  const [categoryMeta, brandMeta] = await prisma.$transaction([
    prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true, slug: true } }),
    prisma.brand.findMany({ where: { id: { in: brandIds } }, select: { id: true, name: true, slug: true } }),
  ]);
  return {
    categories: categories.map((c) => ({ ...categoryMeta.find((m) => m.id === c.categoryId), count: c._count.categoryId })),
    brands: brands.map((b) => ({ ...brandMeta.find((m) => m.id === b.brandId), count: b._count.brandId })),
    conditions: conditions.map((c) => ({ condition: c.condition, count: c._count })),
    price: { min: Number(price._min.originalPrice ?? 0), max: Number(price._max.originalPrice ?? 0) },
  };
}

/**
 * AI query understanding: turns natural language ("gifts for gamers under
 * 5000") into structured filters, then runs the search.
 */
export async function aiSearch(query: string, viewerId?: string) {
  const taxonomy = await prisma.category.findMany({ where: { parentId: null }, select: { slug: true, name: true }, take: 40 });
  const parsed = await chatJson<{ keywords: string; categorySlug?: string; minPrice?: number; maxPrice?: number; sort?: SearchInput['sort'] }>(
    `Convert this shopping request into structured search filters. Known top categories: ${taxonomy.map((t) => t.slug).join(', ')}. Return JSON {"keywords":"..","categorySlug":"..or omit","minPrice":number|omit,"maxPrice":number|omit,"sort":"relevance|price_asc|price_desc|rating|newest|best_selling"}.\nRequest: ${query}`,
    'You are an e-commerce search intent parser. Reply with JSON only, no commentary.',
  );
  const input: SearchInput = { q: parsed?.keywords || query, sort: parsed?.sort ?? 'relevance', limit: 24 };
  if (parsed?.categorySlug) {
    const category = await prisma.category.findUnique({ where: { slug: parsed.categorySlug }, select: { id: true } });
    if (category) input.categoryId = category.id;
  }
  if (typeof parsed?.minPrice === 'number') input.minPrice = parsed.minPrice;
  if (typeof parsed?.maxPrice === 'number') input.maxPrice = parsed.maxPrice;
  const results = await searchProducts(input, viewerId);
  return { interpretation: { ...input, originalQuery: query }, results: results.data, meta: results.meta };
}

export async function suggestions(q: string, limit = 8) {
  const term = (q ?? '').trim();
  if (term.length < 2) return [];
  const [products, queries] = await prisma.$transaction([
    prisma.product.findMany({ where: { status: ProductStatus.ACTIVE, title: { contains: term, mode: 'insensitive' } }, select: { title: true, slug: true }, orderBy: [{ soldCount: 'desc' }], take: limit }),
    prisma.searchQuery.findMany({ where: { normalized: { contains: slugify(term) } }, select: { query: true }, distinct: ['normalized'], orderBy: { createdAt: 'desc' }, take: limit }),
  ]);
  const set = new Set<string>();
  for (const p of products) set.add(p.title);
  for (const s of queries) set.add(s.query);
  return Array.from(set).slice(0, limit).map((text) => ({ text }));
}

export async function popularSearches(limit = 10) {
  const since = new Date(Date.now() - 30 * 86400000);
  const rows = await prisma.searchQuery.groupBy({ by: ['normalized'], where: { createdAt: { gte: since } }, _count: { normalized: true }, orderBy: { _count: { normalized: 'desc' } }, take: limit });
  const meta = await prisma.searchQuery.findMany({ where: { normalized: { in: rows.map((r) => r.normalized) } }, select: { normalized: true, query: true }, distinct: ['normalized'] });
  return rows.map((r) => ({ query: meta.find((m) => m.normalized === r.normalized)?.query ?? r.normalized, count: r._count.normalized }));
}

export async function logSearch(userId: string | null, query: string, resultsCount: number, clickedProductId?: string) {
  await prisma.searchQuery.create({ data: { userId, query, normalized: slugify(query).slice(0, 120), resultsCount, clickedProductId } }).catch(() => {});
}

export async function recordSearchClick(searchQueryId: string, productId: string) {
  await prisma.searchQuery.update({ where: { id: searchQueryId }, data: { clickedProductId: productId } }).catch(() => {});
}

/** Persist a product view for recommendations/analytics; safe to call often. */
export async function recordView(productId: string, userId?: string | null, sessionId?: string, referrer?: string) {
  await prisma.productView.create({ data: { productId, userId: userId ?? null, sessionId, referrer } }).catch(() => {});
  await prisma.product.update({ where: { id: productId }, data: { viewCount: { increment: 1 } } }).catch(() => {});
  return { ok: true };
}
