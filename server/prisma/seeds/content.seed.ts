import { Prisma } from '@prisma/client';
import { prisma, section, info } from './helpers';
import type { ProductsResult } from './products.seed';
import type { UsersResult } from './users.seed';

/**
 * Buyer engagement data: reviews (with recomputed product ratings),
 * wishlists, a product Q&A, and shop follows.
 */
export async function seedContent(products: ProductsResult, users: UsersResult) {
  section('Content: reviews / wishlist / Q&A / follows');

  const buyers = users.buyerIds;
  const slugs = Object.keys(products.bySlug);

  // ── Reviews ──
  const templates = [
    { rating: 5, title: 'Excellent!', body: 'Exactly as described, super fast delivery. Highly recommended.' },
    { rating: 4, title: 'Very good', body: 'Great quality for the price. Packaging could be a bit better.' },
    { rating: 5, title: 'Love it', body: 'Buyer beware — you will want a second one. Five stars.' },
    { rating: 3, title: 'Okay', body: 'Does the job but nothing special. Average experience.' },
  ];

  let reviewCount = 0;
  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    const productId = products.bySlug[slug];
    const nReviews = 2 + (i % 2); // 2 or 3 reviews per product
    for (let r = 0; r < nReviews; r++) {
      const buyerId = buyers[(i + r) % buyers.length];
      const t = templates[(i + r) % templates.length];
      const exists = await prisma.review.findFirst({ where: { productId, buyerId } });
      if (exists) continue;
      await prisma.review.create({
        data: {
          productId,
          buyerId,
          rating: t.rating,
          title: t.title,
          body: t.body,
          isVerified: r === 0,
          isVisible: true,
        },
      });
      reviewCount++;
    }
    await recomputeProductRating(productId);
  }
  info(`${reviewCount} reviews (ratings recomputed)`);

  // ── Wishlist ──
  let wish = 0;
  for (const buyerId of buyers) {
    for (let i = 0; i < 2 && i < slugs.length; i++) {
      const slug = slugs[(i + buyers.indexOf(buyerId)) % slugs.length];
      const productId = products.bySlug[slug];
      const exists = await prisma.wishlistItem.findUnique({
        where: { userId_productId: { userId: buyerId, productId } },
      });
      if (exists) continue;
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) continue;
      await prisma.wishlistItem.create({
        data: {
          userId: buyerId,
          productId,
          priceAtAdd: product.salePrice ?? product.originalPrice,
        },
      });
      wish++;
    }
  }
  info(`${wish} wishlist items`);

  // ── Product Q&A ──
  const qaProduct = products.bySlug['galaxy-s24-ultra-256gb'];
  if (qaProduct && buyers.length) {
    const exists = await prisma.productQa.findFirst({ where: { productId: qaProduct, askedById: buyers[0] } });
    if (!exists) {
      await prisma.productQa.create({
        data: {
          productId: qaProduct,
          askedById: buyers[0],
          question: 'Does this come with a charger and warranty?',
          answer: 'Yes, it comes with a 25W fast charger and 1 year local warranty.',
          answeredById: users.seller.userId,
          answeredAt: new Date(),
          isVisible: true,
          isPublic: true,
        },
      });
    }
    info('product Q&A');
  }

  // ── Shop follows ──
  for (const buyerId of buyers) {
    const shop = users.shops[buyers.indexOf(buyerId) % users.shops.length];
    if (!shop) continue;
    await prisma.shop.update({
      where: { id: shop.shopId },
      data: { followers: { connect: [{ id: buyerId }] } },
    });
  }
  info(`${buyers.length} shop follows`);
}

async function recomputeProductRating(productId: string) {
  const agg = await prisma.review.aggregate({
    where: { productId, isVisible: true },
    _avg: { rating: true },
    _count: true,
  });
  await prisma.product.update({
    where: { id: productId },
    data: {
      ratingAverage: new Prisma.Decimal(agg._avg.rating ?? 0).toDecimalPlaces(2),
      ratingCount: agg._count,
    },
  });
}
