/**
 * Domain types mirroring the REST API's serialised Prisma models.
 * Decimal columns arrive as strings; Date columns as ISO strings.
 */

export type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'OPERATIONS_MANAGER'
  | 'SUPPORT_AGENT'
  | 'FINANCE_MANAGER'
  | 'SELLER'
  | 'BUYER';

export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DELETED';
export type SellerStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type SellerTier = 'NEW' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
export type ProductStatus = 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED' | 'ARCHIVED' | 'OUT_OF_STOCK';
export type OrderStatus =
  | 'PLACED' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'OUT_FOR_DELIVERY'
  | 'DELIVERED' | 'CANCELLED' | 'RETURN_REQUESTED' | 'RETURNED' | 'REFUNDED';
export type PaymentMethod = 'CARD' | 'WALLET' | 'COD' | 'INSTALLMENTS';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'CANCELLED';
export type ReturnStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'ITEM_RETURNED' | 'REFUND_INITIATED' | 'REFUND_COMPLETED' | 'CANCELLED';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type PayoutStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'PROCESSED';

/** Standard success envelope: { success, data, meta? }. */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: PageMeta;
}

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  pages?: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: Role;
  status: UserStatus;
  avatarUrl?: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  referralCode: string;
}

export interface MeUser extends PublicUser {
  loyaltyPoints: number;
  coins: number;
  sellerProfile?: { id: string; status: SellerStatus; tier: SellerTier; isVerified: boolean } | null;
}

/** Rich profile returned by GET /users/me (users.service.getProfile). */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: Role;
  status: UserStatus;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
  referralCode: string;
  loyaltyPoints: number;
  coins: number;
  createdAt: string;
  wallet?: { balance: string; currency: string } | null;
  sellerProfile?: { id: string; status: SellerStatus; shop?: { id: string; name: string; slug: string } | null } | null;
  _count: { addresses: number; orders: number; wishlists: number; reviews: number };
  walletBalance: number;
  walletCurrency: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResult {
  user: PublicUser;
  tokens: AuthTokens;
}

export interface Category {
  id: string;
  parentId?: string | null;
  name: string;
  slug: string;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  description?: string | null;
  level: number;
  path: string;
  commissionPercent?: string;
  isFeatured?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  children?: Category[];
  _count?: { products?: number };
}

export interface AttributeValue {
  id: string;
  value: string;
  attributeId?: string;
}

export interface Attribute {
  id: string;
  name: string;
  slug: string;
  type: string;
  isRequired?: boolean;
  categoryId?: string;
  values?: AttributeValue[];
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  categoryId?: string | null;
  isFeatured?: boolean;
}

export interface ProductImage {
  id: string;
  url: string;
  altText?: string | null;
  position: number;
  isPrimary: boolean;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  optionLabel?: string | null;
  price: string;
  compareAtPrice?: string | null;
  stockQuantity: number;
  isActive: boolean;
}

export interface ShopSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  sellerId?: string;
}

/** Row returned by GET /sellers/shops (public shops directory). */
export interface ShopCard extends ShopSummary {
  description?: string | null;
  coverUrl?: string | null;
  defaultDeliveryDays?: number;
  createdAt: string;
  seller: { tier: SellerTier; isVerified: boolean; rating: string | number; totalOrders: number };
  _count: { products: number; followers: number };
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  subtitle?: string | null;
  description: string;
  sku: string;
  condition?: string;
  status: ProductStatus;
  originalPrice: string;
  salePrice?: string | null;
  discountPercent?: string;
  stockQuantity: number;
  soldCount?: number;
  viewCount?: number;
  ratingAverage: string;
  ratingCount: number;
  videoUrl?: string | null;
  isFeatured?: boolean;
  tags?: string[];
  attributes?: Record<string, unknown> | null;
  images?: ProductImage[];
  variants?: ProductVariant[];
  shop?: ShopSummary;
  category?: Pick<Category, 'id' | 'name' | 'slug'>;
  brand?: Pick<Brand, 'id' | 'name' | 'slug'> | null;
  createdAt?: string;
}

export interface ProductDetail extends Product {
  qa?: ProductQa[];
  related?: Product[];
  reviews?: Review[];
}

export interface ProductQa {
  id: string;
  question: string;
  answer?: string | null;
  createdAt: string;
  askedBy?: { name: string };
  answeredBy?: { name: string } | null;
}

export interface Review {
  id: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  isVerified: boolean;
  createdAt: string;
  buyer: { id: string; name: string; avatarUrl?: string | null };
  media?: { id: string; url: string }[];
  helpfulCount?: number;
}

/** A single line inside a cart group (matches server hydrateCart output). */
export interface CartLineItem {
  id: string;
  productId: string;
  variantId?: string | null;
  title: string;
  image?: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  stock: number;
  returnWindowDays: number;
}

/** Cart items grouped per seller shop (cross-seller cart). */
export interface CartGroup {
  shop: ShopSummary;
  items: CartLineItem[];
  subtotal: number;
}

export interface Cart {
  cartId: string;
  groups: CartGroup[];
  itemCount: number;
  subtotal: number;
}

export interface Address {
  id: string;
  label?: string | null;
  contactName: string;
  contactPhone: string;
  line1: string;
  line2?: string | null;
  city: string;
  district?: string | null;
  province?: string | null;
  postalCode?: string | null;
  isDefault: boolean;
}

/** POST /orders/checkout → { order, payment } (order.service.checkout). */
export interface CheckoutResult {
  order: Order;
  payment:
    | { method: PaymentMethod; paymentId: string; status: PaymentStatus | 'SUCCEEDED' | 'PENDING'; clientSecret?: string };
}

/** GET /payments/wallet — prisma wallet row + recent transactions; when the
 * user has no wallet row the server returns { balance: 0, currency, transactions: [] }. */
export interface WalletInfo {
  id?: string;
  balance: string | number;
  currency: string;
  isFrozen?: boolean;
  transactions?: Array<Record<string, unknown>>;
}

export interface OrderItem {
  id: string;
  titleSnapshot: string;
  imageSnapshot?: string | null;
  unitPrice: string;
  quantity: number;
  totalPrice: string;
  productId: string;
  variantId?: string | null;
}

export interface SubOrder {
  id: string;
  subOrderNumber: string;
  status: OrderStatus;
  subtotal: string;
  shippingFee: string;
  commissionAmount?: string;
  sellerEarning?: string;
  trackingNumber?: string | null;
  courierName?: string | null;
  shop?: ShopSummary;
  items?: OrderItem[];
  events?: OrderEvent[];
}

export interface OrderEvent {
  id: string;
  title: string;
  description?: string | null;
  status?: OrderStatus | null;
  actorType?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  subtotal: string;
  shippingTotal: string;
  discountTotal: string;
  taxTotal: string;
  totalAmount: string;
  paidAmount?: string;
  loyaltyPointsEarned?: number;
  createdAt: string;
  addressSnapshot?: Record<string, unknown>;
  /** Populated on GET /orders/admin (staff view). */
  buyer?: { name?: string; email?: string } | null;
  subOrders?: SubOrder[];
  events?: OrderEvent[];
}

export interface Voucher {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  scope: 'PLATFORM' | 'SELLER';
  type: 'PERCENT' | 'FIXED' | 'FREE_SHIPPING';
  percentOff?: string | null;
  fixedOff?: string | null;
  maxDiscount?: string | null;
  minOrderAmount?: string | null;
  status: string;
  startsAt: string;
  expiresAt: string;
}

/** Shape returned by GET /flash-sales + /flash-sales/:slug (promo.service
 * listFlashSales/getFlashSaleBySlug) — items are flattened product cards. */
export interface FlashSaleItemProduct {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  image: string | null;
  originalPrice: number;
  ratingAverage: number;
  ratingCount: number;
  shop?: unknown;
}

export interface FlashSaleItem extends FlashSaleItemProduct {
  itemId: string;
  flashPrice: number;
  /** Present on list items; the by-slug endpoint omits it. */
  discountPercent?: number;
  stockLimit: number;
  soldCount: number;
  remaining: number;
}

export interface FlashSale {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  bannerUrl?: string | null;
  startsAt: string;
  endsAt: string;
  /** Computed server-side from the sale window vs. now. */
  status: 'LIVE' | 'UPCOMING' | 'ENDED';
  /** List endpoint only (detail returns full `items` instead). */
  itemCount?: number;
  items?: FlashSaleItem[];
}

export interface Banner {
  id: string;
  title: string;
  placement: string;
  imageUrl: string;
  mobileImageUrl?: string | null;
  targetUrl?: string | null;
  altText?: string | null;
  sortOrder: number;
}

/** Row returned by GET /wishlist (wishlist.service.listWishlist). Prices are
 * flattened numbers here (server runs effectivePrice / Number()). */
export interface WishlistItem {
  id: string;
  addedAt: string;
  priceAtAdd: number;
  currentPrice: number;
  inStock: boolean;
  priceDropped: boolean;
  product: Product;
}

/** GET /loyalty/me (loyalty.service.getLoyaltySummary). */
export interface LoyaltyLedgerRow {
  id: string;
  points: number;
  type: string;
  reason: string;
  referenceType?: string | null;
  referenceId?: string | null;
  balanceAfter: number;
  createdAt: string;
}

export interface LoyaltySummary {
  points: number;
  coins: number;
  pointsValue: number;
  currencyValue: number;
  redeemMinPoints: number;
  maxRedeemPercent: number;
  canRedeem: boolean;
  recent: LoyaltyLedgerRow[];
}

/** GET /returns/my — prisma.returnRequest + items + subOrder.shop.name. */
export interface ReturnRequestRow {
  id: string;
  returnNumber: string;
  subOrderId: string;
  reason: string;
  description?: string | null;
  status: ReturnStatus;
  requestedRefund: string;
  approvedRefund?: string | null;
  isPartial: boolean;
  refundMethod?: string | null;
  createdAt: string;
  items?: Array<{ id: string; orderItemId: string; productId: string; quantity: number; reason?: string | null }>;
  subOrder?: { id: string; subOrderNumber: string; shop?: { name: string } | null };
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  actionUrl?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface WalletTx {
  id: string;
  type: 'CREDIT' | 'DEBIT';
  purpose: string;
  amount: string;
  balanceAfter: string;
  description?: string | null;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  type: string;
  status: TicketStatus;
  priority: string;
  createdAt: string;
  messages?: Array<{ id: string; body: string; isInternal: boolean; createdAt: string; author?: { name: string } }>;
}

export interface SearchProduct {
  items: Product[];
  meta: PageMeta;
}

export interface SearchFacets {
  categories: Array<{ id: string; name: string; slug: string; count: number }>;
  brands: Array<{ id: string; name: string; slug: string; count: number }>;
  conditions: Array<{ condition: string | null; count: number }>;
  price: { min: number; max: number };
}

export interface PlatformSettings {
  id: string;
  platformName: string;
  currency: string;
  currencySymbol: string;
  logoUrl?: string | null;
  codEnabled: boolean;
  installmentsEnabled: boolean;
  freeShippingThreshold?: string;
  flatShippingFee?: string;
  maintenanceMode?: boolean;
  supportEmail?: string;
}

/* ── Seller dashboard ──────────────────────────────────────── */

export interface PayoutBank {
  bankName: string;
  bankAccountNo: string;
  bankBranch?: string;
  accountHolder: string;
}

export interface BusinessDoc {
  id: string;
  type: string;
  fileName: string;
  url: string;
  number?: string | null;
  expiryDate?: string | null;
  status: string;
  reviewNote?: string | null;
  createdAt: string;
}

export interface SellerProfileRow {
  id: string;
  userId: string;
  status: SellerStatus;
  tier: SellerTier;
  isVerified: boolean;
  rating: string | number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  rejectionReason?: string | null;
  approvedAt?: string | null;
  payoutBank?: PayoutBank | null;
}

/** GET /sellers/me — { seller (with shops+documents), stats }. */
export interface SellerDashboard {
  seller: SellerProfileRow & {
    shops: Array<SellerShop>;
    documents: BusinessDoc[];
  };
  stats: {
    todayOrders: number;
    pendingOrders: number;
    productsCount: number;
    availableBalance: string | number;
    pending: string | number;
    lifetimeNet: string | number;
  };
}

/** GET /sellers/me/metrics (seller.service.sellerMetrics). */
export interface SellerMetrics {
  totalOrders: number;
  completed: number;
  cancelled: number;
  disputes: number;
  avgRating: string | number;
  reviewCount: number;
  completionRate: number;
  rating: number;
  tier: SellerTier;
  isVerified: boolean;
}

/** Full shop row returned by GET /sellers/me/shops. */
export interface SellerShop {
  id: string;
  sellerId: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  policyReturn?: string | null;
  policyShipping?: string | null;
  policyWarranty?: string | null;
  shippingOrigin?: string | null;
  defaultDeliveryDays: number;
  isActive: boolean;
  createdAt: string;
  _count?: { products: number };
}

/** GET /orders/seller row (order.fulfillment.listSellerOrders). */
export interface SellerSubOrderRow {
  id: string;
  subOrderNumber: string;
  shopId: string;
  status: OrderStatus;
  subtotal: string;
  shippingFee: string;
  discountAmount: string;
  commissionPercent: string;
  commissionAmount: string;
  sellerEarning: string;
  trackingNumber?: string | null;
  courierName?: string | null;
  createdAt: string;
  shop?: { name: string; slug?: string };
  items?: OrderItem[];
  order?: { orderNumber: string; buyer?: { name: string } | null; addressSnapshot?: Record<string, unknown> };
}

export interface PayoutRequestRow {
  id: string;
  payoutNumber: string;
  sellerId: string;
  amount: string;
  currency: string;
  bankName: string;
  bankAccountNo: string;
  bankBranch?: string | null;
  accountHolder: string;
  status: PayoutStatus;
  rejectionReason?: string | null;
  processedAt?: string | null;
  createdAt: string;
}

/** GET /payments/seller/earnings (payout.service.getEarnings). */
export interface SellerEarnings {
  summary: {
    grossRevenue?: string | number;
    commissionPaid?: string | number;
    netEarnings?: string | number;
    available?: string | number;
    pending?: string | number;
    withdrawn?: string | number;
  };
  payouts: PayoutRequestRow[];
  bank?: PayoutBank | null;
}

/* ── Admin / staff dashboards ──────────────────────────────── */

/** GET /admin/overview (admin.service.platformOverview). */
export interface AdminOverview {
  users: number;
  sellers: number;
  pendingSellerApprovals: number;
  products: { total: number; active: number };
  orders: { total: number; today: number };
  gmv: { all: number; thisMonth: number };
  commissionRevenue: { all: number; thisMonth: number };
  openTickets: number;
  pendingReturns: number;
  flaggedFraudAlerts: number;
}

/** GET /admin/users row (admin.service.listUsers select). */
export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  status: UserStatus;
  loyaltyPoints: number;
  createdAt: string;
  lastLoginAt?: string | null;
  _count: { orders: number };
}

/** GET /admin/users/:id (admin.service.getUserDetail). */
export interface AdminUserDetail extends Omit<AdminUserRow, '_count'> {
  avatarUrl?: string | null;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
  coins: number;
  referralCode: string;
  wallet?: { balance: string } | null;
  sellerProfile?: { id: string; status: SellerStatus; tier: SellerTier; shop?: { id: string; name: string; slug: string } | null } | null;
  loginHistory?: Array<{ id: string; ip?: string | null; userAgent?: string | null; deviceId?: string | null; success: boolean; method?: string | null; createdAt: string }>;
  _count: { orders: number; reviews: number; tickets: number; loginHistory: number };
}

/** GET /admin/audit row (admin.service.listAuditLogs). */
export interface AuditLogRow {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
  actor?: { id: string; name: string; role: Role } | null;
}

export type FraudStatusValue = 'FLAGGED' | 'REVIEWING' | 'CLEARED' | 'ACTION_TAKEN';

/** GET /admin/fraud row (admin.service.listFraudAlerts; score is Number()). */
export interface FraudAlertRow {
  id: string;
  subjectType: string;
  subjectId: string;
  signal: string;
  score: number;
  details?: Record<string, unknown> | null;
  status: FraudStatusValue;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  actionTaken?: string | null;
  createdAt: string;
}

/** GET /sellers/applications row (seller.service.listSellerApplications). */
export interface AdminSellerApplication {
  id: string;
  userId: string;
  status: SellerStatus;
  tier: SellerTier;
  isVerified: boolean;
  rating: string | number;
  totalOrders: number;
  rejectionReason?: string | null;
  createdAt: string;
  user: { name: string; email: string; phone?: string | null; createdAt: string };
  documents: BusinessDoc[];
  shops: Array<{ id: string; name: string; slug: string }>;
}

/** Full platform settings row (admin.service.getSettings). Decimals are strings. */
export interface AdminSettings {
  id: string;
  platformName: string;
  platformLogoUrl?: string | null;
  currency: string;
  currencySymbol: string;
  locale: string;
  defaultCommissionPercent: string;
  returnWindowDays: number;
  codEnabled: boolean;
  codMaxAmount?: string | null;
  installmentsEnabled: boolean;
  minPayoutAmount: string;
  freeShippingThreshold: string;
  flatShippingFee: string;
  taxPercent: string;
  aiEnabled: boolean;
  maintenanceMode: boolean;
  supportEmail: string;
  updatedAt: string;
}

/** PATCH /admin/settings payload. Decimal columns are sent as numbers (server coerces them). */
export type AdminSettingsInput = Omit<
  Partial<AdminSettings>,
  'defaultCommissionPercent' | 'codMaxAmount' | 'minPayoutAmount' | 'freeShippingThreshold' | 'flatShippingFee' | 'taxPercent'
> & {
  defaultCommissionPercent?: number;
  codMaxAmount?: number;
  minPayoutAmount?: number;
  freeShippingThreshold?: number;
  flatShippingFee?: number;
  taxPercent?: number;
};

/* ── Finance ───────────────────────────────────────────────── */

/** GET /finance/overview (finance.service.financeOverview). */
export interface FinanceOverview {
  gmv: { all: number; thisMonth: number };
  commissionRevenue: { all: number; thisMonth: number };
  effectiveTakeRate: number;
  refundsTotal: number;
  paidOrders: number;
  payoutLiability: number;
  payoutsProcessed: number;
  walletFloat: number;
  sellerEscrowPending: number;
}

export interface RevenuePoint {
  date: string;
  gmv: number;
  commission: number;
  orders: number;
}

export interface TopSellerRow {
  sellerId: string;
  shopName: string | null;
  email: string | null;
  grossRevenue: number;
  commissionPaid: number;
  netEarnings: number;
}

export interface PaymentMethodRow {
  method: PaymentMethod;
  orders: number;
  amount: number;
}

/** Payout request enriched with its seller (finance + payments queues). */
export interface PayoutQueueRow extends PayoutRequestRow {
  seller?: { id: string; shop?: { name: string } | null; user?: { name?: string; email?: string } | null } | null;
}

export interface PayoutBreakdownRow {
  status: PayoutStatus;
  count: number;
  amount: number;
}

/* ── Support (staff queues) ────────────────────────────────── */

/** GET /support/staff/all row (ticket.service.listTickets include). */
export interface TicketListRow {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  type: string;
  status: TicketStatus;
  priority: string;
  createdAt: string;
  updatedAt: string;
  assignedToId?: string | null;
  creator: { id: string; name: string; email: string; role: Role };
  assignedTo?: { id: string; name: string } | null;
  messages?: Array<{ createdAt: string; body: string; authorId: string; isInternal: boolean }>;
}

/** GET /support/:id (ticket.service.getTicket, staff view). */
export interface TicketDetailRow {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  type: string;
  status: TicketStatus;
  priority: string;
  resolution?: string | null;
  createdAt: string;
  updatedAt: string;
  assignedToId?: string | null;
  creator: { id: string; name: string; email: string; role: Role };
  assignedTo?: { id: string; name: string } | null;
  messages: Array<{
    id: string;
    body: string;
    isInternal: boolean;
    createdAt: string;
    author?: { id: string; name: string; role: Role } | null;
    attachments?: string[];
  }>;
}

/** GET /support/staff/stats (ticket.service.ticketStats). */
export interface TicketStats {
  open: number;
  inProgress: number;
  resolvedToday: number;
  unassigned: number;
  byPriority: Record<string, number>;
}
