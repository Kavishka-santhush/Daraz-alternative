import { Prisma, ProductStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { chatJson } from '../../lib/ai/openrouter';

const cardSelect = {
  id: true, slug: true, title: true, subtitle: true, salePrice: true, originalPrice: true,
  discountPercent: true, ratingAverage: true, ratingCount: true, soldCount: true, stockQuantity: true,
  categoryId: true, brandId: true,
  images: { where: { isPrimary: true }, take: 1, select: { url: true } },
  shop: { select: { name: true, slug: true } },
  brand: { select: { name: true } },
} satisfies Prisma.ProductSelect;

function shape(p: any) {
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
    shop: p.shop,
    brand: p.brand?.name ?? null,
  };
}

const active = { status: ProductStatus.ACTIVE, stockQuantity: { gt: 0 } } satisfies Prisma.ProductWhereInput;

export async function getSimilarProducts(productId: string, limit = 12) {
  const seed = await prisma.product.findUnique({ where: { id: productId }, select: { categoryId: true, brandId: true, title: true, tags: true } });
  if (!seed) return [];
  const or: Prisma.ProductWhereInput[] = [{ categoryId: seed.categoryId }];
  if (seed.brandId) or.push({ brandId: seed.brandId });
  const items = await prisma.product.findMany({
    where: { ...active, id: { not: productId }, OR: or, soldCount: { gt: 0 } },
    select: cardSelect,
    orderBy: [{ ratingAverage: 'desc' }, { soldCount: 'desc' }],
    take: limit,
  });
  const fallback = items.length >= Math.min(4, limit)
    ? []
    : await prisma.product.findMany({ where: { ...active, id: { notIn: [productId, ...items.map((i) => i.id)] }, categoryId: seed.categoryId }, select: cardSelect, orderBy: { soldCount: 'desc' }, take: limit - items.length });
  return [...items, ...fallback].map(shape);
}

/** Commonly-bought-together: products from the same sub-order history. */
export async function getFrequentlyBoughtTogether(productId: string, limit = 6) {
  const orderIds = await prisma.orderItem.findMany({ where: { productId }, select: { subOrderId: true }, take: 400 });
  const ids = orderIds.map((o) => o.subOrderId);
  if (!ids.length) return [];
  const peers = await prisma.orderItem.findMany({ where: { subOrderId: { in: ids }, productId: { not: productId } }, select: { productId: true }, take: 800 });
  const counts = new Map<string, number>();
  for (const p of peers) counts.set(p.productId, (counts.get(p.productId) ?? 0) + 1);
  const topIds = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
  if (!topIds.length) return [];
  const items = await prisma.product.findMany({ where: { ...active, id: { in: topIds } }, select: cardSelect });
  return items.sort((a, b) => topIds.indexOf(a.id) - topIds.indexOf(b.id)).map((i) => ({ ...shape(i), boughtTogetherCount: counts.get(i.id) ?? 0 }));
}

export async function getRecentlyViewed(userId: string, limit = 12) {
  const views = await prisma.productView.findMany({ where: { userId }, select: { productId: true }, distinct: ['productId'], orderBy: { createdAt: 'desc' }, take: limit });
  if (!views.length) return [];
  const items = await prisma.product.findMany({ where: { id: { in: views.map((v) => v.productId) } }, select: cardSelect });
  const order = new Map(views.map((v, i) => [v.productId, i]));
  return items.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).map(shape);
}

export async function getBestSellers(limit = 12, categoryId?: string) {
  const items = await prisma.product.findMany({
    where: { ...active, ...(categoryId ? { categoryId } : {}) },
    select: cardSelect,
    orderBy: [{ soldCount: 'desc' }, { ratingAverage: 'desc' }],
    take: limit,
  });
  return items.map(shape);
}

export async function getTopRated(limit = 12, categoryId?: string) {
  const items = await prisma.product.findMany({
    where: { ...active, ratingCount: { gte: 5 }, ...(categoryId ? { categoryId } : {}) },
    select: cardSelect,
    orderBy: [{ ratingAverage: 'desc' }, { ratingCount: 'desc' }],
    take: limit,
  });
  return items.map(shape);
}

/**
 * Personalised homepage feed: blends the buyer's browsing/loyalty history
 * (categories they engage with) with trending catalogue items.
 */
export async function getPersonalizedFeed(userId: string, limit = 24) {
  const [views, purchases, wishlist] = await prisma.$transaction([
    prisma.productView.findMany({ where: { userId }, select: { product: { select: { categoryId: true, brandId: true } } }, orderBy: { createdAt: 'desc' }, take: 80 }),
    prisma.orderItem.findMany({ where: { subOrder: { order: { buyerId: userId } } }, select: { product: { select: { categoryId: true, brandId: true } } }, take: 80 }),
    prisma.wishlistItem.findMany({ where: { userId }, select: { product: { select: { categoryId: true, brandId: true } } }, take: 40 }),
  ]);
  const affinity = new Map<string, number>();
  const add = (id: string | null | undefined, weight: number) => {
    if (!id) return;
    affinity.set(id, (affinity.get(id) ?? 0) + weight);
  };
  for (const v of views) add(v.product?.categoryId, 1);
  for (const p of purchases) add(p.product?.categoryId, 3);
  for (const w of wishlist) add(w.product?.categoryId, 2);
  const rankedCategories = [...affinity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);

  const seen = new Set<string>();
  const out: any[] = [];
  if (rankedCategories.length) {
    const items = await prisma.product.findMany({ where: { ...active, categoryId: { in: rankedCategories } }, select: cardSelect, orderBy: [{ ratingAverage: 'desc' }, { soldCount: 'desc' }], take: Math.ceil(limit * 0.7) });
    for (const i of items) { seen.add(i.id); out.push(shape(i)); }
  }
  if (out.length < limit) {
    const trending = await prisma.product.findMany({ where: { ...active, id: { notIn: [...seen] } }, select: cardSelect, orderBy: { soldCount: 'desc' }, take: limit - out.length });
    for (const i of trending) out.push(shape(i));
  }
  return out.slice(0, limit);
}

/** AI companion: recommend products for a free-text shopper intent. */
export async function aiRecommend(query: string, userId?: string, limit = 8) {
  const categories = await prisma.category.findMany({ where: { parentId: null }, select: { slug: true, name: true }, take: 40 });
  const intent = await chatJson<{ categorySlugs?: string[]; keywords?: string[]; maxPrice?: number }>(
    `Shopper request: "${query}". Available top categories: ${categories.map((c) => c.slug).join(', ')}. Return JSON {"categorySlugs":[...],"keywords":["product nouns to match"],"maxPrice":number|omit}.`,
    'You are a shopping assistant. Reply with JSON only.',
  );
  const categoryIds: string[] = [];
  for (const slug of intent?.categorySlugs ?? []) {
    const c = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
    if (c) categoryIds.push(c.id);
  }
  const keywords = (intent?.keywords ?? []).filter((k) => typeof k === 'string' && k.length > 2).slice(0, 6);
  const and: Prisma.ProductWhereInput[] = [];
  if (keywords.length) and.push({ OR: keywords.map((k) => ({ title: { contains: k, mode: 'insensitive' as const } })) });
  if (intent?.maxPrice) and.push({ OR: [{ salePrice: { lte: intent.maxPrice } }, { salePrice: null, originalPrice: { lte: intent.maxPrice } }] });
  const where: Prisma.ProductWhereInput = {
    ...active,
    ...(categoryIds.length ? { categoryId: { in: categoryIds } } : {}),
    ...(and.length ? { AND: and } : {}),
  };
  const items = await prisma.product.findMany({ where, select: cardSelect, orderBy: [{ ratingAverage: 'desc' }, { soldCount: 'desc' }], take: limit });
  const rationale = await chatJson<{ text: string }>(
    `In one short friendly sentence, explain why these products fit the request "${query}". Products: ${items.map((i) => i.title).join(', ') || 'none'}. Return JSON {"text":"..."}.`,
    'You are a shopping assistant. Reply with JSON only.',
  );
  const extras = items.length < limit ? await getBestSellers(limit - items.length) : [];
  return {
    query,
    intent: { categorySlugs: intent?.categorySlugs ?? [], keywords, maxPrice: intent?.maxPrice },
    rationale: rationale?.text ?? 'Based on popularity and ratings.',
    products: [...items.map(shape), ...extras],
    personalized: Boolean(userId),
  };
}
