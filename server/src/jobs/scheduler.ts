import { prisma } from '../config/prisma';
import logger from '../config/logger';
import { expireFlashSales } from '../modules/promotions/promo.service';
import { expireCampaigns } from '../modules/sponsored/sponsored.service';
import { processPriceDropAlerts } from '../modules/wishlist/wishlist.service';
import { autoCancelUnconfirmed } from '../modules/orders/order.fulfillment';
import { markOverdueInstallments } from '../modules/payments/payout.service';

type JobFn = () => Promise<unknown>;

interface Job {
  key: string;
  label: string;
  intervalMs: number;
  run: JobFn;
}

const MINUTE = 60_000;

const JOBS: Job[] = [
  { key: 'flash-sales:expire', label: 'Expire / activate flash sales', intervalMs: 5 * MINUTE, run: expireFlashSales },
  { key: 'sponsored:expire', label: 'Expire sponsored campaigns', intervalMs: 15 * MINUTE, run: expireCampaigns },
  { key: 'orders:auto-cancel', label: 'Auto-cancel unconfirmed orders', intervalMs: 10 * MINUTE, run: autoCancelUnconfirmed },
  { key: 'wishlist:price-drop', label: 'Wishlist price-drop alerts', intervalMs: 60 * MINUTE, run: processPriceDropAlerts },
  { key: 'installments:overdue', label: 'Flag overdue installment plans', intervalMs: 6 * 60 * MINUTE, run: markOverdueInstallments },
];

const timers: NodeJS.Timeout[] = [];

async function runJob(job: Job) {
  const started = Date.now();
  try {
    const result = await job.run();
    await prisma.scheduledJobRun.upsert({
      where: { key: job.key },
      create: { key: job.key, lastRunAt: new Date(), result: { ok: true, ms: Date.now() - started, summary: result ?? null } as any },
      update: { lastRunAt: new Date(), result: { ok: true, ms: Date.now() - started, summary: result ?? null } as any },
    });
    logger.info(`[job] ${job.label} completed in ${Date.now() - started}ms`);
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);
    logger.error(`[job] ${job.label} failed: ${message}`);
    await prisma.scheduledJobRun
      .upsert({
        where: { key: job.key },
        create: { key: job.key, lastRunAt: new Date(), result: { ok: false, error: message } as any },
        update: { lastRunAt: new Date(), result: { ok: false, error: message } as any },
      })
      .catch(() => {});
  }
}

/** Starts the in-process job loop. Each job also fires once shortly after boot. */
export function startJobs() {
  for (const job of JOBS) {
    // stagger initial runs so we don't hammer the DB at startup
    setTimeout(() => void runJob(job), 3000 + JOBS.indexOf(job) * 1500).unref?.();
    const timer = setInterval(() => void runJob(job), job.intervalMs);
    timer.unref?.();
    timers.push(timer);
  }
  logger.info(`[jobs] ${JOBS.length} scheduled jobs registered`);
}

export function stopJobs() {
  timers.forEach((t) => clearInterval(t));
  timers.length = 0;
}

export { JOBS as REGISTERED_JOBS };
