'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { Cart } from '@/types';

interface CartContextValue {
  cart?: Cart;
  isLoading: boolean;
  itemCount: number;
  subtotal: number;
  addItem: (input: { productId: string; variantId?: string; quantity?: number }) => void;
  updateItem: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  clear: () => void;
  isAdding: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

/** Global cart state backed by the server (auth-required). No-op for guests. */
export function CartProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const qc = useQueryClient();
  const authed = status === 'authenticated';

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.cart,
    queryFn: () => apiGet<Cart>('/cart'),
    enabled: authed,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.cart });

  const addMut = useMutation({
    mutationFn: (input: { productId: string; variantId?: string; quantity?: number }) =>
      apiPost<Cart>('/cart/items', input),
    onSuccess: (cart) => qc.setQueryData(queryKeys.cart, cart),
  });

  const patchMut = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      apiPatch<Cart>(`/cart/items/${id}`, { quantity }),
    onSuccess: (cart) => qc.setQueryData(queryKeys.cart, cart),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => apiDelete<Cart>(`/cart/items/${id}`),
    onSuccess: (cart) => qc.setQueryData(queryKeys.cart, cart),
  });

  const clearMut = useMutation({
    mutationFn: () => apiDelete('/cart'),
    onSuccess: () => invalidate(),
  });

  const value = useMemo<CartContextValue>(
    () => ({
      cart: data,
      isLoading: authed && isLoading,
      itemCount: data?.itemCount ?? 0,
      subtotal: data?.subtotal ?? 0,
      addItem: (input) => addMut.mutate(input),
      updateItem: (id, quantity) => patchMut.mutate({ id, quantity }),
      removeItem: (id) => removeMut.mutate(id),
      clear: () => clearMut.mutate(),
      isAdding: addMut.isPending,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, isLoading, authed, addMut.isPending],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
