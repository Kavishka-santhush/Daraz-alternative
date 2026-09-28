'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet, apiList } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type {
  Category,
  MeUser,
  Paginated,
  Product,
  Voucher,
  FlashSale,
  Banner,
} from '@/types';

/** Current authenticated user (rich /auth/me). Null when guest. */
export function useMe(enabled = true) {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiGet<MeUser>('/auth/me'),
    enabled,
    retry: false,
  });
}

/** Top-level category tree for nav / browse. */
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categoryTree,
    queryFn: () => apiGet<Category[]>('/catalog/categories/tree'),
    staleTime: 5 * 60 * 1000,
  });
}

/** Paginated product listing (filters passed through as query params). */
export function useProducts(params: Record<string, string | number | boolean | undefined | null> = {}) {
  return useQuery({
    queryKey: queryKeys.products(params),
    queryFn: async () => {
      const { data, meta } = await apiList<Product[]>('/products', { query: params });
      return { items: data, meta } as Paginated<Product>;
    },
  });
}

/** Product detail by slug. */
export function useProduct(slug: string) {
  return useQuery({
    queryKey: queryKeys.product(slug),
    queryFn: () => apiGet<Product>(`/products/${slug}`),
    enabled: Boolean(slug),
  });
}

/** Claimable / listed vouchers. */
export function useVouchers() {
  return useQuery({ queryKey: queryKeys.vouchers, queryFn: () => apiGet<Voucher[]>('/vouchers') });
}

/** Active + upcoming flash sales. */
export function useFlashSales() {
  return useQuery({ queryKey: queryKeys.flashSales, queryFn: () => apiGet<FlashSale[]>('/flash-sales') });
}

/** Banners for a placement (home-hero, home-mid, category, …). */
export function useBanners(placement: string) {
  return useQuery({
    queryKey: queryKeys.banners(placement),
    queryFn: () => apiGet<Banner[]>(`/banners`, { query: { placement } }),
    staleTime: 5 * 60 * 1000,
  });
}
