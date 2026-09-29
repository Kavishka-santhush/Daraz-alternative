import { Prisma, TicketStatus, TicketPriority } from '@prisma/client';
import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';
import { paginated } from '../../utils/pagination';
import { referenceNumber } from '../../utils/nano';
import { notify, notifyRoleHolders } from '../notifications/notification.service';
import { templates } from '../../lib/email/templates';
import { emitToRole } from '../../lib/socket';
import { toPublicUrl } from '../../lib/upload';
import type { Request } from 'express';

export interface CreateTicketInput {
  type: string;
  subject: string;
  description: string;
  orderId?: string;
  subOrderId?: string;
  productId?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export async function createTicket(creatorId: string, input: CreateTicketInput) {
  const creator = await prisma.user.findUnique({ where: { id: creatorId }, select: { id: true, name: true, role: true } });
  if (!creator) throw ApiError.unauthorized();

  // Linking an order/product must belong to (or be visible to) the creator.
  if (input.orderId) {
    const order = await prisma.order.findFirst({ where: { id: input.orderId }, select: { id: true, buyerId: true, subOrders: { select: { shop: { select: { seller: { select: { userId: true } } } } } } } });
    if (!order) throw ApiError.notFound('Order not found');
    const isSeller = order.subOrders.some((s) => s.shop?.seller?.userId === creatorId);
    if (order.buyerId !== creatorId && !isSeller) throw ApiError.forbidden('That order is not yours');
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      ticketNumber: referenceNumber('TKT'),
      creatorId,
      type: input.type as never,
      subject: input.subject,
      description: input.description,
      orderId: input.orderId,
      subOrderId: input.subOrderId,
      productId: input.productId,
      priority: (input.priority ?? (input.type === 'REFUND' || input.type === 'PAYMENT' ? 'HIGH' : 'MEDIUM')) as never,
      messages: { create: { authorId: creatorId, body: input.description } },
    },
  });

  await notifyRoleHolders(['SUPPORT_AGENT', 'ADMIN'], {
    audience: 'ADMIN',
    type: 'TICKET_CREATED',
    title: `New ticket ${ticket.ticketNumber}`,
    body: input.subject,
    actionUrl: `/support/tickets/${ticket.id}`,
  });
  emitToRole('SUPPORT_AGENT', 'ticket:new', { id: ticket.id, ticketNumber: ticket.ticketNumber, subject: ticket.subject, priority: ticket.priority });
  return ticket;
}

export async function listTickets(req: Request, scope: { creatorId?: string; staff?: boolean; assignedToId?: string }) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const where: Prisma.SupportTicketWhereInput = {};
  if (scope.creatorId) where.creatorId = scope.creatorId;
  if (scope.assignedToId) where.assignedToId = scope.assignedToId;
  if (req.query.status) where.status = req.query.status as TicketStatus;
  if (req.query.type) where.type = req.query.type as never;
  if (req.query.priority) where.priority = req.query.priority as TicketPriority;
  if (req.query.q) where.OR = [{ subject: { contains: String(req.query.q), mode: 'insensitive' } }, { description: { contains: String(req.query.q), mode: 'insensitive' } }, { ticketNumber: { contains: String(req.query.q), mode: 'insensitive' } }];
  const [items, total] = await prisma.$transaction([
    prisma.supportTicket.findMany({
      where,
      include: { creator: { select: { id: true, name: true, email: true, role: true } }, assignedTo: { select: { id: true, name: true } }, messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true, body: true, authorId: true, isInternal: true } } },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { updatedAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.supportTicket.count({ where }),
  ]);
  return paginated(items, total, page, limit);
}

async function loadTicket(idOrNumber: string, userId: string, staff: boolean) {
  const isNumber = idOrNumber.startsWith('TKT');
  const ticket = await prisma.supportTicket.findUnique({
    where: isNumber ? { ticketNumber: idOrNumber } : { id: idOrNumber },
    include: { messages: { include: { author: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: 'asc' } }, creator: true, assignedTo: { select: { id: true, name: true } } },
  });
  if (!ticket) throw ApiError.notFound('Ticket not found');
  if (!staff && ticket.creatorId !== userId) throw ApiError.forbidden('Not your ticket');
  return ticket;
}

export async function getTicket(idOrNumber: string, userId: string, staff: boolean) {
  const ticket = await loadTicket(idOrNumber, userId, staff);
  // Agents' internal notes are hidden from customers.
  if (!staff) return { ...ticket, messages: ticket.messages.filter((m) => !m.isInternal) };
  return ticket;
}

export async function addMessage(idOrNumber: string, authorId: string, body: string, opts: { staff?: boolean; internal?: boolean; files?: Express.Multer.File[] } = {}) {
  const ticket = await loadTicket(idOrNumber, authorId, Boolean(opts.staff));
  const isInternal = Boolean(opts.internal && opts.staff);
  const message = await prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      authorId,
      body,
      isInternal,
      attachments: opts.files?.length ? (opts.files.map((f) => toPublicUrl(f.path)) as Prisma.InputJsonValue) : undefined,
    },
    include: { author: { select: { id: true, name: true, role: true } } },
  });
  await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: opts.staff ? (ticket.status === TicketStatus.OPEN ? TicketStatus.IN_PROGRESS : ticket.status) : ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED ? TicketStatus.OPEN : ticket.status } });

  if (!isInternal) {
    if (opts.staff) {
      const creator = await prisma.user.findUnique({ where: { id: ticket.creatorId }, select: { id: true, name: true } });
      if (creator) notify({ userId: creator.id, type: 'TICKET_REPLY', title: `Support replied to ${ticket.ticketNumber}`, body: body.slice(0, 140), actionUrl: '/account/support', emailHtml: templates.generic(creator.name, `Support reply on ${ticket.ticketNumber}`, body.slice(0, 600)) }).catch(() => {});
    } else {
      await notifyRoleHolders(['SUPPORT_AGENT', 'ADMIN'], { audience: 'ADMIN', type: 'TICKET_CUSTOMER_REPLY', title: `Customer replied on ${ticket.ticketNumber}`, body: body.slice(0, 140), actionUrl: `/support/tickets/${ticket.id}` });
      emitToRole('SUPPORT_AGENT', 'ticket:update', { id: ticket.id, ticketNumber: ticket.ticketNumber });
    }
  }
  return message;
}

export async function assignTicket(staffId: string, ticketId: string, agentId: string | null) {
  if (agentId) {
    const agent = await prisma.user.findFirst({ where: { id: agentId, role: { in: ['SUPPORT_AGENT', 'ADMIN', 'SUPER_ADMIN'] } }, select: { id: true, name: true } });
    if (!agent) throw ApiError.badRequest('Unknown support agent');
    await prisma.supportTicket.update({ where: { id: ticketId }, data: { assignedToId: agent.id, status: TicketStatus.IN_PROGRESS } });
    await notify({ userId: agent.id, type: 'TICKET_ASSIGNED', title: 'Ticket assigned to you', body: ticketId, actionUrl: `/support/tickets/${ticketId}` }).catch(() => {});
  } else {
    await prisma.supportTicket.update({ where: { id: ticketId }, data: { assignedToId: null } });
  }
  await prisma.auditLog.create({ data: { actorId: staffId, action: 'ticket:assign', entityType: 'TICKET', entityId: ticketId } });
  return { ok: true, assignedToId: agentId };
}

export async function setTicketStatus(staffId: string, ticketId: string, status: TicketStatus, resolution?: string) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId }, include: { creator: { select: { id: true, name: true } } } });
  if (!ticket) throw ApiError.notFound('Ticket not found');
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status, resolution: status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED ? resolution ?? ticket.resolution : ticket.resolution, resolvedAt: status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED ? new Date() : ticket.resolvedAt },
  });
  if (status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED) {
    await notify({ userId: ticket.creatorId, type: 'TICKET_RESOLVED', title: `Ticket ${ticket.ticketNumber} ${status.toLowerCase()}`, body: resolution ?? '', actionUrl: '/account/support', emailHtml: templates.generic(ticket.creator.name, `Ticket ${ticket.ticketNumber}`, resolution ?? 'Your support ticket has been resolved.') }).catch(() => {});
  }
  await prisma.auditLog.create({ data: { actorId: staffId, action: `ticket:${status}`, entityType: 'TICKET', entityId: ticketId } });
  return { ok: true, status };
}

export async function setPriority(staffId: string, ticketId: string, priority: TicketPriority) {
  await prisma.supportTicket.update({ where: { id: ticketId }, data: { priority } });
  await prisma.auditLog.create({ data: { actorId: staffId, action: 'ticket:priority', entityType: 'TICKET', entityId: ticketId, after: { priority } as Prisma.InputJsonValue } });
  return { ok: true, priority };
}

export async function saveAgentNote(staffId: string, ticketId: string, notes: string) {
  await prisma.supportTicket.update({ where: { id: ticketId }, data: { notes } });
  return { ok: true };
}

// ── Canned responses ──

export async function listCanned(category?: string) {
  return prisma.cannedResponse.findMany({ where: category ? { category } : {}, orderBy: [{ useCount: 'desc' }, { title: 'asc' }] });
}

export async function createCanned(createdById: string, input: { title: string; body: string; category?: string }) {
  return prisma.cannedResponse.create({ data: { ...input, createdById } });
}

export async function updateCanned(id: string, input: { title?: string; body?: string; category?: string }) {
  return prisma.cannedResponse.update({ where: { id }, data: input });
}

export async function deleteCanned(id: string) {
  await prisma.cannedResponse.delete({ where: { id } });
  return { ok: true };
}

export async function bumpCannedUsage(id: string) {
  await prisma.cannedResponse.update({ where: { id }, data: { useCount: { increment: 1 } } });
}

// ── Agent workload stats ──

export async function ticketStats() {
  // groupBy stays out of the $transaction array so Prisma can narrow _count.
  const byPriority = await prisma.supportTicket.groupBy({ by: ['priority'], where: { status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] } }, orderBy: { priority: 'asc' }, _count: true });
  const [open, inProgress, resolvedToday, unassigned] = await prisma.$transaction([
    prisma.supportTicket.count({ where: { status: TicketStatus.OPEN } }),
    prisma.supportTicket.count({ where: { status: TicketStatus.IN_PROGRESS } }),
    prisma.supportTicket.count({ where: { status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] }, resolvedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    prisma.supportTicket.count({ where: { assignedToId: null, status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] } } }),
  ]);
  return { open, inProgress, resolvedToday, unassigned, byPriority: Object.fromEntries(byPriority.map((p) => [p.priority, p._count])) };
}
