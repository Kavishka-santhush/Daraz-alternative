import { SellerStatus, DocumentStatus, UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';
import { slugify, uniqueSlug } from '../../utils/nano';
import { paginated } from '../../utils/pagination';
import { notify } from '../notifications/notification.service';
import { templates } from '../../lib/email/templates';
import { toPublicUrl } from '../../lib/upload';
import type { Request } from 'express';

export async function getMySellerDashboard(userId: string) {
  const seller = await prisma.sellerProfile.findUnique({
    where: { userId },
    include: { shops: true, documents: true },
  });
  if (!seller) throw ApiError.notFound('Seller profile not found');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [todayOrders, pendingOrders, productsCount, earnings] = await prisma.$transaction([
    prisma.sellerSubOrder.count({ where: { sellerId: seller.id, createdAt: { gte: today } } }),
    prisma.sellerSubOrder.count({ where: { sellerId: seller.id, status: 'PLACED' } }),
    prisma.product.count({ where: { shop: { sellerId: seller.id }, status: 'ACTIVE' } }),
    prisma.sellerEarnings.aggregate({ where: { sellerId: seller.id }, _sum: { available: true, pending: true, netEarnings: true } }),
  ]);
  return { seller, stats: { todayOrders, pendingOrders, productsCount, availableBalance: earnings._sum.available ?? 0, pending: earnings._sum.pending ?? 0, lifetimeNet: earnings._sum.netEarnings ?? 0 } };
}

export async function listShops(userId: string) {
  const seller = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (!seller) throw ApiError.notFound('Seller profile not found');
  return prisma.shop.findMany({ where: { sellerId: seller.id }, include: { _count: { select: { products: true } } } });
}

export async function createShop(userId: string, data: { name: string; description?: string }) {
  const seller = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (!seller) throw ApiError.notFound('Seller profile not found');
  if (seller.status !== 'APPROVED') throw ApiError.forbidden('Your seller account must be approved before adding shops');
  const slug = await uniqueSlug(slugify(data.name), async (s) => !!(await prisma.shop.findUnique({ where: { slug: s } })));
  return prisma.shop.create({ data: { sellerId: seller.id, name: data.name, slug, description: data.description } });
}

export async function updateShop(userId: string, shopId: string, data: Record<string, unknown>) {
  await ensureShopOwner(userId, shopId);
  const allowed = ['name', 'description', 'policyReturn', 'policyShipping', 'policyWarranty', 'operatingHours', 'shippingOrigin', 'defaultDeliveryDays', 'isActive'];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (k in data) patch[k] = data[k];
  return prisma.shop.update({ where: { id: shopId }, data: patch });
}

export async function uploadShopBrand(userId: string, shopId: string, file: Express.Multer.File, kind: 'logo' | 'cover') {
  await ensureShopOwner(userId, shopId);
  const url = toPublicUrl(file.path);
  return prisma.shop.update({ where: { id: shopId }, data: kind === 'logo' ? { logoUrl: url } : { coverUrl: url } });
}

export async function getPublicShop(slug: string) {
  const shop = await prisma.shop.findFirst({
    where: { slug },
    include: { seller: { select: { tier: true, isVerified: true, rating: true, approvedAt: true } } },
  });
  if (!shop || !shop.isActive) throw ApiError.notFound('Shop not found');
  return shop;
}

export async function getShopProducts(slug: string, req: Request) {
  const shop = await prisma.shop.findFirst({ where: { slug, isActive: true } });
  if (!shop) throw ApiError.notFound('Shop not found');
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 24);
  const where = { shopId: shop.id, status: 'ACTIVE' as const };
  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({ where, include: { images: { where: { isPrimary: true }, take: 1 } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.product.count({ where }),
  ]);
  return paginated(items, total, page, limit);
}

/** Public shops directory: active shops of approved sellers, paginated. */
export async function listPublicShops(req: Request) {
  const page = Number(req.query.page ?? 1);
  const limit = Math.min(Number(req.query.limit ?? 24), 60);
  const where = {
    isActive: true,
    seller: { status: SellerStatus.APPROVED },
    ...(req.query.q
      ? { name: { contains: String(req.query.q), mode: 'insensitive' as const } }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.shop.findMany({
      where,
      select: {
        id: true, name: true, slug: true, description: true, logoUrl: true, coverUrl: true,
        defaultDeliveryDays: true, createdAt: true,
        seller: { select: { tier: true, isVerified: true, rating: true, totalOrders: true } },
        _count: { select: { products: true, followers: true } },
      },
      orderBy: [{ seller: { isVerified: 'desc' } }, { seller: { rating: 'desc' } }, { seller: { totalOrders: 'desc' } }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.shop.count({ where }),
  ]);
  return paginated(items, total, page, limit);
}

export async function followShop(userId: string, shopId: string, follow: boolean) {
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) throw ApiError.notFound('Shop not found');
  if (follow) await prisma.shop.update({ where: { id: shopId }, data: { followers: { connect: { id: userId } } } });
  else await prisma.shop.update({ where: { id: shopId }, data: { followers: { disconnect: { id: userId } } } });
  return { following: follow };
}

/** Seller uploads a business document for the approval workflow. */
export async function uploadDocument(userId: string, data: { type: string; number?: string; expiryDate?: string }, file: Express.Multer.File) {
  const seller = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (!seller) throw ApiError.notFound('Seller profile not found');
  return prisma.businessDocument.create({
    data: {
      sellerId: seller.id,
      type: data.type as any,
      fileName: file.originalname,
      url: toPublicUrl(file.path),
      number: data.number,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      status: DocumentStatus.PENDING,
    },
  });
}

// ── Admin: approval workflow ──
export async function listSellerApplications(req: Request) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const status = (req.query.status as SellerStatus) ?? undefined;
  const where = status ? { status } : {};
  const [items, total] = await prisma.$transaction([
    prisma.sellerProfile.findMany({ where, include: { user: { select: { name: true, email: true, phone: true, createdAt: true } }, documents: true, shops: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.sellerProfile.count({ where }),
  ]);
  return paginated(items, total, page, limit);
}

export async function reviewSeller(staffId: string, sellerId: string, decision: 'approve' | 'reject', reason?: string) {
  const seller = await prisma.sellerProfile.findUnique({ where: { id: sellerId }, include: { user: true } });
  if (!seller) throw ApiError.notFound('Seller not found');
  const status = decision === 'approve' ? SellerStatus.APPROVED : SellerStatus.REJECTED;
  await prisma.sellerProfile.update({
    where: { id: sellerId },
    data: { status, approvedAt: decision === 'approve' ? new Date() : null, approvedById: staffId, rejectionReason: decision === 'reject' ? reason : null },
  });
  if (decision === 'approve') await prisma.user.update({ where: { id: seller.userId }, data: { status: 'ACTIVE' } });
  await prisma.auditLog.create({ data: { actorId: staffId, action: `seller:${decision}`, entityType: 'SELLER', entityId: sellerId } });

  const html = decision === 'approve' ? templates.sellerApproved(seller.user.name) : templates.sellerRejected(seller.user.name, reason ?? 'Documents incomplete');
  await notify({ userId: seller.userId, audience: 'SELLER', type: decision === 'approve' ? 'SELLER_APPROVED' : 'SELLER_REJECTED', title: decision === 'approve' ? 'You are approved!' : 'Seller application update', body: reason, emailHtml: html, actionUrl: '/seller' });
  return { ok: true, status };
}

export async function setSellerVerified(staffId: string, sellerId: string, verified: boolean) {
  await prisma.sellerProfile.update({ where: { id: sellerId }, data: { isVerified: verified } });
  await prisma.auditLog.create({ data: { actorId: staffId, action: verified ? 'seller:verify' : 'seller:unverify', entityType: 'SELLER', entityId: sellerId } });
  return { ok: true };
}

export async function setSellerTier(staffId: string, sellerId: string, tier: string) {
  await prisma.sellerProfile.update({ where: { id: sellerId }, data: { tier: tier as any } });
  await prisma.auditLog.create({ data: { actorId: staffId, action: 'seller:set-tier', entityType: 'SELLER', entityId: sellerId, after: { tier } } });
  return { ok: true };
}

export async function suspendSeller(staffId: string, sellerId: string, suspend: boolean, reason?: string) {
  const seller = await prisma.sellerProfile.findUnique({ where: { id: sellerId } });
  if (!seller) throw ApiError.notFound('Seller not found');
  await prisma.sellerProfile.update({
    where: { id: sellerId },
    data: { status: suspend ? SellerStatus.SUSPENDED : SellerStatus.APPROVED, suspensionReason: suspend ? reason : null, suspendedAt: suspend ? new Date() : null },
  });
  await prisma.user.update({ where: { id: seller.userId }, data: { status: suspend ? 'SUSPENDED' : 'ACTIVE' } });
  await prisma.auditLog.create({ data: { actorId: staffId, action: suspend ? 'seller:suspend' : 'seller:reactivate', entityType: 'SELLER', entityId: sellerId } });
  return { ok: true };
}

/** Recomputes performance metrics used by the tier engine + dashboard. */
export async function sellerMetrics(userId: string) {
  const seller = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (!seller) throw ApiError.notFound('Seller profile not found');
  const [orders, completed, cancelled, disputes, reviews] = await prisma.$transaction([
    prisma.sellerSubOrder.count({ where: { sellerId: seller.id } }),
    prisma.sellerSubOrder.count({ where: { sellerId: seller.id, status: 'DELIVERED' } }),
    prisma.sellerSubOrder.count({ where: { sellerId: seller.id, status: 'CANCELLED' } }),
    prisma.dispute.count({ where: { returnRequest: { subOrder: { sellerId: seller.id } } } }),
    prisma.review.aggregate({ where: { sellerId: seller.id }, _avg: { rating: true }, _count: true }),
  ]);
  const completionRate = orders ? (completed / orders) * 100 : 0;
  return {
    totalOrders: orders,
    completed,
    cancelled,
    disputes,
    avgRating: reviews._avg.rating ?? 0,
    reviewCount: reviews._count,
    completionRate: Number(completionRate.toFixed(2)),
    rating: Number(seller.rating),
    tier: seller.tier,
    isVerified: seller.isVerified,
  };
}

async function ensureShopOwner(userId: string, shopId: string) {
  const shop = await prisma.shop.findFirst({ where: { id: shopId, seller: { userId } } });
  if (!shop) throw ApiError.forbidden('Shop not found or not owned by you');
  return shop;
}
