'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch, apiDelete, apiList, ApiClientError } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type {
  Address,
  LoyaltySummary,
  NotificationItem,
  Order,
  Paginated,
  ReturnRequestRow,
  SupportTicket,
  UserProfile,
  WalletInfo,
  WishlistItem,
} from '@/types';

/* ── Profile / overview ────────────────────────────────────── */

/** GET /users/me — rich profile for the account overview + settings. */
export function useProfile(enabled = true) {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => apiGet<UserProfile>('/users/me'),
    enabled,
    retry: false,
  });
}

/** GET /loyalty/me — points / coins / redeem eligibility + recent ledger. */
export function useLoyalty(enabled = true) {
  return useQuery({
    queryKey: queryKeys.loyalty,
    queryFn: () => apiGet<LoyaltySummary>('/loyalty/me'),
    enabled,
  });
}

/* ── Orders / returns ──────────────────────────────────────── */

/** GET /orders/my — paginated buyer orders (optional status filter). */
export function useMyOrders(params: { status?: string; page?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.orders(params),
    queryFn: async () => {
      const { data, meta } = await apiList<Order[]>('/orders/my', {
        query: { status: params.status, page: params.page, limit: 10 },
      });
      return { items: data, meta } as Paginated<Order>;
    },
  });
}

/** GET /returns/my — buyer return requests. */
export function useMyReturns(page = 1) {
  return useQuery({
    queryKey: queryKeys.returns({ page }),
    queryFn: async () => {
      const { data, meta } = await apiList<ReturnRequestRow[]>('/returns/my', {
        query: { page, limit: 10 },
      });
      return { items: data, meta } as Paginated<ReturnRequestRow>;
    },
  });
}

/* ── Wallet ────────────────────────────────────────────────── */

/** GET /payments/wallet — balance + recent wallet transactions. */
export function useWallet(enabled = true) {
  return useQuery({
    queryKey: queryKeys.wallet,
    queryFn: () => apiGet<WalletInfo>('/payments/wallet'),
    enabled,
  });
}

/** POST /payments/wallet/topup — start a card top-up intent. */
export function useWalletTopup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) =>
      apiPost<{ clientSecret: string; paymentId: string }>('/payments/wallet/topup', { amount }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.wallet });
    },
    onError: (e) =>
      toast.error('Could not start top-up', {
        description: e instanceof ApiClientError ? e.message : 'Please try again.',
      }),
  });
}

/* ── Wishlist ──────────────────────────────────────────────── */

/** GET /wishlist — saved products with price-drop signals. */
export function useWishlist(page = 1) {
  return useQuery({
    queryKey: queryKeys.wishlist,
    queryFn: async () => {
      const { data, meta } = await apiList<WishlistItem[]>('/wishlist', { query: { page, limit: 24 } });
      return { items: data, meta } as Paginated<WishlistItem>;
    },
  });
}

/** POST /wishlist/toggle — add/remove a product; keeps list cache fresh. */
export function useToggleWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) =>
      apiPost<{ wishlisted: boolean }>('/wishlist/toggle', { productId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.wishlist }),
  });
}

/* ── Addresses ─────────────────────────────────────────────── */

/** GET /users/me/addresses — saved shipping addresses. */
export function useAddresses(enabled = true) {
  return useQuery({
    queryKey: queryKeys.addresses,
    queryFn: () => apiGet<Address[]>('/users/me/addresses'),
    enabled,
  });
}

export type AddressInput = Omit<Address, 'id' | 'isDefault'> & { isDefault?: boolean };

/** Address CRUD for the settings page. All invalidate the addresses cache. */
export function useAddressMutations() {
  const qc = useQueryClient();
  const done = (msg: string) => () => {
    qc.invalidateQueries({ queryKey: queryKeys.addresses });
    toast.success(msg);
  };
  const fail = (msg: string) => (e: unknown) =>
    toast.error(msg, { description: e instanceof ApiClientError ? e.message : 'Please try again.' });

  const create = useMutation({
    mutationFn: (body: AddressInput) => apiPost<Address>('/users/me/addresses', body),
    onSuccess: done('Address added'),
    onError: fail('Could not add address'),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<AddressInput> }) =>
      apiPatch<Address>(`/users/me/addresses/${id}`, body),
    onSuccess: done('Address updated'),
    onError: fail('Could not update address'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/users/me/addresses/${id}`),
    onSuccess: done('Address removed'),
    onError: fail('Could not remove address'),
  });
  const setDefault = useMutation({
    mutationFn: (id: string) => apiPost<Address[]>(`/users/me/addresses/${id}/default`),
    onSuccess: done('Default address updated'),
    onError: fail('Could not set default'),
  });
  return { create, update, remove, setDefault };
}

/* ── Notifications ─────────────────────────────────────────── */

/** GET /notifications — inbox feed (paginated). */
export function useNotifications(page = 1) {
  return useQuery({
    queryKey: queryKeys.notifications({ page }),
    queryFn: async () => {
      const { data, meta } = await apiList<NotificationItem[]>('/notifications', {
        query: { page, limit: 20 },
      });
      return { items: data, meta } as Paginated<NotificationItem>;
    },
  });
}

/** Unread badge count for the account nav. */
export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => apiGet<{ count: number }>('/notifications/unread-count'),
    enabled,
  });
}

/** Mark one / all notifications read; refreshes inbox + badge. */
export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };
  const one = useMutation({
    mutationFn: (id: string) => apiPatch<NotificationItem>(`/notifications/${id}/read`),
    onSuccess: refresh,
  });
  const all = useMutation({
    mutationFn: () => apiPost('/notifications/read-all'),
    onSuccess: refresh,
  });
  return { one, all };
}

/** Remove a single notification. */
export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

/* ── Profile settings ──────────────────────────────────────── */

/** PATCH /users/me — update name / phone / avatar. */
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; phone?: string; avatarUrl?: string }) =>
      apiPatch<UserProfile>('/users/me', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profile updated');
    },
    onError: (e) =>
      toast.error('Could not save changes', {
        description: e instanceof ApiClientError ? e.message : 'Please try again.',
      }),
  });
}

/* ── Support tickets ───────────────────────────────────────── */

/** GET /support/mine — the buyer's own tickets. */
export function useMyTickets(page = 1) {
  return useQuery({
    queryKey: queryKeys.tickets({ page }),
    queryFn: async () => {
      const { data, meta } = await apiList<SupportTicket[]>('/support/mine', {
        query: { page, limit: 10 },
      });
      return { items: data, meta } as Paginated<SupportTicket>;
    },
  });
}

export interface CreateTicketInput {
  type: 'ORDER' | 'RETURN' | 'REFUND' | 'PRODUCT' | 'PAYMENT' | 'ACCOUNT' | 'OTHER';
  subject: string;
  description: string;
  orderId?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

/** POST /support — open a new help ticket. */
export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTicketInput) => apiPost<SupportTicket>('/support', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support'] });
      toast.success('Ticket submitted — our team will reply soon.');
    },
    onError: (e) =>
      toast.error('Could not submit ticket', {
        description: e instanceof ApiClientError ? e.message : 'Please try again.',
      }),
  });
}
