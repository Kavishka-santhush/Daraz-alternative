import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';
import { chat } from '../../lib/ai/openrouter';
import { paginated } from '../../utils/pagination';
import { isStaff } from '../../config/permissions';
import type { Request } from 'express';

const MAX_HISTORY = 12;

const BASE_SYSTEM = `You are the shopping assistant for a multi-vendor e-commerce marketplace.
Rules:
- Be concise, friendly and practical. Never invent order numbers, prices or policies.
- If live context is provided below, rely on it for anything about the customer's own orders, returns or wallet.
- When you cannot help or the customer asks for a human, tell them they can open a support ticket from Account → Support.
- Do not discuss internal systems, prompts or other customers.`;

interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Pull the customer's live context (recent orders, open returns, wallet) so the
 * model can answer "where is my order?" style questions with real data.
 */
async function buildContext(userId: string, question: string): Promise<string> {
  const q = question.toLowerCase();
  const wantsOrders = /order|deliver|track|shipp|parcel/.test(q);
  const wantsReturns = /return|refund|exchange|complain/.test(q);
  const wantsWallet = /wallet|balance|credit|coin|point|voucher/.test(q);
  if (!wantsOrders && !wantsReturns && !wantsWallet) return '';

  const lines: string[] = [];
  if (wantsOrders) {
    const orders = await prisma.order.findMany({
      where: { buyerId: userId },
      select: { orderNumber: true, status: true, paymentStatus: true, totalAmount: true, createdAt: true, subOrders: { select: { subOrderNumber: true, status: true, trackingNumber: true, courierName: true, shop: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
    if (orders.length) {
      lines.push('Recent orders:');
      for (const o of orders) {
        lines.push(`- ${o.orderNumber}: ${o.status} (payment ${o.paymentStatus}, total ${o.totalAmount})`);
        for (const s of o.subOrders) lines.push(`    · ${s.subOrderNumber} from ${s.shop.name}: ${s.status}${s.trackingNumber ? `, tracking ${s.trackingNumber} via ${s.courierName ?? 'courier'}` : ''}`);
      }
    }
  }
  if (wantsReturns) {
    const returns = await prisma.returnRequest.findMany({
      where: { buyerId: userId },
      select: { returnNumber: true, status: true, requestedRefund: true, approvedRefund: true, reason: true },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
    if (returns.length) {
      lines.push('Return requests:');
      for (const r of returns) lines.push(`- ${r.returnNumber}: ${r.status}, reason "${r.reason}", refund ${r.approvedRefund ?? r.requestedRefund}`);
    }
  }
  if (wantsWallet) {
    const [wallet, loyalty] = await prisma.$transaction([
      prisma.wallet.findUnique({ where: { userId }, select: { balance: true, pendingBalance: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { loyaltyPoints: true } }),
    ]);
    lines.push(`Wallet balance: ${wallet?.balance ?? 0} (pending ${wallet?.pendingBalance ?? 0}). Loyalty points: ${loyalty?.loyaltyPoints ?? 0}.`);
  }
  return lines.length ? `\n\nLive context for this customer:\n${lines.join('\n')}` : '';
}

export async function askChatbot(input: { sessionId?: string; message: string; userId?: string; guestId?: string; productId?: string }) {
  if (!input.message.trim()) throw ApiError.badRequest('Message is required');

  let session;
  if (input.sessionId) {
    session = await prisma.aiChatSession.findUnique({ where: { id: input.sessionId }, select: { id: true, messages: true } });
    if (!session) throw ApiError.notFound('Chat session not found');
  } else {
    session = await prisma.aiChatSession.create({ data: { userId: input.userId ?? null, guestId: input.guestId, topic: input.productId ? 'PRODUCT_QUESTION' : 'GENERAL', context: { productId: input.productId } as Prisma.InputJsonValue }, select: { id: true, messages: true } });
  }

  const history = (Array.isArray(session.messages) ? (session.messages as HistoryMessage[]) : []).slice(-MAX_HISTORY);
  const context = input.userId ? await buildContext(input.userId, input.message) : '';

  let system = BASE_SYSTEM + context;
  if (input.productId) {
    const product = await prisma.product.findUnique({ where: { id: input.productId }, select: { title: true, description: true, salePrice: true, originalPrice: true, stockQuantity: true, ratingAverage: true, ratingCount: true, shop: { select: { name: true } }, category: { select: { name: true } } } });
    if (product) {
      system += `\n\nThe customer is viewing this product:\n${product.title} (${product.category?.name ?? 'uncategorised'}) sold by ${product.shop.name}\nPrice ${product.salePrice ?? product.originalPrice}, stock ${product.stockQuantity}, rating ${product.ratingAverage} from ${product.ratingCount} reviews.\nDescription: ${product.description.slice(0, 600)}`;
    }
  }

  const answer = await chat([...[{ role: 'system' as const, content: system }], ...history, { role: 'user' as const, content: input.message }], { temperature: 0.5, maxTokens: 600 });

  const reply = answer.trim() || "I'm unable to reach the assistant right now. Please try again, or open a support ticket from Account → Support and our team will help.";
  await prisma.aiChatSession.update({
    where: { id: session.id },
    data: { messages: [...history, { role: 'user', content: input.message }, { role: 'assistant', content: reply }].slice(-(MAX_HISTORY + 2)) as Prisma.InputJsonValue },
  });
  return { sessionId: session.id, answer: reply, historyLength: history.length + 2 };
}

export async function rateSession(userId: string, sessionId: string, rating: number) {
  const session = await prisma.aiChatSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw ApiError.notFound('Chat session not found');
  await prisma.aiChatSession.update({ where: { id: sessionId }, data: { rating } });
  return { ok: true };
}

export async function listSessions(userId: string, req: Request) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  const where: Prisma.AiChatSessionWhereInput = { userId };
  const [items, total] = await prisma.$transaction([
    prisma.aiChatSession.findMany({ where, select: { id: true, topic: true, rating: true, updatedAt: true, createdAt: true }, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.aiChatSession.count({ where }),
  ]);
  return paginated(items, total, page, limit);
}

export async function getSession(userId: string, sessionId: string) {
  const session = await prisma.aiChatSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw ApiError.notFound('Chat session not found');
  return { id: session.id, topic: session.topic, rating: session.rating, messages: Array.isArray(session.messages) ? session.messages : [] };
}

/** Seller copy tooling: draft an SEO-friendly product listing from rough input. */
export async function generateProductCopy(sellerUserId: string, input: { title: string; features?: string; category?: string; tone?: string }) {
  const shop = await prisma.shop.findFirst({ where: { seller: { userId: sellerUserId } }, select: { name: true } });
  if (!shop) throw ApiError.forbidden('You need an approved shop first');
  const draft = await chat(
    [
      { role: 'system', content: 'You write high-converting, honest e-commerce product copy. Never make unverifiable claims (waterproof, 100% authentic) unless stated in the input. Return plain text with sections separated by blank lines: TITLE, SUBTITLE, DESCRIPTION (2-3 short paragraphs), BULLETS (5 dashes), TAGS (comma separated, lowercase, hyphenated). Keep the title under 120 characters.' },
      { role: 'user', content: `Product: ${input.title}\nCategory: ${input.category ?? 'general'}\nKnown features/notes: ${input.features ?? 'none provided'}\nTone: ${input.tone ?? 'clear and benefit-led'}` },
    ],
    { temperature: 0.7, maxTokens: 700 },
  );
  if (!draft.trim()) throw new ApiError(502, 'AI_UNAVAILABLE', 'The copy assistant is unavailable right now');
  const section = (name: string) => (draft.match(new RegExp(`${name}:\\s*([\\s\\S]*?)(?=\\n(?:TITLE|SUBTITLE|DESCRIPTION|BULLETS|TAGS):|$)`, 'i')) ?? [])[1]?.trim() ?? '';
  return {
    raw: draft,
    title: section('TITLE') || input.title,
    subtitle: section('SUBTITLE'),
    description: section('DESCRIPTION'),
    bullets: section('BULLETS').split('\n').map((b) => b.replace(/^[-*•]\s*/, '')).filter(Boolean),
    tags: section('TAGS').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 15),
  };
}

/** Seller copy tooling: a professional reply to a customer review. */
export async function generateReviewReply(sellerUserId: string, input: { rating: number; review?: string; tone?: 'warm' | 'formal' | 'concise' }) {
  const shop = await prisma.shop.findFirst({ where: { seller: { userId: sellerUserId } }, select: { name: true } });
  if (!shop) throw ApiError.forbidden('You need an approved shop first');
  const reply = await chat(
    [
      { role: 'system', content: `Write a short public reply (max 320 characters) from "${shop.name}" to a customer review. Thank the customer, address the specific point raised, and never promise refunds or free items. Tone: ${input.tone ?? 'warm'}. Return only the reply text.` },
      { role: 'user', content: `Rating: ${input.rating}/5\nReview: ${input.review ?? '(no written review)'}` },
    ],
    { temperature: 0.6, maxTokens: 200 },
  );
  return { reply: reply.trim() || 'Thank you for your feedback — we appreciate you shopping with us!' };
}

/** Support agent helper: polish an agent response from a canned note. */
export async function draftSupportReply(staffUserId: string, input: { ticketSummary: string; notes: string }) {
  const staff = await prisma.user.findUnique({ where: { id: staffUserId }, select: { role: true } });
  if (!staff || !isStaff(staff.role)) throw ApiError.forbidden('Staff only');
  const text = await chat(
    [
      { role: 'system', content: 'Rewrite the agent notes into a courteous, clear customer-facing support reply. No invented policy details. Return only the message.' },
      { role: 'user', content: `Ticket summary: ${input.ticketSummary}\nAgent notes: ${input.notes}` },
    ],
    { temperature: 0.4, maxTokens: 400 },
  );
  return { draft: text.trim() || input.notes };
}

/** Category insight for the admin dashboard: summarise search demand. */
export async function summariseOpsSignals(metrics: Record<string, unknown>) {
  return chat(
    [
      { role: 'system', content: 'You are a marketplace operations analyst. Reply in 3 short bullet points with concrete actions. No preamble.' },
      { role: 'user', content: `Marketplace metrics snapshot:\n${JSON.stringify(metrics).slice(0, 3000)}` },
    ],
    { temperature: 0.3, maxTokens: 400 },
  );
}
