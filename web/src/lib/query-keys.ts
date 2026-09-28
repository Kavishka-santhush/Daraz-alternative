/** Centralised React Query key factory. Keeps cache invalidation consistent
 *  across hooks, pages and mutations. */

export const queryKeys = {
  // auth / session
  me: ['me'] as const,

  // catalog
  categories: ['categories'] as const,
  categoryTree: ['categories', 'tree'] as const,
  brands: (params?: Record<string, unknown>) => ['brands', params] as const,

  // products / search
  products: (params?: Record<string, unknown>) => ['products', params] as const,
  product: (slug: string) => ['product', slug] as const,
  search: (params?: Record<string, unknown>) => ['search', params] as const,
  related: (id: string) => ['products', 'related', id] as const,
  trending: ['products', 'trending'] as const,
  recommendations: ['products', 'recommendations'] as const,
  productReviews: (id: string) => ['product', id, 'reviews'] as const,
  productQa: (id: string) => ['product', id, 'qa'] as const,

  // cart
  cart: ['cart'] as const,

  // orders / returns
  orders: (params?: Record<string, unknown>) => ['orders', params] as const,
  order: (id: string) => ['order', id] as const,
  returns: (params?: Record<string, unknown>) => ['returns', params] as const,

  // account
  addresses: ['addresses'] as const,
  wallet: ['wallet'] as const,
  walletTransactions: (params?: Record<string, unknown>) => ['wallet', 'transactions', params] as const,
  wishlist: ['wishlist'] as const,
  notifications: (params?: Record<string, unknown>) => ['notifications', params] as const,
  loyalty: ['loyalty'] as const,

  // promos
  flashSales: ['flash-sales'] as const,
  activeFlashSale: ['flash-sales', 'active'] as const,
  banners: (placement: string) => ['banners', placement] as const,
  vouchers: ['vouchers'] as const,

  // shops
  shop: (slug: string) => ['shop', slug] as const,

  // seller dashboard
  sellerStats: ['seller', 'stats'] as const,
  sellerProducts: (params?: Record<string, unknown>) => ['seller', 'products', params] as const,
  sellerOrders: (params?: Record<string, unknown>) => ['seller', 'orders', params] as const,
  sellerEarnings: (params?: Record<string, unknown>) => ['seller', 'earnings', params] as const,

  // admin dashboard
  adminStats: ['admin', 'stats'] as const,
  adminSellers: (params?: Record<string, unknown>) => ['admin', 'sellers', params] as const,
  adminProducts: (params?: Record<string, unknown>) => ['admin', 'products', params] as const,
  adminOrders: (params?: Record<string, unknown>) => ['admin', 'orders', params] as const,
  adminUsers: (params?: Record<string, unknown>) => ['admin', 'users', params] as const,

  // finance
  financeStats: ['finance', 'stats'] as const,
  payouts: (params?: Record<string, unknown>) => ['finance', 'payouts', params] as const,

  // support
  tickets: (params?: Record<string, unknown>) => ['support', 'tickets', params] as const,
} as const;
