import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';
import { paginated } from '../../utils/pagination';
import { notify } from '../notifications/notification.service';
import { templates } from '../../lib/email/templates';
import type { Request } from 'express';

const productSelect = {
  id: true, slug: true, title: true, salePrice: true, originalPrice: true, discountPercent: true,
  stockQuantity: true, ratingAverage: true, ratingCount: true, status: true,
  images: { select: { url: true, position: true }, orderBy: { position: 'asc' as const }, take: 1 },
  shop: { select: { name: true, slug: true } },
} satisfies Prisma.ProductSelect;

/** Current effective price of a product (flash-sale aware). */
function effectivePrice(p: { salePrice: Prisma.Decimal | null; originalPrice: Prisma.Decimal }, flashPrice?: Prisma.Decimal | null): number {
  if (flashPrice) return Number(flashPrice);
  return Number(p.salePrice ?? p.originalPrice);
}

export async function listWishlist(userId: string, req: Request) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const [items, total] = await prisma.$transaction([
    prisma.wishlistItem.findMany({ where: { userId }, include: { product: { select: productSelect } }, orderBy: { addedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.wishlistItem.count({ where: { userId } }),
  ]);
  const data = items.map((w) => {
    const currentPrice = effectivePrice(w.product);
    return {
      id: w.id,
      addedAt: w.addedAt,
      priceAtAdd: Number(w.priceAtAdd),
      currentPrice,
      inStock: w.product.stockQuantity > 0 && w.product.status === 'ACTIVE',
      priceDropped: currentPrice < Number(w.priceAtAdd),
      product: w.product,
    };
  });
  return paginated(data, total, page, limit);
}

export async function addToWishlist(userId: string, productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, salePrice: true, originalPrice: true } });
  if (!product) throw ApiError.notFound('Product not found');
  const price = new Prisma.Decimal(effectivePrice(product));
  const existing = await prisma.wishlistItem.findUnique({ where: { userId_productId: { userId, productId } } });
  if (existing) return { id: existing.id, alreadyExists: true };
  const item = await prisma.wishlistItem.create({ data: { userId, productId, priceAtAdd: price } });
  return { id: item.id, added: true };
}

export async function removeFromWishlist(userId: string, productId: string) {
  const item = await prisma.wishlistItem.findUnique({ where: { userId_productId: { userId, productId } } });
  if (!item) throw ApiError.notFound('Item is not in your wishlist');
  await prisma.wishlistItem.delete({ where: { id: item.id } });
  return { removed: true };
}

export async function toggleWishlist(userId: string, productId: string) {
  const existing = await prisma.wishlistItem.findUnique({ where: { userId_productId: { userId, productId } } });
  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    return { inWishlist: false };
  }
  await addToWishlist(userId, productId);
  return { inWishlist: true };
}

export async function clearWishlist(userId: string) {
  const { count } = await prisma.wishlistItem.deleteMany({ where: { userId } });
  return { removed: count };
}

/** Ids only — cheap check used by product pages to render the heart state. */
export async function wishlistProductIds(userId: string) {
  const rows = await prisma.wishlistItem.findMany({ where: { userId }, select: { productId: true } });
  return rows.map((r) => r.productId);
}

/**
 * Scheduled job: notify buyers when a wishlisted item drops in price or is
 * back in stock. Marks lastNotifiedAt to avoid spamming on every run.
 */
export async function processPriceDropAlerts() {
  const items = await prisma.wishlistItem.findMany({
    where: { product: { status: 'ACTIVE' }, OR: [{ lastNotifiedAt: null }, { lastNotifiedAt: { lt: new Date(Date.now() - 7 * 86400000) } }] },
    include: { product: { select: productSelect }, user: { select: { id: true, name: true, email: true } } },
    take: 500,
  });
  let notified = 0;
  for (const item of items) {
    const currentPrice = effectivePrice(item.product);
    const dropped = currentPrice < Number(item.priceAtAdd);
    const backInStock = item.product.stockQuantity > 0 && item.lastNotifiedAt !== null;
    if (!dropped && !backInStock) continue;
    const title = dropped ? 'Price drop on your wishlist item' : 'Back in stock';
    const body = `${item.product.title} — ${dropped ? `now ${currentPrice} (was ${Number(item.priceAtAdd)})` : 'available again'}`;
    await notify({
      userId: item.user.id,
      type: dropped ? 'WISHLIST_PRICE_DROP' : 'WISHLIST_BACK_IN_STOCK',
      title,
      body,
      actionUrl: `/products/${item.product.slug}`,
      emailHtml: templates.generic(item.user.name, title, body),
    }).catch(() => {});
    await prisma.wishlistItem.update({ where: { id: item.id }, data: { priceAtAdd: new Prisma.Decimal(currentPrice), lastNotifiedAt: new Date() } });
    notified += 1;
  }
  return { scanned: items.length, notified };
}
