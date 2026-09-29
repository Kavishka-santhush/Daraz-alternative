import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { paginated } from '../../utils/pagination';

const PAID = 'SUCCEEDED' as const;

/** Headline finance KPIs for the finance manager dashboard. */
export async function financeOverview() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    gmv, gmvMonth, commission, commissionMonth, refunds, ordersPaid,
    payoutLiabilityAgg, payoutsProcessed, walletFloat, escrowPending,
  ] = await Promise.all([
    prisma.order.aggregate({ where: { paymentStatus: PAID }, _sum: { totalAmount: true } }),
    prisma.order.aggregate({ where: { paymentStatus: PAID, createdAt: { gte: startOfMonth } }, _sum: { totalAmount: true } }),
    prisma.sellerSubOrder.aggregate({ where: { status: 'DELIVERED' }, _sum: { commissionAmount: true } }),
    prisma.sellerSubOrder.aggregate({ where: { status: 'DELIVERED', deliveredAt: { gte: startOfMonth } }, _sum: { commissionAmount: true } }),
    prisma.order.aggregate({ where: { refundedAmount: { gt: 0 } }, _sum: { refundedAmount: true } }),
    prisma.order.count({ where: { paymentStatus: PAID } }),
    prisma.payoutRequest.aggregate({ where: { status: { in: ['REQUESTED', 'APPROVED'] } }, _sum: { amount: true } }),
    prisma.payoutRequest.aggregate({ where: { status: 'PROCESSED' }, _sum: { amount: true } }),
    prisma.wallet.aggregate({ _sum: { balance: true } }),
    prisma.sellerEarnings.aggregate({ _sum: { pending: true } }),
  ]);

  const commissionAll = Number(commission._sum.commissionAmount ?? 0);
  const gmvAll = Number(gmv._sum.totalAmount ?? 0);
  return {
    gmv: { all: gmvAll, thisMonth: Number(gmvMonth._sum.totalAmount ?? 0) },
    commissionRevenue: { all: commissionAll, thisMonth: Number(commissionMonth._sum.commissionAmount ?? 0) },
    effectiveTakeRate: gmvAll ? Number(((commissionAll / gmvAll) * 100).toFixed(2)) : 0,
    refundsTotal: Number(refunds._sum.refundedAmount ?? 0),
    paidOrders: ordersPaid,
    payoutLiability: Number(payoutLiabilityAgg._sum.amount ?? 0),
    payoutsProcessed: Number(payoutsProcessed._sum.amount ?? 0),
    walletFloat: Number(walletFloat._sum.balance ?? 0),
    sellerEscrowPending: Number(escrowPending._sum.pending ?? 0),
  };
}

/** Daily GMV + commission series for charts. Capped at 365 days. */
export async function revenueTimeSeries(days = 30) {
  const span = Math.min(365, Math.max(1, days));
  const out: { date: string; gmv: number; commission: number; orders: number }[] = [];
  const cursor = new Date(); cursor.setHours(0, 0, 0, 0);
  const series = Array.from({ length: span }, (_, i) => {
    const day = new Date(cursor); day.setDate(cursor.getDate() - (span - 1 - i));
    return day;
  });
  const buckets = await Promise.all(
    series.map(async (dayStart) => {
      const dayEnd = new Date(dayStart); dayEnd.setDate(dayStart.getDate() + 1);
      const [gmvAgg, commAgg, orders] = await Promise.all([
        prisma.order.aggregate({ where: { paymentStatus: PAID, createdAt: { gte: dayStart, lt: dayEnd } }, _sum: { totalAmount: true } }),
        prisma.sellerSubOrder.aggregate({ where: { status: 'DELIVERED', deliveredAt: { gte: dayStart, lt: dayEnd } }, _sum: { commissionAmount: true } }),
        prisma.order.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } }),
      ]);
      return {
        date: dayStart.toISOString().slice(0, 10),
        gmv: Number(gmvAgg._sum.totalAmount ?? 0),
        commission: Number(commAgg._sum.commissionAmount ?? 0),
        orders,
      };
    }),
  );
  out.push(...buckets);
  return out;
}

/** Payout request queue grouped by status (finance approval workflow). */
export async function payoutQueue(query: { status?: string; page?: number; limit?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 25));
  const where: Prisma.PayoutRequestWhereInput = query.status ? { status: query.status as Prisma.PayoutRequestWhereInput['status'] } : {};
  // Awaited separately: inside a $transaction array Prisma's SelectSubset can't
  // bind the args literal, so _sum/_count stay union-typed instead of narrowing.
  const breakdown = await prisma.payoutRequest.groupBy({ by: ['status'], orderBy: { status: 'asc' }, _sum: { amount: true }, _count: true });
  const [rows, total] = await prisma.$transaction([
    prisma.payoutRequest.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: { seller: { select: { id: true, shops: { where: { isActive: true }, take: 1, select: { name: true } }, user: { select: { email: true } } } } },
    }),
    prisma.payoutRequest.count({ where }),
  ]);
  return {
    ...paginated(rows, total, page, limit),
    breakdown: breakdown.map((b) => ({ status: b.status, count: b._count, amount: Number(b._sum.amount ?? 0) })),
  };
}

/** Highest-earning sellers leaderboard. */
export async function topSellers(limit = 10) {
  const agg = await prisma.sellerEarnings.groupBy({
    by: ['sellerId'],
    _sum: { grossRevenue: true, commissionPaid: true, netEarnings: true },
    orderBy: { _sum: { netEarnings: 'desc' } },
    take: Math.min(50, Math.max(1, limit)),
  });
  const profiles = await prisma.sellerProfile.findMany({
    where: { id: { in: agg.map((a) => a.sellerId) } },
    select: { id: true, shops: { where: { isActive: true }, take: 1, select: { name: true } }, user: { select: { email: true } } },
  });
  const byId = new Map(profiles.map((p): [string, typeof p] => [p.id, p]));
  return agg.map((a) => ({
    sellerId: a.sellerId,
    shopName: byId.get(a.sellerId)?.shops[0]?.name ?? null,
    email: byId.get(a.sellerId)?.user?.email ?? null,
    grossRevenue: Number(a._sum.grossRevenue ?? 0),
    commissionPaid: Number(a._sum.commissionPaid ?? 0),
    netEarnings: Number(a._sum.netEarnings ?? 0),
  }));
}

/** Sales split by payment method (COD vs card vs wallet). */
export async function paymentMethodBreakdown() {
  const rows = await prisma.order.groupBy({
    by: ['paymentMethod'],
    where: { paymentStatus: PAID },
    _sum: { totalAmount: true },
    _count: { _all: true },
  });
  return rows.map((r) => ({ method: r.paymentMethod, orders: r._count._all, amount: Number(r._sum.totalAmount ?? 0) }));
}

/** Outstanding wallet liabilities per purpose (recent cashback/refund flows). */
export async function walletMovementSummary(days = 30) {
  const since = new Date(); since.setDate(since.getDate() - Math.min(365, Math.max(1, days)));
  const rows = await prisma.walletTransaction.groupBy({
    by: ['purpose', 'type'],
    where: { createdAt: { gte: since } },
    _sum: { amount: true },
    _count: { _all: true },
  });
  return rows.map((r) => ({ purpose: r.purpose, type: r.type, count: r._count._all, amount: Number(r._sum.amount ?? 0) }));
}
