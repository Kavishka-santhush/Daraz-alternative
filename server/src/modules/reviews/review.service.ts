import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';
import { paginated } from '../../utils/pagination';
import { chatJson } from '../../lib/ai/openrouter';
import { toPublicUrl } from '../../lib/upload';
import { notify, notifyRoleHolders } from '../notifications/notification.service';
import type { Request } from 'express';

export interface CreateReviewInput {
  productId: string;
  orderItemId?: string;
  rating: number;
  title?: string;
  body?: string;
}

/** Buyer submits a product review. Verified when tied to a delivered order item. */
export async function createReview(buyerId: string, input: CreateReviewInput) {
  const product = await prisma.product.findUnique({ where: { id: input.productId }, select: { id: true, shopId: true, title: true, shop: { select: { seller: { select: { id: true, user: { select: { id: true } } } } } } } });
  if (!product) throw ApiError.notFound('Product not found');

  let isVerified = false;
  let orderItemId: string | null = null;
  if (input.orderItemId) {
    const item = await prisma.orderItem.findFirst({ where: { id: input.orderItemId, subOrder: { order: { buyerId, status: 'DELIVERED' } } } });
    if (!item || item.productId !== input.productId) throw ApiError.badRequest('Order item does not qualify for this review');
    if (await prisma.review.findUnique({ where: { orderItemId: item.id } })) throw ApiError.conflict('This item has already been reviewed');
    isVerified = true;
    orderItemId = item.id;
  } else {
    // Unverified review: one per buyer per product.
    const dup = await prisma.review.findFirst({ where: { productId: input.productId, buyerId, orderItemId: null } });
    if (dup) throw ApiError.conflict('You have already reviewed this product');
  }

  // AI sentiment analysis (best-effort).
  let sentiment: Prisma.InputJsonValue | undefined;
  if (input.body) {
    const s = await chatJson<{ label: string; score: number }>(
      `Classify the sentiment of this product review. Return JSON {"label":"POSITIVE|NEUTRAL|NEGATIVE","score":0..1}.\nReview (${input.rating}/5): ${input.title ?? ''} ${input.body}`,
      'You are a strict sentiment classifier for e-commerce reviews. Answer with JSON only.',
    ).catch(() => null);
    if (s && typeof s.label === 'string') sentiment = { label: s.label, score: Number(s.score ?? 0.5) };
  }

  const review = await prisma.review.create({
    data: {
      productId: input.productId,
      sellerId: product.shop?.seller?.id,
      orderItemId,
      buyerId,
      rating: input.rating,
      title: input.title,
      body: input.body,
      isVerified,
      sentiment: sentiment as never,
    },
    include: { buyer: { select: { name: true, avatarUrl: true } } },
  });

  // Update the product aggregate rating.
  await recomputeProductRating(input.productId);

  const sellerUserId = product.shop?.seller?.user?.id;
  if (sellerUserId) notify({ userId: sellerUserId, type: 'REVIEW_NEW', title: 'New review', body: `A review was posted on ${product.title}`, actionUrl: '/seller/reviews' }).catch(() => {});
  return review;
}

export async function recomputeProductRating(productId: string) {
  const agg = await prisma.review.aggregate({ where: { productId, isVisible: true }, _avg: { rating: true }, _count: { rating: true } });
  await prisma.product.update({
    where: { id: productId },
    data: { ratingAverage: agg._avg.rating ? Number(agg._avg.rating.toFixed(2)) : 0, ratingCount: agg._count.rating },
  });
}

export async function listProductReviews(productId: string, req: Request) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  const where: Prisma.ReviewWhereInput = { productId, isVisible: true };
  if (req.query.rating) where.rating = Number(req.query.rating);
  if (req.query.verified === 'true') where.isVerified = true;
  const orderBy: Prisma.ReviewOrderByWithRelationInput[] =
    req.query.sort === 'oldest' ? [{ createdAt: 'asc' }]
      : req.query.sort === 'helpful' ? [{ helpfulVotes: { _count: 'desc' } }, { createdAt: 'desc' }]
      : [{ createdAt: 'desc' }];
  const [items, total, breakdown] = await prisma.$transaction([
    prisma.review.findMany({ where, include: { buyer: { select: { name: true, avatarUrl: true } }, helpfulVotes: { select: { userId: true, isHelpful: true } }, media: true }, orderBy, skip: (page - 1) * limit, take: limit }),
    prisma.review.count({ where }),
    prisma.review.groupBy({ by: ['rating'], where: { productId, isVisible: true }, _count: { _all: true } }),
  ]);
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>;
  for (const b of breakdown) counts[b.rating] = b._count._all;
  return { ...paginated(items.map(({ helpfulVotes, ...r }) => ({ ...r, helpfulCount: helpfulVotes.filter((h) => h.isHelpful).length })), total, page, limit), ratingBreakdown: counts };
}

/** AI-generated summary of recent reviews (cached on the product reviews). */
export async function summarizeProductReviews(productId: string) {
  const reviews = await prisma.review.findMany({ where: { productId, isVisible: true, body: { not: null } }, orderBy: { createdAt: 'desc' }, take: 50, select: { rating: true, body: true, aiSummary: true } });
  const cached = reviews.find((r) => r.aiSummary);
  if (cached?.aiSummary) return { summary: cached.aiSummary, count: reviews.length };
  if (!reviews.length) throw ApiError.badRequest('No reviews to summarize');
  const summary = await chatJson<{ summary: string }>(
    `Summarize these product reviews in 2-3 concise sentences highlighting common praise and complaints. Return JSON {"summary":"..."}.\n${reviews.map((r) => `${r.rating}/5 - ${r.body}`).join('\n')}`,
    'You are an e-commerce analytics assistant. Answer with JSON only.',
  );
  if (!summary?.summary) throw new ApiError(502, 'AI_SUMMARY_FAILED', 'Could not generate a summary right now');
  await prisma.review.updateMany({ where: { productId }, data: { aiSummary: summary.summary } });
  return { summary: summary.summary, count: reviews.length };
}

export async function voteHelpful(reviewId: string, userId: string, isHelpful: boolean) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw ApiError.notFound('Review not found');
  if (review.buyerId === userId) throw ApiError.badRequest('You cannot vote on your own review');
  await prisma.reviewHelpful.upsert({ where: { reviewId_userId: { reviewId, userId } }, create: { reviewId, userId, isHelpful }, update: { isHelpful } });
  const count = await prisma.reviewHelpful.count({ where: { reviewId, isHelpful: true } });
  return { helpfulCount: count };
}

export async function sellerReply(sellerUserId: string, reviewId: string, reply: string) {
  const review = await prisma.review.findUnique({ where: { id: reviewId }, include: { product: { include: { shop: { include: { seller: { select: { userId: true } } } } } } } });
  if (!review) throw ApiError.notFound('Review not found');
  if (review.product?.shop?.seller?.userId !== sellerUserId) throw ApiError.forbidden('Not your review');
  await prisma.review.update({ where: { id: reviewId }, data: { sellerReply: reply, sellerRepliedAt: new Date() } });
  await notify({ userId: review.buyerId, type: 'REVIEW_REPLY', title: 'Seller replied to your review', body: reply.slice(0, 120), actionUrl: `/products/${review.productId}` });
  return { ok: true };
}

export async function reportReview(reviewId: string, userId: string, reason: string) {
  await prisma.review.update({ where: { id: reviewId }, data: { isReported: true, reportReason: reason, reportedById: userId } });
  await notifyRoleHolders(['ADMIN', 'SUPPORT_AGENT'], { audience: 'ADMIN', type: 'REVIEW_REPORTED', title: 'Review reported', body: `Review ${reviewId}: ${reason}`, actionUrl: '/admin/reviews' });
  return { ok: true };
}

/** Moderation: hide/restore a review and refresh aggregates. */
export async function setReviewVisibility(actorId: string, reviewId: string, isVisible: boolean) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw ApiError.notFound('Review not found');
  await prisma.review.update({ where: { id: reviewId }, data: { isVisible, isReported: isVisible ? false : review.isReported } });
  if (review.productId) await recomputeProductRating(review.productId);
  await prisma.auditLog.create({ data: { actorId, action: isVisible ? 'review:restore' : 'review:hide', entityType: 'REVIEW', entityId: reviewId } });
  return { ok: true };
}

export async function listSellerReviews(sellerUserId: string, req: Request) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const where: Prisma.ReviewWhereInput = { product: { shop: { seller: { userId: sellerUserId } } } };
  if (req.query.unanswered === 'true') where.sellerReply = null;
  const [items, total] = await prisma.$transaction([
    prisma.review.findMany({ where, include: { buyer: { select: { name: true } }, product: { select: { id: true, title: true, slug: true } }, helpfulVotes: { select: { isHelpful: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.review.count({ where }),
  ]);
  return paginated(items.map(({ helpfulVotes, ...r }) => ({ ...r, helpfulCount: helpfulVotes.filter((h) => h.isHelpful).length })), total, page, limit);
}

/** Attach buyer-uploaded photos to their review. */
export async function addReviewMedia(reviewId: string, buyerId: string, files: Express.Multer.File[]) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw ApiError.notFound('Review not found');
  if (review.buyerId !== buyerId) throw ApiError.forbidden('Not your review');
  const created = await prisma.reviewMedia.createMany({
    data: files.map((f, i) => ({ reviewId, uploaderId: buyerId, url: toPublicUrl(f.path), type: 'IMAGE', position: i })),
  });
  return { added: created.count };
}
