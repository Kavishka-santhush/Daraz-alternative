import { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRoles } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/http';
import { uploader, withCategory } from '../../lib/upload';
import { UserRole, TicketStatus } from '@prisma/client';
import * as ticket from './ticket.service';

const router = Router();

const STAFF_ROLES: UserRole[] = [UserRole.SUPPORT_AGENT, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OPERATIONS_MANAGER];

const createSchema = z.object({
  type: z.enum(['ORDER', 'RETURN', 'REFUND', 'PRODUCT', 'PAYMENT', 'ACCOUNT', 'OTHER']),
  subject: z.string().min(4).max(160),
  description: z.string().min(10).max(4000),
  orderId: z.string().optional(),
  subOrderId: z.string().optional(),
  productId: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});

router.use(requireAuth);

// ── Any authenticated user ──
router.post('/', validate(createSchema), asyncHandler(async (req: Request, res: Response) => created(res, await ticket.createTicket(req.user!.id, req.body))));
router.get('/mine', asyncHandler(async (req: Request, res: Response) => {
  const isStaffUser = STAFF_ROLES.includes(req.user!.role);
  const data = await ticket.listTickets(req, isStaffUser ? {} : { creatorId: req.user!.id });
  return ok(res, data.data, 200, data.meta);
}));

// ── Staff queues ──
router.get('/staff/all', requireRoles(...STAFF_ROLES), asyncHandler(async (req: Request, res: Response) => {
  const data = await ticket.listTickets(req, { staff: true });
  return ok(res, data.data, 200, data.meta);
}));
router.get('/staff/mine', requireRoles(...STAFF_ROLES), asyncHandler(async (req: Request, res: Response) => {
  const data = await ticket.listTickets(req, { staff: true, assignedToId: req.user!.id });
  return ok(res, data.data, 200, data.meta);
}));
router.get('/staff/stats', requireRoles(...STAFF_ROLES), asyncHandler(async (req: Request, res: Response) => ok(res, await ticket.ticketStats())));

// ── Canned responses ──
router.get('/canned', requireRoles(...STAFF_ROLES), asyncHandler(async (req: Request, res: Response) => ok(res, await ticket.listCanned(req.query.category as string | undefined))));
router.post('/canned', requireRoles(...STAFF_ROLES), validate(z.object({ title: z.string().min(3).max(120), body: z.string().min(5).max(4000), category: z.string().max(60).optional() })), asyncHandler(async (req: Request, res: Response) => created(res, await ticket.createCanned(req.user!.id, req.body))));
router.patch('/canned/:id', requireRoles(...STAFF_ROLES), validate(z.object({ title: z.string().min(3).max(120).optional(), body: z.string().min(5).max(4000).optional(), category: z.string().max(60).optional() })), asyncHandler(async (req: Request, res: Response) => ok(res, await ticket.updateCanned(req.params.id, req.body))));
router.delete('/canned/:id', requireRoles(...STAFF_ROLES), asyncHandler(async (req: Request, res: Response) => ok(res, await ticket.deleteCanned(req.params.id))));

// ── Single ticket ──
router.get('/:id', asyncHandler(async (req: Request, res: Response) => ok(res, await ticket.getTicket(req.params.id, req.user!.id, STAFF_ROLES.includes(req.user!.role)))));
router.post('/:id/messages', withCategory('tickets'), uploader(4).array('files', 4), validate(z.object({ body: z.string().min(1).max(4000), internal: z.boolean().optional() }), 'body'), asyncHandler(async (req: Request, res: Response) => {
  const isStaffUser = STAFF_ROLES.includes(req.user!.role);
  created(res, await ticket.addMessage(req.params.id, req.user!.id, req.body.body, { staff: isStaffUser, internal: req.body.internal, files: (req.files ?? []) as Express.Multer.File[] }));
}));

// ── Staff actions ──
router.post('/:id/assign', requireRoles(...STAFF_ROLES), validate(z.object({ agentId: z.string().nullable().optional() })), asyncHandler(async (req: Request, res: Response) => ok(res, await ticket.assignTicket(req.user!.id, req.params.id, req.body.agentId ?? null))));
router.post('/:id/status', requireRoles(...STAFF_ROLES), validate(z.object({ status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']), resolution: z.string().max(4000).optional() })), asyncHandler(async (req: Request, res: Response) => ok(res, await ticket.setTicketStatus(req.user!.id, req.params.id, req.body.status as TicketStatus, req.body.resolution))));
router.patch('/:id/priority', requireRoles(...STAFF_ROLES), validate(z.object({ priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']) })), asyncHandler(async (req: Request, res: Response) => ok(res, await ticket.setPriority(req.user!.id, req.params.id, req.body.priority))));
router.patch('/:id/note', requireRoles(...STAFF_ROLES), validate(z.object({ notes: z.string().max(4000) })), asyncHandler(async (req: Request, res: Response) => ok(res, await ticket.saveAgentNote(req.user!.id, req.params.id, req.body.notes))));

export default router;
