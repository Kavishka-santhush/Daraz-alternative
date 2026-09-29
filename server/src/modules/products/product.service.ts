import { ProductStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';
import { slugify, uniqueSlug } from '../../utils/nano';
import { paginated } from '../../utils/pagination';
import { notifyLowStock } from './inventory.service';

/** Computes the auto discount percentage from original vs sale price. */
function discountPercent(original: number, sale?: number): number {
  if (!sale || sale >= original) return 0;
  return Number((((original - sale) / original) * 100).toFixed(2));
}

export async function createProduct(userId: string, data: any) {
  const shop = await ensureShopOwnership(data.shopId, userId);
  const effectiveStatus = data.submitForReview ? ProductStatus.PENDING_REVIEW : ProductStatus.DRAFT;
  const slug = await uniqueSlug(slugify(data.title), async (s) => !!(await prisma.product.findUnique({ where: { slug: s } })));
  const salePrice = data.salePrice ?? null;

  return prisma.product.create({
    data: {
      shopId: shop.id,
      categoryId: data.categoryId,
      brandId: data.brandId,
      title: data.title,
      slug,
      subtitle: data.subtitle,
      description: data.description,
      richDescription: data.richDescription ?? undefined,
      tags: data.tags ?? [],
      condition: data.condition,
      status: effectiveStatus,
      sku: data.sku,
      originalPrice: new Prisma.Decimal(data.originalPrice),
      salePrice: salePrice != null ? new Prisma.Decimal(salePrice) : null,
      discountPercent: new Prisma.Decimal(discountPercent(data.originalPrice, salePrice ?? undefined)),
      stockQuantity: data.stockQuantity ?? 0,
      lowStockThreshold: data.lowStockThreshold,
      weightGrams: data.weightGrams,
      lengthCm: data.lengthCm != null ? new Prisma.Decimal(data.lengthCm) : null,
      widthCm: data.widthCm != null ? new Prisma.Decimal(data.widthCm) : null,
      heightCm: data.heightCm != null ? new Prisma.Decimal(data.heightCm) : null,
      shippingClass: data.shippingClass,
      videoUrl: data.videoUrl,
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
      dealStartsAt: data.dealStartsAt,
      dealEndsAt: data.dealEndsAt,
      attributes: data.attributes ?? undefined,
      variants: data.variants?.length
        ? {
            create: data.variants.map((v: any) => ({
              name: v.name,
              sku: v.sku,
              optionLabel: v.optionLabel,
              price: new Prisma.Decimal(v.price),
              compareAtPrice: v.compareAtPrice != null ? new Prisma.Decimal(v.compareAtPrice) : null,
              stockQuantity: v.stockQuantity ?? 0,
              attributeValues: v.attributes
                ? { create: v.attributes.map((a: any) => ({ attributeId: a.attributeId, attributeValue: a.value })) }
                : undefined,
            })),
          }
        : undefined,
    },
    include: { variants: true, images: true },
  });
}

export async function getProduct(idOrSlug: string, viewerId?: string) {
  const product = await prisma.product.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      images: { orderBy: { position: 'asc' } },
      variants: { include: { attributeValues: true } },
      shop: { select: { id: true, name: true, slug: true, logoUrl: true, defaultDeliveryDays: true, seller: { select: { id: true, isVerified: true, tier: true, rating: true } } } },
      category: { select: { id: true, name: true, slug: true } },
      brand: { select: { id: true, name: true, slug: true } },
      qa: { where: { isVisible: true }, include: { askedBy: { select: { name: true } }, answeredBy: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!product) throw ApiError.notFound('Product not found');

  // Track a view for recently-viewed + analytics (best effort).
  prisma.productView.create({ data: { productId: product.id, userId: viewerId } }).catch(() => {});
  prisma.product.update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
  return product;
}

/** Public catalog listing with faceted filters and sorting. */
export async function listProducts(query: any, opts: { adminView?: boolean; sellerShopIds?: string[] } = {}) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 24);
  const where: Prisma.ProductWhereInput = {};

  if (opts.adminView) {
    if (query.status) where.status = query.status;
    if (opts.sellerShopIds) where.shopId = { in: opts.sellerShopIds };
  } else {
    where.status = ProductStatus.ACTIVE;
  }

  if (query.categoryId) {
    // include descendants
    const descendants = await prisma.category.findMany({ where: { path: { contains: (query.categoryId as string) } }, select: { id: true } });
    where.categoryId = { in: [query.categoryId as string, ...descendants.map((d) => d.id)] };
  }
  if (query.brandId) where.brandId = query.brandId;
  if (query.shopId) where.shopId = query.shopId;
  if (query.condition) where.condition = query.condition;
  if (query.minRating) where.ratingAverage = { gte: Number(query.minRating) };
  if (query.minPrice || query.maxPrice) {
    where.OR = [
      { salePrice: { gte: query.minPrice != null ? Number(query.minPrice) : undefined, lte: query.maxPrice != null ? Number(query.maxPrice) : undefined } },
      { salePrice: null, originalPrice: { gte: query.minPrice != null ? Number(query.minPrice) : undefined, lte: query.maxPrice != null ? Number(query.maxPrice) : undefined } },
    ];
  }
  if (query.q) {
    const term = String(query.q).trim();
    where.OR = [
      ...(where.OR ? (where.OR as Prisma.ProductWhereInput[]) : []),
      { title: { contains: term, mode: 'insensitive' } },
      { tags: { has: term.toLowerCase() } },
      { subtitle: { contains: term, mode: 'insensitive' } },
    ];
  }

  const sort = mapSort(query.sort);
  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      include: { images: { where: { isPrimary: true }, take: 1 }, shop: { select: { name: true, slug: true } }, brand: { select: { name: true } } },
      orderBy: sort,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);
  return paginated(items.map(shapeCard), total, page, limit);
}

function mapSort(sort?: string): Prisma.ProductOrderByWithRelationInput[] {
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
      return [{ ratingAverage: 'desc' }];
    default:
      return [{ isFeatured: 'desc' }, { soldCount: 'desc' }, { createdAt: 'desc' }];
  }
}

function shapeCard(p: any) {
  const price = p.salePrice != null ? Number(p.salePrice) : Number(p.originalPrice);
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    image: p.images?.[0]?.url ?? null,
    price,
    originalPrice: Number(p.originalPrice),
    discountPercent: Number(p.discountPercent),
    ratingAverage: Number(p.ratingAverage),
    ratingCount: p.ratingCount,
    soldCount: p.soldCount,
    stockQuantity: p.stockQuantity,
    shop: p.shop,
    brand: p.brand?.name ?? null,
    condition: p.condition,
    isFeatured: p.isFeatured,
    dealEndsAt: p.dealEndsAt,
  };
}

export async function updateProduct(userId: string, id: string, data: any) {
  const existing = await prisma.product.findUnique({ where: { id }, include: { shop: true } });
  if (!existing) throw ApiError.notFound('Product not found');
  await ensureShopOwnership(existing.shopId, userId);

  const patch: any = { ...data };
  if (data.originalPrice != null || data.salePrice != null) {
    const original = data.originalPrice ?? Number(existing.originalPrice);
    const sale = data.salePrice != null ? data.salePrice : existing.salePrice != null ? Number(existing.salePrice) : undefined;
    patch.discountPercent = new Prisma.Decimal(discountPercent(original, sale ?? undefined));
    if (data.originalPrice != null) patch.originalPrice = new Prisma.Decimal(data.originalPrice);
    if (data.salePrice != null) patch.salePrice = data.salePrice == null ? null : new Prisma.Decimal(data.salePrice);
  }
  delete patch.variants; // variants managed separately
  return prisma.product.update({ where: { id }, data: patch });
}

export async function archiveProduct(userId: string, id: string) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Product not found');
  await ensureShopOwnership(existing.shopId, userId);
  return prisma.product.update({ where: { id }, data: { status: ProductStatus.ARCHIVED } });
}

export async function duplicateProduct(userId: string, id: string) {
  const src = await prisma.product.findUnique({ where: { id }, include: { variants: true, images: true } });
  if (!src) throw ApiError.notFound('Product not found');
  await ensureShopOwnership(src.shopId, userId);
  const slug = await uniqueSlug(`${src.slug}-copy`, async (s) => !!(await prisma.product.findUnique({ where: { slug: s } })));
  return prisma.product.create({
    data: {
      shopId: src.shopId,
      categoryId: src.categoryId,
      brandId: src.brandId,
      title: `${src.title} (copy)`,
      slug,
      description: src.description,
      condition: src.condition,
      status: ProductStatus.DRAFT,
      sku: `${src_sku(src.sku)}`,
      originalPrice: src.originalPrice,
      salePrice: src.salePrice,
      discountPercent: src.discountPercent,
      stockQuantity: 0,
      shippingClass: src.shippingClass,
      attributes: src.attributes ?? undefined,
    },
  });
}
function src_sku(sku: string) {
  return `${sku}-COPY-${Date.now().toString().slice(-5)}`;
}

export async function sellerProducts(userId: string, req: { query: any }) {
  const shops = await prisma.shop.findMany({ where: { seller: { userId } }, select: { id: true } });
  const shopIds = shops.map((s) => s.id);
  return listProducts({ ...req.query, status: req.query.status ?? undefined }, { adminView: true, sellerShopIds: shopIds });
}

/** Moderation workflow (Admin). */
export async function moderateProduct(staffId: string, id: string, action: 'approve' | 'reject', reason?: string) {
  const product = await prisma.product.findUnique({ where: { id, }, include: { shop: { include: { seller: { include: { user: true } } } } } });
  if (!product) throw ApiError.notFound('Product not found');
  const status = action === 'approve' ? ProductStatus.ACTIVE : ProductStatus.REJECTED;
  await prisma.product.update({
    where: { id },
    data: { status, moderationNote: reason ?? null, reviewedById: staffId, reviewedAt: new Date() },
  });
  await prisma.auditLog.create({ data: { actorId: staffId, action: `product:${action}`, entityType: 'PRODUCT', entityId: id } });
  if (action === 'reject') {
    const sellerUser = product.shop.seller?.user;
    if (sellerUser) {
      const { templates } = await import('../../lib/email/templates');
      await notifySellerProductRejected(sellerUser.id, sellerUser.name, product.title, reason ?? 'Policy violation');
      void templates;
    }
  }
  return prisma.product.findUnique({ where: { id } });
}

async function notifySellerProductRejected(userId: string, name: string, title: string, reason: string) {
  const { templates } = await import('../../lib/email/templates');
  const { notify } = await import('../notifications/notification.service');
  await notify({ userId, audience: 'SELLER', type: 'PRODUCT_REJECTED', title: 'Product rejected', body: `"${title}" was rejected`, emailHtml: templates.productRejected(name, title, reason), actionUrl: '/seller/products' });
}

/** Pending review queue for admins. */
export async function pendingReviewQueue(query: any) {
  return listProducts({ ...query, status: ProductStatus.PENDING_REVIEW }, { adminView: true });
}

async function ensureShopOwnership(shopId: string, userId: string) {
  const shop = await prisma.shop.findFirst({ where: { id: shopId, seller: { userId } } });
  if (!shop) throw ApiError.forbidden('You do not manage this shop');
  return shop;
}

// re-export for inventory usage
export { notifyLowStock };
