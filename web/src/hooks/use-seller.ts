'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch, apiDelete, apiList, ApiClientError } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type {
  Paginated,
  Product,
  ReturnRequestRow,
  SellerDashboard,
  SellerEarnings,
  SellerMetrics,
  SellerShop,
  SellerSubOrderRow,
} from '@/types';

const fail = (msg: string) => (e: unknown) =>
  toast.error(msg, { description: e instanceof ApiClientError ? e.message : 'Please try again.' });

/* ── Dashboard / profile ───────────────────────────────────── */

export function useSellerDashboard(enabled = true) {
  return useQuery({
    queryKey: ['seller', 'me'],
    queryFn: () => apiGet<SellerDashboard>('/sellers/me'),
    enabled,
    retry: false,
  });
}

export function useSellerMetrics(enabled = true) {
  return useQuery({
    queryKey: queryKeys.sellerStats,
    queryFn: () => apiGet<SellerMetrics>('/sellers/me/metrics'),
    enabled,
  });
}

export function useSellerShops(enabled = true) {
  return useQuery({
    queryKey: ['seller', 'shops'],
    queryFn: () => apiGet<SellerShop[]>('/sellers/me/shops'),
    enabled,
  });
}

export function useCreateShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string }) => apiPost<SellerShop>('/sellers/me/shops', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seller', 'shops'] });
      toast.success('Shop created');
    },
    onError: fail('Could not create shop'),
  });
}

export function useUpdateShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shopId, body }: { shopId: string; body: Record<string, unknown> }) =>
      apiPatch<SellerShop>(`/sellers/me/shops/${shopId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seller', 'shops'] });
      toast.success('Shop updated');
    },
    onError: fail('Could not update shop'),
  });
}

/* ── Products ──────────────────────────────────────────────── */

export function useSellerProducts(params: { status?: string; q?: string; page?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.sellerProducts(params),
    queryFn: async () => {
      const { data, meta } = await apiList<Product[]>('/products/seller/list', {
        query: { status: params.status, q: params.q, page: params.page, limit: 20 },
      });
      return { items: data, meta } as Paginated<Product>;
    },
  });
}

/** Fetch a single product (by id) to seed the edit form. */
export function useSellerProduct(id: string | null) {
  return useQuery({
    queryKey: ['seller', 'products', id],
    queryFn: () => apiGet<Product>(`/products/${id}`),
    enabled: Boolean(id),
  });
}

export interface ProductInput {
  shopId: string;
  categoryId: string;
  brandId?: string;
  title: string;
  subtitle?: string;
  description: string;
  sku: string;
  condition?: 'NEW' | 'REFURBISHED' | 'USED';
  originalPrice: number;
  salePrice?: number;
  stockQuantity: number;
  shippingClass?: 'SMALL' | 'MEDIUM' | 'LARGE' | 'HEAVY' | 'FRAGILE';
  tags?: string[];
  submitForReview?: boolean;
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProductInput) => apiPost<Product>('/products', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seller', 'products'] });
      toast.success('Product created');
    },
    onError: fail('Could not create product'),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<ProductInput> }) =>
      apiPatch<Product>(`/products/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seller', 'products'] });
      toast.success('Product saved');
    },
    onError: fail('Could not save product'),
  });
}

export function useArchiveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<Product>(`/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seller', 'products'] });
      toast.success('Product archived');
    },
    onError: fail('Could not archive product'),
  });
}

export function useSetProductStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      apiPost(`/products/${id}/set-stock`, { quantity }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seller', 'products'] });
      toast.success('Stock updated');
    },
    onError: fail('Could not update stock'),
  });
}

/* ── Orders ────────────────────────────────────────────────── */

export function useSellerOrders(params: { status?: string; page?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.sellerOrders(params),
    queryFn: async () => {
      const { data, meta } = await apiList<SellerSubOrderRow[]>('/orders/seller', {
        query: { status: params.status, page: params.page, limit: 20 },
      });
      return { items: data, meta } as Paginated<SellerSubOrderRow>;
    },
  });
}

const invalidateOrders = (qc: ReturnType<typeof useQueryClient>) => () => {
  qc.invalidateQueries({ queryKey: ['seller', 'orders'] });
};

export function useConfirmSubOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subId, estimatedDispatchHours }: { subId: string; estimatedDispatchHours?: number }) =>
      apiPost<SellerSubOrderRow>(`/orders/seller/${subId}/confirm`, { estimatedDispatchHours }),
    onSuccess: invalidateOrders(qc),
    onError: fail('Could not confirm order'),
  });
}

export function useAdvanceSubOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subId, status, trackingNumber, courierName }: { subId: string; status: 'PROCESSING' | 'SHIPPED' | 'OUT_FOR_DELIVERY' | 'DELIVERED'; trackingNumber?: string; courierName?: string }) =>
      apiPost<SellerSubOrderRow>(`/orders/seller/${subId}/status`, { status, trackingNumber, courierName }),
    onSuccess: invalidateOrders(qc),
    onError: fail('Could not update status'),
  });
}

export function useAddTracking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subId, trackingNumber, courierName }: { subId: string; trackingNumber: string; courierName: string }) =>
      apiPost<SellerSubOrderRow>(`/orders/seller/${subId}/tracking`, { trackingNumber, courierName }),
    onSuccess: invalidateOrders(qc),
    onError: fail('Could not save tracking'),
  });
}

/* ── Returns ───────────────────────────────────────────────── */

export function useSellerReturns(page = 1) {
  return useQuery({
    queryKey: ['seller', 'returns', { page }],
    queryFn: async () => {
      const { data, meta } = await apiList<ReturnRequestRow[]>('/returns/seller', {
        query: { page, limit: 20 },
      });
      return { items: data, meta } as Paginated<ReturnRequestRow>;
    },
  });
}

export function useReturnDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: 'approve' | 'reject'; note?: string }) =>
      apiPost(`/returns/${id}/decision`, { decision, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seller', 'returns'] });
      toast.success('Decision recorded');
    },
    onError: fail('Could not record decision'),
  });
}

/* ── Earnings & payouts ────────────────────────────────────── */

export function useSellerEarnings(enabled = true) {
  return useQuery({
    queryKey: queryKeys.sellerEarnings(),
    queryFn: () => apiGet<SellerEarnings>('/payments/seller/earnings'),
    enabled,
  });
}

export function useRequestPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) => apiPost('/payments/seller/payout', { amount }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sellerEarnings() });
      toast.success('Payout requested');
    },
    onError: fail('Could not request payout'),
  });
}

export function useSaveBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { bankName: string; bankAccountNo: string; bankBranch?: string; accountHolder: string }) =>
      apiPost('/payments/seller/bank', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sellerEarnings() });
      toast.success('Bank details saved');
    },
    onError: fail('Could not save bank details'),
  });
}
