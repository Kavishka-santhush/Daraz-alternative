'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch, apiList, ApiClientError } from '@/lib/api';
import type {
  AdminOverview,
  AdminSellerApplication,
  AdminSettings,
  AdminSettingsInput,
  AdminUserDetail,
  AdminUserRow,
  AuditLogRow,
  FinanceOverview,
  FraudAlertRow,
  FraudStatusValue,
  Order,
  Paginated,
  PaymentMethodRow,
  PayoutQueueRow,
  PayoutBreakdownRow,
  Product,
  RevenuePoint,
  Role,
  TicketDetailRow,
  TicketListRow,
  TicketStats,
  UserStatus,
} from '@/types';

const fail = (msg: string) => (e: unknown) =>
  toast.error(msg, { description: e instanceof ApiClientError ? e.message : 'Please try again.' });

/* ── Overview & settings ───────────────────────────────────── */

export function useAdminOverview() {
  return useQuery({ queryKey: ['admin', 'overview'], queryFn: () => apiGet<AdminOverview>('/admin/overview'), retry: false });
}

export function useAdminSettings() {
  return useQuery({ queryKey: ['admin', 'settings'], queryFn: () => apiGet<AdminSettings>('/admin/settings') });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminSettingsInput) => apiPatch<AdminSettings>('/admin/settings', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      toast.success('Settings saved');
    },
    onError: fail('Could not save settings'),
  });
}

/* ── Users ─────────────────────────────────────────────────── */

export function useAdminUsers(params: { role?: string; status?: string; search?: string; page?: number } = {}) {
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: async () => {
      const { data, meta } = await apiList<AdminUserRow[]>('/admin/users', {
        query: { role: params.role, status: params.status, search: params.search, page: params.page, limit: 20 },
      });
      return { items: data, meta } as Paginated<AdminUserRow>;
    },
  });
}

export function useAdminUserDetail(id: string | null) {
  return useQuery({
    queryKey: ['admin', 'users', id],
    queryFn: () => apiGet<AdminUserDetail>(`/admin/users/${id}`),
    enabled: Boolean(id),
  });
}

export function useSetUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: UserStatus; reason?: string }) =>
      apiPost(`/admin/users/${id}/status`, { status, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('User status updated');
    },
    onError: fail('Could not update user'),
  });
}

/* ── Audit & fraud ─────────────────────────────────────────── */

export function useAuditLogs(params: { entityType?: string; page?: number } = {}) {
  return useQuery({
    queryKey: ['admin', 'audit', params],
    queryFn: async () => {
      const { data, meta } = await apiList<AuditLogRow[]>('/admin/audit', {
        query: { entityType: params.entityType, page: params.page, limit: 30 },
      });
      return { items: data, meta } as Paginated<AuditLogRow>;
    },
  });
}

export function useFraudAlerts(params: { status?: string; page?: number } = {}) {
  return useQuery({
    queryKey: ['admin', 'fraud', params],
    queryFn: async () => {
      const { data, meta } = await apiList<FraudAlertRow[]>('/admin/fraud', {
        query: { status: params.status, page: params.page, limit: 25 },
      });
      return { items: data, meta } as Paginated<FraudAlertRow>;
    },
  });
}

export function useReviewFraud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, actionTaken }: { id: string; status: FraudStatusValue; actionTaken?: string }) =>
      apiPost(`/admin/fraud/${id}/review`, { status, actionTaken }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'fraud'] });
      toast.success('Alert reviewed');
    },
    onError: fail('Could not review alert'),
  });
}

/* ── Seller approvals ──────────────────────────────────────── */

export function useSellerApplications(params: { status?: string; page?: number } = {}) {
  return useQuery({
    queryKey: ['admin', 'sellers', params],
    queryFn: async () => {
      const { data, meta } = await apiList<AdminSellerApplication[]>('/sellers/applications', {
        query: { status: params.status, page: params.page, limit: 20 },
      });
      return { items: data, meta } as Paginated<AdminSellerApplication>;
    },
  });
}

export function useReviewSeller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sellerId, decision, reason }: { sellerId: string; decision: 'approve' | 'reject'; reason?: string }) =>
      apiPost(`/sellers/${sellerId}/review`, { decision, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sellers'] });
      qc.invalidateQueries({ queryKey: ['admin', 'overview'] });
      toast.success('Application reviewed');
    },
    onError: fail('Could not review application'),
  });
}

/* ── Product moderation ────────────────────────────────────── */

export function usePendingProducts(params: { page?: number } = {}) {
  return useQuery({
    queryKey: ['admin', 'products', params],
    queryFn: async () => {
      const { data, meta } = await apiList<Product[]>('/products/pending-review', {
        query: { page: params.page, limit: 20 },
      });
      return { items: data, meta } as Paginated<Product>;
    },
  });
}

export function useModerateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: 'approve' | 'reject'; reason?: string }) =>
      apiPost(`/products/${id}/moderate`, { action, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      toast.success('Listing moderated');
    },
    onError: fail('Could not moderate listing'),
  });
}

/* ── Orders ────────────────────────────────────────────────── */

export function useAdminOrders(params: { status?: string; paymentStatus?: string; page?: number } = {}) {
  return useQuery({
    queryKey: ['admin', 'orders', params],
    queryFn: async () => {
      const { data, meta } = await apiList<Order[]>('/orders/admin', {
        query: { status: params.status, paymentStatus: params.paymentStatus, page: params.page, limit: 20 },
      });
      return { items: data, meta } as Paginated<Order>;
    },
  });
}

/* ── Finance ───────────────────────────────────────────────── */

export function useFinanceOverview() {
  return useQuery({ queryKey: ['finance', 'overview'], queryFn: () => apiGet<FinanceOverview>('/finance/overview') });
}

export function useRevenueSeries(days = 30) {
  return useQuery({
    queryKey: ['finance', 'revenue-series', days],
    queryFn: () => apiGet<RevenuePoint[]>('/finance/revenue-series', { query: { days } }),
  });
}

export function useTopSellers(limit = 10) {
  return useQuery({
    queryKey: ['finance', 'top-sellers', limit],
    queryFn: () => apiGet<import('@/types').TopSellerRow[]>('/finance/top-sellers', { query: { limit } }),
  });
}

export function usePaymentMethods() {
  return useQuery({ queryKey: ['finance', 'payment-methods'], queryFn: () => apiGet<PaymentMethodRow[]>('/finance/payment-methods') });
}

export function usePayoutQueue(params: { status?: string; page?: number } = {}) {
  return useQuery({
    queryKey: ['payments', 'payouts', params],
    queryFn: async () => {
      const { data, meta } = await apiList<PayoutQueueRow[]>('/payments/payouts', {
        query: { status: params.status, page: params.page, limit: 25 },
      });
      return { items: data, meta } as Paginated<PayoutQueueRow>;
    },
  });
}

export function useBreakdown() {
  return useQuery({
    queryKey: ['finance', 'payout-breakdown'],
    queryFn: async () => {
      const res = await apiList<PayoutQueueRow[]>('/finance/payouts', { query: { limit: 1 } });
      return ((res.meta as unknown as { breakdown?: PayoutBreakdownRow[] })?.breakdown ?? []) as PayoutBreakdownRow[];
    },
  });
}

export function useReviewPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: 'approve' | 'reject'; note?: string }) =>
      apiPost(`/payments/payouts/${id}/review`, { decision, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments', 'payouts'] });
      qc.invalidateQueries({ queryKey: ['finance', 'payout-breakdown'] });
      toast.success('Payout reviewed');
    },
    onError: fail('Could not review payout'),
  });
}

export function useProcessPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost(`/payments/payouts/${id}/process`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments', 'payouts'] });
      qc.invalidateQueries({ queryKey: ['finance', 'payout-breakdown'] });
      toast.success('Payout processed');
    },
    onError: fail('Could not process payout'),
  });
}

/* ── Support (staff) ───────────────────────────────────────── */

export function useStaffTickets(params: { status?: string; type?: string; priority?: string; q?: string; page?: number; mine?: boolean } = {}) {
  const path = params.mine ? '/support/staff/mine' : '/support/staff/all';
  return useQuery({
    queryKey: ['support', 'staff', params],
    queryFn: async () => {
      const { data, meta } = await apiList<TicketListRow[]>(path, {
        query: { status: params.status, type: params.type, priority: params.priority, q: params.q, page: params.page, limit: 20 },
      });
      return { items: data, meta } as Paginated<TicketListRow>;
    },
  });
}

export function useTicketStats() {
  return useQuery({ queryKey: ['support', 'stats'], queryFn: () => apiGet<TicketStats>('/support/staff/stats') });
}

export function useTicketDetail(id: string | null) {
  return useQuery({
    queryKey: ['support', 'ticket', id],
    queryFn: () => apiGet<TicketDetailRow>(`/support/${id}`),
    enabled: Boolean(id),
  });
}

const invalidateTicket = (qc: ReturnType<typeof useQueryClient>, id: string) => {
  qc.invalidateQueries({ queryKey: ['support', 'ticket', id] });
  qc.invalidateQueries({ queryKey: ['support', 'staff'] });
  qc.invalidateQueries({ queryKey: ['support', 'stats'] });
};

export function useReplyTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body, internal }: { id: string; body: string; internal?: boolean }) => {
      const fd = new FormData();
      fd.set('body', body);
      if (internal) fd.set('internal', 'true');
      return apiPost(`/support/${id}/messages`, fd);
    },
    onSuccess: (_r, v) => invalidateTicket(qc, v.id),
    onError: fail('Could not send reply'),
  });
}

export function useSetTicketStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, resolution }: { id: string; status: TicketListRow['status']; resolution?: string }) =>
      apiPost(`/support/${id}/status`, { status, resolution }),
    onSuccess: (_r, v) => {
      invalidateTicket(qc, v.id);
      toast.success('Status updated');
    },
    onError: fail('Could not update status'),
  });
}

export function useSetTicketPriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: string }) => apiPatch(`/support/${id}/priority`, { priority }),
    onSuccess: (_r, v) => invalidateTicket(qc, v.id),
    onError: fail('Could not update priority'),
  });
}

export function useAssignTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, agentId }: { id: string; agentId: string | null }) => apiPost(`/support/${id}/assign`, { agentId }),
    onSuccess: (_r, v) => invalidateTicket(qc, v.id),
    onError: fail('Could not assign ticket'),
  });
}

/** Convenience: the staff roles that may reach these screens. */
export const STAFF_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_MANAGER', 'SUPPORT_AGENT', 'FINANCE_MANAGER'];
