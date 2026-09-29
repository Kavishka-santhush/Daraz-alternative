import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';
import { paginated } from '../../utils/pagination';
import { notify, notifyRoleHolders } from '../notifications/notification.service';

const d = (n: number) => new Prisma.Decimal(n);

async function sellerProfileOrThrow(sellerUserId: string) {
  const profile = await prisma.sellerProfile.findUnique({ where: { userId: sellerUserId }, select: { id: true, status: true } });
  if (!profile) throw ApiError.forbidden('Approved seller account required');
  return profile;
}

export interface SponsoredInput {
  productId: string;
  placement: string;
  bidAmount: number;
  billingCycle?: string;
  startDate: string;
  endDate: string;
}

export async function createCampaign(sellerUserId: string, input: SponsoredInput) {
  const profile = await sellerProfileOrThrow(sellerUserId);
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) throw ApiError.badRequest('Invalid start or end date');
  if (endDate <= startDate) throw ApiError.badRequest('Campaign must end after it starts');
  if (input.bidAmount <= 0) throw ApiError.badRequest('Bid must be positive');
  const product = await prisma.product.findFirst({
    where: { id: input.productId, shop: { seller: { userId: sellerUserId } }, status: 'ACTIVE' },
    select: { id: true, title: true },
  });
  if (!product) throw ApiError.badRequest('Product not found, inactive, or not owned by you');

  const campaign = await prisma.sponsoredListing.create({
    data: {
      sellerId: profile.id,
      productId: product.id,
      placement: input.placement,
      bidAmount: d(input.bidAmount),
      billingCycle: input.billingCycle ?? 'WEEKLY',
      startDate,
      endDate,
      paymentStatus: 'UNPAID',
      isActive: true,
    },
    include: { product: { select: { id: true, title: true, slug: true } } },
  });
  await notifyRoleHolders(['ADMIN', 'SUPER_ADMIN'], {
    type: 'SPONSORED_NEW',
    title: 'New sponsored campaign',
    body: `Campaign for "${product.title}" awaiting payment/approval.`,
    audience: 'ADMIN',
    actionUrl: '/admin/sponsored',
  }).catch(() => {});
  return campaign;
}

export async function listSellerCampaigns(sellerUserId: string) {
  const profile = await prisma.sellerProfile.findUnique({ where: { userId: sellerUserId }, select: { id: true } });
  if (!profile) return [];
  const now = new Date();
  const rows = await prisma.sponsoredListing.findMany({
    where: { sellerId: profile.id },
    include: { product: { select: { id: true, title: true, slug: true, images: { where: { isPrimary: true }, take: 1, select: { url: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => ({
    id: r.id,
    product: { id: r.product.id, title: r.product.title, slug: r.product.slug, image: r.product.images?.[0]?.url ?? null },
    placement: r.placement,
    bidAmount: Number(r.bidAmount),
    billingCycle: r.billingCycle,
    startDate: r.startDate,
    endDate: r.endDate,
    paymentStatus: r.paymentStatus,
    isActive: r.isActive,
    approved: !!r.approvedById,
    impressions: r.impressions,
    clicks: r.clicks,
    ctr: r.impressions ? Number(((r.clicks / r.impressions) * 100).toFixed(2)) : 0,
    live: r.paymentStatus === 'PAID' && r.isActive && !!r.approvedById && r.startDate <= now && r.endDate > now,
  }));
}

/** Marks a campaign as paid (called after the seller's charge settles). */
export async function markPaid(sellerUserId: string, campaignId: string) {
  const profile = await prisma.sellerProfile.findUnique({ where: { userId: sellerUserId }, select: { id: true } });
  const campaign = await prisma.sponsoredListing.findUnique({ where: { id: campaignId } });
  if (!campaign || !profile || campaign.sellerId !== profile.id) throw ApiError.notFound('Campaign not found');
  if (campaign.paymentStatus === 'PAID') return campaign;
  return prisma.sponsoredListing.update({ where: { id: campaignId }, data: { paymentStatus: 'PAID' } });
}

export async function setCampaignActive(sellerUserId: string, campaignId: string, isActive: boolean) {
  const profile = await prisma.sellerProfile.findUnique({ where: { userId: sellerUserId }, select: { id: true } });
  const campaign = await prisma.sponsoredListing.findUnique({ where: { id: campaignId } });
  if (!campaign || !profile || campaign.sellerId !== profile.id) throw ApiError.notFound('Campaign not found');
  return prisma.sponsoredListing.update({ where: { id: campaignId }, data: { isActive } });
}

/** Public: returns approved, paid, live listings for a placement (highest bid first). */
export async function getActiveForPlacement(placement: string, limit = 8) {
  const now = new Date();
  const rows = await prisma.sponsoredListing.findMany({
    where: { placement, isActive: true, paymentStatus: 'PAID', approvedById: { not: null }, startDate: { lte: now }, endDate: { gt: now } },
    include: { product: { select: { id: true, title: true, slug: true, originalPrice: true, salePrice: true, ratingAverage: true, ratingCount: true, images: { where: { isPrimary: true }, take: 1, select: { url: true } }, shop: { select: { name: true, slug: true } } } } },
    orderBy: [{ bidAmount: 'desc' }, { clicks: 'desc' }],
    take: limit,
  });
  return rows.map((r) => ({
    listingId: r.id,
    placement: r.placement,
    product: {
      ...r.product,
      price: Number(r.product.salePrice ?? r.product.originalPrice),
      image: r.product.images?.[0]?.url ?? null,
    },
  }));
}

/** Fire-and-forget analytics. Returns the incremented counters. */
export async function trackEvent(listingId: string, kind: 'impression' | 'click') {
  const updated = kind === 'click'
    ? await prisma.sponsoredListing.update({ where: { id: listingId }, data: { clicks: { increment: 1 } }, select: { id: true, impressions: true, clicks: true } })
    : await prisma.sponsoredListing.update({ where: { id: listingId }, data: { impressions: { increment: 1 } }, select: { id: true, impressions: true, clicks: true } });
  return updated;
}

// ── Admin ──

export async function adminListCampaigns(query: { status?: string; placement?: string; page?: number; limit?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const where: Prisma.SponsoredListingWhereInput = {
    ...(query.status ? { paymentStatus: query.status as Prisma.SponsoredListingWhereInput['paymentStatus'] } : {}),
    ...(query.placement ? { placement: query.placement } : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.sponsoredListing.findMany({
      where,
      include: { product: { select: { id: true, title: true, slug: true } }, seller: { select: { id: true, shops: { where: { isActive: true }, take: 1, select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.sponsoredListing.count({ where }),
  ]);
  return paginated(
    rows.map((r) => ({
      id: r.id,
      product: r.product,
      shopName: r.seller?.shops[0]?.name ?? null,
      placement: r.placement,
      bidAmount: Number(r.bidAmount),
      billingCycle: r.billingCycle,
      startDate: r.startDate,
      endDate: r.endDate,
      paymentStatus: r.paymentStatus,
      approved: !!r.approvedById,
      isActive: r.isActive,
      impressions: r.impressions,
      clicks: r.clicks,
    })),
    total,
    page,
    limit,
  );
}

export async function adminApprove(staffId: string, campaignId: string, approve: boolean) {
  const campaign = await prisma.sponsoredListing.findUnique({ where: { id: campaignId }, include: { seller: { include: { user: { select: { id: true } } } } } });
  if (!campaign) throw ApiError.notFound('Campaign not found');
  const updated = await prisma.sponsoredListing.update({
    where: { id: campaignId },
    data: { approvedById: approve ? staffId : null, ...(approve ? {} : { isActive: false }) },
  });
  await prisma.auditLog.create({ data: { actorId: staffId, action: approve ? 'sponsored:approve' : 'sponsored:reject', entityType: 'PRODUCT', entityId: campaignId } });
  if (campaign.seller?.user?.id) {
    notify({
      userId: campaign.seller.user.id,
      audience: 'SELLER',
      type: 'SPONSORED_DECISION',
      title: approve ? 'Sponsored campaign approved' : 'Sponsored campaign rejected',
      body: approve ? 'Your campaign is now live once payment is confirmed.' : 'Your campaign was rejected and deactivated.',
      actionUrl: '/seller/sponsored',
    }).catch(() => {});
  }
  return updated;
}

export async function adminSpendReport() {
  const agg = await prisma.sponsoredListing.aggregate({ _sum: { bidAmount: true, impressions: true, clicks: true }, _count: { _all: true } });
  const paid = await prisma.sponsoredListing.aggregate({ where: { paymentStatus: 'PAID' }, _sum: { bidAmount: true } });
  return {
    totalCampaigns: agg._count._all,
    totalImpressions: agg._sum.impressions ?? 0,
    totalClicks: agg._sum.clicks ?? 0,
    grossBidValue: Number(agg._sum.bidAmount ?? 0),
    paidRevenue: Number(paid._sum.bidAmount ?? 0),
  };
}

/** Job: expire campaigns whose window has passed. */
export async function expireCampaigns() {
  const now = new Date();
  const result = await prisma.sponsoredListing.updateMany({
    where: { isActive: true, endDate: { lt: now } },
    data: { isActive: false, paymentStatus: 'EXPIRED' },
  });
  return { expired: result.count };
}
