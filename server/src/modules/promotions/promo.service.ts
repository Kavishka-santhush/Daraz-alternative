import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';
import { paginated } from '../../utils/pagination';
import { slugify, uniqueSlug } from '../../utils/nano';
import type { Request } from 'express';

const SALE_CARD = {
  id: true, slug: true, title: true, subtitle: true, salePrice: true, originalPrice: true,
  discountPercent: true, ratingAverage: true, ratingCount: true, stockQuantity: true,
  images: { where: { isPrimary: true }, take: 1, select: { url: true } },
  shop: { select: { name: true, slug: true } },
} satisfies Prisma.ProductSelect;

function shapeProduct(p: any) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    image: p.images?.[0]?.url ?? null,
    originalPrice: Number(p.originalPrice),
    ratingAverage: Number(p.ratingAverage),
    ratingCount: p.ratingCount,
    shop: p.shop,
  };
}

// ══════════════════════════ FLASH SALES ══════════════════════════

export interface FlashSaleInput {
  title: string;
  description?: string;
  bannerUrl?: string;
  startsAt: string;
  endsAt: string;
}

export async function createFlashSale(staffId: string, input: FlashSaleInput) {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw ApiError.badRequest('Invalid start or end date');
  if (endsAt <= startsAt) throw ApiError.badRequest('Sale must end after it starts');
  const slug = await uniqueSlug(slugify(input.title), async (s) => !!(await prisma.flashSale.findUnique({ where: { slug: s } })));
  const now = new Date();
  const sale = await prisma.flashSale.create({
    data: {
      title: input.title,
      slug,
      description: input.description,
      bannerUrl: input.bannerUrl,
      startsAt,
      endsAt,
      isActive: true,
      status: startsAt > now ? 'SCHEDULED' : 'LIVE',
      createdById: staffId,
    },
  });
  await prisma.auditLog.create({ data: { actorId: staffId, action: 'flash-sale:create', entityType: 'FLASH_SALE', entityId: sale.id } });
  return sale;
}

export async function updateFlashSale(staffId: string, id: string, input: Partial<FlashSaleInput> & { isActive?: boolean }) {
  const sale = await prisma.flashSale.findUnique({ where: { id } });
  if (!sale) throw ApiError.notFound('Flash sale not found');
  const updated = await prisma.flashSale.update({
    where: { id },
    data: {
      ...(input.title ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.bannerUrl !== undefined ? { bannerUrl: input.bannerUrl } : {}),
      ...(input.startsAt ? { startsAt: new Date(input.startsAt) } : {}),
      ...(input.endsAt ? { endsAt: new Date(input.endsAt) } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
  await prisma.auditLog.create({ data: { actorId: staffId, action: 'flash-sale:update', entityType: 'FLASH_SALE', entityId: id } });
  return updated;
}

/** Adds (or re-prices) products inside a sale. Each product may appear once. */
export async function addFlashSaleItems(staffId: string, saleId: string, items: { productId: string; salePrice: number; stockLimit: number; sortOrder?: number }[]) {
  const sale = await prisma.flashSale.findUnique({ where: { id: saleId } });
  if (!sale) throw ApiError.notFound('Flash sale not found');
  for (const item of items) {
    if (item.salePrice <= 0) throw ApiError.badRequest('Sale price must be positive');
    const product = await prisma.product.findUnique({ where: { id: item.productId }, select: { id: true, originalPrice: true, salePrice: true, status: true } });
    if (!product) throw ApiError.notFound(`Unknown product ${item.productId}`);
    const base = Number(product.salePrice ?? product.originalPrice);
    if (item.salePrice >= base) throw ApiError.badRequest(`Sale price for ${product.id} must be below the current price (${base})`);
    if (item.stockLimit < 1) throw ApiError.badRequest('Stock limit must be at least 1');
    await prisma.flashSaleItem.upsert({
      where: { flashSaleId_productId: { flashSaleId: saleId, productId: item.productId } },
      create: { flashSaleId: saleId, productId: item.productId, salePrice: new Prisma.Decimal(item.salePrice), stockLimit: item.stockLimit, sortOrder: item.sortOrder ?? 0 },
      update: { salePrice: new Prisma.Decimal(item.salePrice), stockLimit: item.stockLimit, sortOrder: item.sortOrder ?? 0 },
    });
  }
  return listFlashSaleItems(saleId);
}

export async function removeFlashSaleItem(staffId: string, itemId: string) {
  const item = await prisma.flashSaleItem.findUnique({ where: { id: itemId }, include: { flashSale: { select: { createdById: true } } } });
  if (!item) throw ApiError.notFound('Flash sale item not found');
  await prisma.flashSaleItem.delete({ where: { id: itemId } });
  await prisma.auditLog.create({ data: { actorId: staffId, action: 'flash-sale:remove-item', entityType: 'FLASH_SALE', entityId: item.flashSaleId } });
  return { ok: true };
}

export async function listFlashSales(req?: Request, opts: { staff?: boolean } = {}) {
  const now = new Date();
  const where: Prisma.FlashSaleWhereInput = opts.staff
    ? {}
    : { isActive: true, startsAt: { lte: new Date(now.getTime() + 3 * 86400000) }, endsAt: { gt: now } };
  const sales = await prisma.flashSale.findMany({
    where,
    include: { items: { include: { product: { select: SALE_CARD } }, orderBy: { sortOrder: 'asc' }, take: opts.staff ? 200 : 20 } },
    orderBy: [{ startsAt: 'desc' }],
    take: opts.staff ? 50 : 10,
  });
  return sales.map((s) => {
    const live = s.isActive && s.startsAt <= now && s.endsAt > now;
    return {
      id: s.id,
      slug: s.slug,
      title: s.title,
      description: s.description,
      bannerUrl: s.bannerUrl,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      status: live ? 'LIVE' : s.startsAt > now ? 'UPCOMING' : 'ENDED',
      itemCount: s.items.length,
      items: s.items.map((i) => ({
        itemId: i.id,
        ...shapeProduct(i.product),
        flashPrice: Number(i.salePrice),
        discountPercent: Number((((Number(i.product.originalPrice) - Number(i.salePrice)) / Number(i.product.originalPrice)) * 100).toFixed(1)),
        stockLimit: i.stockLimit,
        soldCount: i.soldCount,
        remaining: Math.max(0, i.stockLimit - i.soldCount),
      })),
    };
  });
}

export async function listFlashSaleItems(saleId: string, _limit?: number) {
  const items = await prisma.flashSaleItem.findMany({ where: { flashSaleId: saleId }, include: { product: { select: SALE_CARD } }, orderBy: { sortOrder: 'asc' } });
  return items.map((i) => ({ itemId: i.id, ...shapeProduct(i.product), flashPrice: Number(i.salePrice), stockLimit: i.stockLimit, soldCount: i.soldCount, remaining: Math.max(0, i.stockLimit - i.soldCount), sortOrder: i.sortOrder }));
}

export async function getFlashSaleBySlug(slug: string) {
  const now = new Date();
  const sale = await prisma.flashSale.findUnique({ where: { slug }, include: { items: { include: { product: { select: SALE_CARD } }, orderBy: { sortOrder: 'asc' } } } });
  if (!sale) throw ApiError.notFound('Flash sale not found');
  return {
    id: sale.id,
    slug: sale.slug,
    title: sale.title,
    description: sale.description,
    bannerUrl: sale.bannerUrl,
    startsAt: sale.startsAt,
    endsAt: sale.endsAt,
    isActive: sale.isActive,
    status: sale.isActive && sale.startsAt <= now && sale.endsAt > now ? 'LIVE' : sale.startsAt > now ? 'UPCOMING' : 'ENDED',
    items: sale.items.map((i) => ({ itemId: i.id, ...shapeProduct(i.product), flashPrice: Number(i.salePrice), stockLimit: i.stockLimit, soldCount: i.soldCount, remaining: Math.max(0, i.stockLimit - i.soldCount) })),
  };
}

/** Job: flip sales whose window has passed to ENDED. */
export async function expireFlashSales() {
  const now = new Date();
  const stale = await prisma.flashSale.findMany({ where: { isActive: true, endsAt: { lt: now } }, select: { id: true } });
  for (const s of stale) await prisma.flashSale.update({ where: { id: s.id }, data: { isActive: false, status: 'ENDED' } });
  const upcoming = await prisma.flashSale.findMany({ where: { isActive: true, status: 'SCHEDULED', startsAt: { lte: now } }, select: { id: true } });
  for (const s of upcoming) await prisma.flashSale.update({ where: { id: s.id }, data: { status: 'LIVE' } });
  return { ended: stale.length, activated: upcoming.length };
}

// ══════════════════════════ BUNDLE DEALS ══════════════════════════

export interface BundleInput {
  title: string;
  description?: string;
  dealType: 'MULTI_BUY' | 'FIXED_PRICE' | 'PERCENT_OFF';
  buyQuantity?: number;
  getConfigQty?: number;
  discountPercent?: number;
  fixedPrice?: number;
  productIds: string[];
  startsAt?: string;
  endsAt?: string;
}

export async function createBundle(sellerUserId: string, input: BundleInput) {
  const shop = await prisma.shop.findFirst({ where: { seller: { userId: sellerUserId } }, select: { id: true } });
  if (!shop) throw ApiError.forbidden('Approved shop required');
  if (input.productIds.length < 2) throw ApiError.badRequest('A bundle needs at least two products');
  const owned = await prisma.product.count({ where: { id: { in: input.productIds }, shopId: shop.id, status: 'ACTIVE' } });
  if (owned !== input.productIds.length) throw ApiError.badRequest('Bundle products must all be active products from your shop');
  if (input.dealType === 'PERCENT_OFF' && !input.discountPercent) throw ApiError.badRequest('discountPercent required');
  if (input.dealType === 'FIXED_PRICE' && !input.fixedPrice) throw ApiError.badRequest('fixedPrice required');

  return prisma.bundleDeal.create({
    data: {
      shopId: shop.id,
      title: input.title,
      description: input.description,
      dealType: input.dealType,
      buyQuantity: input.buyQuantity ?? 2,
      getConfigQty: input.getConfigQty ?? 1,
      discountPercent: input.discountPercent != null ? new Prisma.Decimal(input.discountPercent) : null,
      fixedPrice: input.fixedPrice != null ? new Prisma.Decimal(input.fixedPrice) : null,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      items: { create: input.productIds.map((productId) => ({ productId, quantity: 1 })) },
    },
    include: { items: { include: { product: { select: SALE_CARD } } } },
  });
}

export async function listBundles(opts: { shopId?: string; includeInactive?: boolean } = {}) {
  const now = new Date();
  const bundles = await prisma.bundleDeal.findMany({
    where: {
      ...(opts.shopId ? { shopId: opts.shopId } : { isActive: true }),
      ...(!opts.includeInactive && !opts.shopId ? { OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ endsAt: null }, { endsAt: { gt: now } }] } : {}),
    },
    include: { items: { include: { product: { select: { ...SALE_CARD, salePrice: true } } } }, shop: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });
  return bundles.map((b) => {
    const regular = b.items.reduce((sum, i) => sum + Number(i.product.salePrice ?? i.product.originalPrice) * i.quantity, 0);
    const bundlePrice = b.dealType === 'FIXED_PRICE' && b.fixedPrice != null
      ? Number(b.fixedPrice)
      : Number((regular * (1 - Number(b.discountPercent ?? 0) / 100)).toFixed(2));
    return {
      id: b.id,
      title: b.title,
      description: b.description,
      dealType: b.dealType,
      buyQuantity: b.buyQuantity,
      getConfigQty: b.getConfigQty,
      discountPercent: b.discountPercent != null ? Number(b.discountPercent) : null,
      regularPrice: Number(regular.toFixed(2)),
      bundlePrice,
      savings: Number((regular - bundlePrice).toFixed(2)),
      shop: b.shop,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      items: b.items.map((i) => shapeProduct(i.product)),
    };
  });
}

export async function setBundleActive(actorId: string, bundleId: string, isActive: boolean) {
  const bundle = await prisma.bundleDeal.findUnique({ where: { id: bundleId }, include: { shop: { select: { seller: { select: { userId: true } } } } } });
  if (!bundle) throw ApiError.notFound('Bundle not found');
  await prisma.bundleDeal.update({ where: { id: bundleId }, data: { isActive } });
  await prisma.auditLog.create({ data: { actorId, action: isActive ? 'bundle:activate' : 'bundle:deactivate', entityType: 'PRODUCT', entityId: bundleId } });
  return { ok: true, isActive };
}

// ══════════════════════════ BANNERS ══════════════════════════

export interface BannerInput {
  title: string;
  placement: string;
  imageUrl: string;
  mobileImageUrl?: string;
  targetUrl?: string;
  altText?: string;
  sortOrder?: number;
  startsAt?: string;
  endsAt?: string;
  isActive?: boolean;
}

export async function createBanner(staffId: string, input: BannerInput) {
  const banner = await prisma.banner.create({
    data: {
      title: input.title,
      placement: input.placement,
      imageUrl: input.imageUrl,
      mobileImageUrl: input.mobileImageUrl,
      targetUrl: input.targetUrl,
      altText: input.altText,
      sortOrder: input.sortOrder ?? 0,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      isActive: input.isActive ?? true,
      createdById: staffId,
    },
  });
  await prisma.auditLog.create({ data: { actorId: staffId, action: 'banner:create', entityType: 'BANNER', entityId: banner.id } });
  return banner;
}

export async function listBanners(req: Request, opts: { staff?: boolean } = {}) {
  const now = new Date();
  const where: Prisma.BannerWhereInput = opts.staff
    ? req.query.placement ? { placement: String(req.query.placement) } : {}
    : {
        isActive: true,
        ...(req.query.placement ? { placement: String(req.query.placement) } : {}),
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ endsAt: null }, { endsAt: { gt: now } }],
      };
  const banners = await prisma.banner.findMany({ where, orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }], take: opts.staff ? 100 : 30 });
  if (opts.staff) {
    const total = await prisma.banner.count({ where });
    return paginated(banners, total, 1, 100);
  }
  return banners;
}

export async function updateBanner(staffId: string, id: string, input: Partial<BannerInput>) {
  if (input.imageUrl && !input.imageUrl.startsWith('/uploads/') && !/^https?:\/\//.test(input.imageUrl)) throw ApiError.badRequest('Invalid image URL');
  const banner = await prisma.banner.update({
    where: { id },
    data: {
      ...(input.title ? { title: input.title } : {}),
      ...(input.placement ? { placement: input.placement } : {}),
      ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
      ...(input.mobileImageUrl !== undefined ? { mobileImageUrl: input.mobileImageUrl } : {}),
      ...(input.targetUrl !== undefined ? { targetUrl: input.targetUrl } : {}),
      ...(input.altText !== undefined ? { altText: input.altText } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt ? new Date(input.startsAt) : null } : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt ? new Date(input.endsAt) : null } : {}),
    },
  });
  await prisma.auditLog.create({ data: { actorId: staffId, action: 'banner:update', entityType: 'BANNER', entityId: id } });
  return banner;
}

export async function deleteBanner(staffId: string, id: string) {
  await prisma.banner.delete({ where: { id } });
  await prisma.auditLog.create({ data: { actorId: staffId, action: 'banner:delete', entityType: 'BANNER', entityId: id } });
  return { ok: true };
}

// ══════════════════════════ ANNOUNCEMENTS ══════════════════════════

export async function activeAnnouncements() {
  const now = new Date();
  return prisma.platformAnnouncement.findMany({
    where: { isActive: true, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ endsAt: null }, { endsAt: { gt: now } }] },
    orderBy: [{ placement: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function upsertAnnouncement(staffId: string, input: { id?: string; title: string; body: string; placement?: string; bgColor?: string; textColor?: string; ctaLabel?: string; ctaUrl?: string; isActive?: boolean; startsAt?: string; endsAt?: string }) {
  const data = {
    title: input.title,
    body: input.body,
    placement: (input.placement ?? 'SITE_WIDE_BANNER') as never,
    bgColor: input.bgColor,
    textColor: input.textColor,
    ctaLabel: input.ctaLabel,
    ctaUrl: input.ctaUrl,
    isActive: input.isActive ?? true,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
  };
  const row = input.id
    ? await prisma.platformAnnouncement.update({ where: { id: input.id }, data })
    : await prisma.platformAnnouncement.create({ data });
  await prisma.auditLog.create({ data: { actorId: staffId, action: input.id ? 'announcement:update' : 'announcement:create', entityType: 'SETTINGS', entityId: row.id } });
  return row;
}

export async function deleteAnnouncement(staffId: string, id: string) {
  await prisma.platformAnnouncement.delete({ where: { id } });
  await prisma.auditLog.create({ data: { actorId: staffId, action: 'announcement:delete', entityType: 'SETTINGS', entityId: id } });
  return { ok: true };
}
