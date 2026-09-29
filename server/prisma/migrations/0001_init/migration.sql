-- Marketplace schema init (PostgreSQL). Hand-authored baseline mirroring prisma/schema.prisma.
-- Extensions (pg_trgm) are added in migration 0002.

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'OPERATIONS_MANAGER', 'SUPPORT_AGENT', 'FINANCE_MANAGER', 'SELLER', 'BUYER');
CREATE TYPE "UserStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED');
CREATE TYPE "SellerStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE "SellerTier" AS ENUM ('NEW', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM');
CREATE TYPE "DocumentType" AS ENUM ('BUSINESS_REGISTRATION', 'NIC_FRONT', 'NIC_BACK', 'PASSPORT', 'TAX_REGISTERATION', 'BANK_STATEMENT', 'SHOP_LOGO', 'SHOP_COVER', 'AVATAR', 'PRODUCT_IMAGE', 'RETURN_PROOF', 'OTHER');
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'ARCHIVED', 'OUT_OF_STOCK');
CREATE TYPE "ProductCondition" AS ENUM ('NEW', 'REFURBISHED', 'USED');
CREATE TYPE "ShippingClass" AS ENUM ('SMALL', 'MEDIUM', 'LARGE', 'HEAVY', 'FRAGILE');
CREATE TYPE "OrderStatus" AS ENUM ('PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED');
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'WALLET', 'COD', 'INSTALLMENTS');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED');
CREATE TYPE "PaymentPurpose" AS ENUM ('ORDER', 'WALLET_TOPUP', 'SPONSORED_LISTING', 'SHIPPING');
CREATE TYPE "InstallmentPlanType" AS ENUM ('MONTH_3', 'MONTH_6', 'MONTH_12');
CREATE TYPE "InstallmentStatus" AS ENUM ('DUE', 'PAID', 'OVERDUE', 'UPFRONT');
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'ITEM_RETURNED', 'REFUND_INITIATED', 'REFUND_COMPLETED', 'CANCELLED');
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED');
CREATE TYPE "VoucherType" AS ENUM ('PERCENT', 'FIXED', 'FREE_SHIPPING');
CREATE TYPE "VoucherScope" AS ENUM ('PLATFORM', 'SELLER');
CREATE TYPE "VoucherStatus" AS ENUM ('ACTIVE', 'SCHEDULED', 'EXPIRED', 'DEACTIVATED');
CREATE TYPE "RewardType" AS ENUM ('POINTS', 'COINS', 'CASHBACK');
CREATE TYPE "TransactionType" AS ENUM ('CREDIT', 'DEBIT');
CREATE TYPE "WalletTxPurpose" AS ENUM ('TOPUP', 'ORDER_PAYMENT', 'ORDER_REFUND', 'PAYOUT', 'ADJUSTMENT', 'CASHBACK', 'LOYALTY_REDEEM');
CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'PROCESSED');
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH');
CREATE TYPE "NotificationAudience" AS ENUM ('BUYER', 'SELLER', 'ADMIN', 'ALL');
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "TicketType" AS ENUM ('ORDER', 'RETURN', 'REFUND', 'PRODUCT', 'PAYMENT', 'ACCOUNT', 'OTHER');
CREATE TYPE "StockChangeType" AS ENUM ('SALE', 'CANCELLATION', 'RESTOCK', 'RESERVATION', 'ADJUSTMENT', 'RETURN', 'BULK_UPDATE');
CREATE TYPE "SponsoredPaymentStatus" AS ENUM ('UNPAID', 'PAID', 'REFUNDED', 'EXPIRED');
CREATE TYPE "FraudSubject" AS ENUM ('ORDER', 'SELLER', 'BUYER', 'REVIEW', 'TRANSACTION');
CREATE TYPE "FraudStatus" AS ENUM ('FLAGGED', 'REVIEWING', 'CLEARED', 'ACTION_TAKEN');
CREATE TYPE "ReferenceEntityType" AS ENUM ('ORDER', 'SUB_ORDER', 'PRODUCT', 'RETURN', 'PAYOUT', 'VOUCHER', 'USER', 'SHOP', 'SELLER', 'TICKET', 'SYSTEM');
CREATE TYPE "AuditEntityType" AS ENUM ('USER', 'SELLER', 'SHOP', 'PRODUCT', 'CATEGORY', 'BRAND', 'ORDER', 'SUB_ORDER', 'RETURN', 'PAYMENT', 'VOUCHER', 'FLASH_SALE', 'BANNER', 'PAYOUT', 'TICKET', 'SETTINGS', 'REVIEW', 'SPONSORED_LISTING');
CREATE TYPE "AnnouncementPlacement" AS ENUM ('SITE_WIDE_BANNER', 'NOTIFICATION', 'HOMEPAGE_MODAL');
CREATE TYPE "AttributeType" AS ENUM ('TEXT', 'SELECT', 'NUMBER', 'BOOLEAN', 'RANGE');

-- CreateTable: AUTH & USERS
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "passwordHash" TEXT,
  "name" TEXT NOT NULL,
  "avatarUrl" TEXT,
  "role" "UserRole" NOT NULL DEFAULT 'BUYER',
  "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "emailVerifiedAt" TIMESTAMP(3),
  "phoneVerifiedAt" TIMESTAMP(3),
  "referralCode" TEXT NOT NULL,
  "referredById" TEXT,
  "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
  "coins" INTEGER NOT NULL DEFAULT 0,
  "deviceInfo" JSONB,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefreshToken" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "replacedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasswordResetToken" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OtpCode" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'PHONE_VERIFICATION',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoginActivity" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "ip" TEXT,
  "userAgent" TEXT,
  "deviceId" TEXT,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "method" TEXT NOT NULL DEFAULT 'PASSWORD',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoginActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Address" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "label" TEXT,
  "contactName" TEXT NOT NULL,
  "contactPhone" TEXT NOT NULL,
  "line1" TEXT NOT NULL,
  "line2" TEXT,
  "city" TEXT NOT NULL,
  "district" TEXT,
  "province" TEXT,
  "postalCode" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SELLERS & SHOPS
CREATE TABLE "SellerProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "SellerStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  "tier" "SellerTier" NOT NULL DEFAULT 'NEW',
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "rejectionReason" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvedById" TEXT,
  "suspensionReason" TEXT,
  "suspendedAt" TIMESTAMP(3),
  "commissionOverride" DECIMAL(5,2),
  "payoutBank" JSONB,
  "rating" DECIMAL(4,2) NOT NULL DEFAULT 0,
  "totalOrders" INTEGER NOT NULL DEFAULT 0,
  "completedOrders" INTEGER NOT NULL DEFAULT 0,
  "cancelledOrders" INTEGER NOT NULL DEFAULT 0,
  "disputeCount" INTEGER NOT NULL DEFAULT 0,
  "avgResponseHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Shop" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "logoUrl" TEXT,
  "coverUrl" TEXT,
  "policyReturn" TEXT,
  "policyShipping" TEXT,
  "policyWarranty" TEXT,
  "operatingHours" JSONB,
  "shippingOrigin" TEXT,
  "defaultDeliveryDays" INTEGER NOT NULL DEFAULT 5,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessDocument" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "type" "DocumentType" NOT NULL,
  "fileName" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "number" TEXT,
  "expiryDate" TIMESTAMP(3),
  "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
  "reviewNote" TEXT,
  "reviewedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Warehouse" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "province" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SellerEarnings" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "grossRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "commissionPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "netEarnings" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "available" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "pending" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "withdrawn" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerEarnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TAXONOMY
CREATE TABLE "Category" (
  "id" TEXT NOT NULL,
  "parentId" TEXT,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "iconUrl" TEXT,
  "bannerUrl" TEXT,
  "description" TEXT,
  "level" INTEGER NOT NULL DEFAULT 1,
  "path" TEXT NOT NULL DEFAULT '',
  "commissionPercent" DECIMAL(5,2) NOT NULL DEFAULT 8,
  "returnWindowDays" INTEGER NOT NULL DEFAULT 7,
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "metaTitle" TEXT,
  "metaDescription" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Attribute" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "type" "AttributeType" NOT NULL DEFAULT 'SELECT',
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Attribute_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttributeValue" (
  "id" TEXT NOT NULL,
  "attributeId" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttributeValue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Brand" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "logoUrl" TEXT,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PRODUCTS
CREATE TABLE "Product" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "brandId" TEXT,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "subtitle" TEXT,
  "description" TEXT NOT NULL,
  "richDescription" JSONB,
  "tags" TEXT[],
  "condition" "ProductCondition" NOT NULL DEFAULT 'NEW',
  "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
  "sku" TEXT NOT NULL,
  "originalPrice" DECIMAL(12,2) NOT NULL,
  "salePrice" DECIMAL(12,2),
  "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "stockQuantity" INTEGER NOT NULL DEFAULT 0,
  "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
  "soldCount" INTEGER NOT NULL DEFAULT 0,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "ratingAverage" DECIMAL(3,2) NOT NULL DEFAULT 0,
  "ratingCount" INTEGER NOT NULL DEFAULT 0,
  "weightGrams" INTEGER,
  "lengthCm" DECIMAL(8,2),
  "widthCm" DECIMAL(8,2),
  "heightCm" DECIMAL(8,2),
  "shippingClass" "ShippingClass" NOT NULL DEFAULT 'SMALL',
  "videoUrl" TEXT,
  "metaTitle" TEXT,
  "metaDescription" TEXT,
  "seoKeywords" TEXT,
  "moderationNote" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "dealStartsAt" TIMESTAMP(3),
  "dealEndsAt" TIMESTAMP(3),
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "attributes" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductImage" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "altText" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductVariant" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "optionLabel" TEXT,
  "price" DECIMAL(12,2) NOT NULL,
  "compareAtPrice" DECIMAL(12,2),
  "stockQuantity" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VariantAttributeValue" (
  "id" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "attributeId" TEXT NOT NULL,
  "attributeValue" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VariantAttributeValue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockMovement" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "warehouseId" TEXT,
  "changeType" "StockChangeType" NOT NULL,
  "quantityDelta" INTEGER NOT NULL,
  "quantityBefore" INTEGER NOT NULL,
  "quantityAfter" INTEGER NOT NULL,
  "referenceType" "ReferenceEntityType",
  "referenceId" TEXT,
  "reason" TEXT,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductQa" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "askedById" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT,
  "answeredById" TEXT,
  "answeredAt" TIMESTAMP(3),
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "isPublic" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductQa_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CART & ORDERS
CREATE TABLE "Cart" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CartItem" (
  "id" TEXT NOT NULL,
  "cartId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "voucherCode" TEXT,
  "giftNote" TEXT,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Order" (
  "id" TEXT NOT NULL,
  "orderNumber" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "addressSnapshot" JSONB NOT NULL,
  "addressId" TEXT,
  "paymentMethod" "PaymentMethod" NOT NULL,
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "status" "OrderStatus" NOT NULL DEFAULT 'PLACED',
  "subtotal" DECIMAL(14,2) NOT NULL,
  "shippingTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(14,2) NOT NULL,
  "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "refundedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "walletUsed" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "loyaltyPointsEarned" INTEGER NOT NULL DEFAULT 0,
  "loyaltyPointsRedeemed" INTEGER NOT NULL DEFAULT 0,
  "buyerNotes" TEXT,
  "voucherCodesUsed" TEXT[],
  "cancelReason" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "invoiceUrl" TEXT,
  "installmentPlanType" "InstallmentPlanType",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SellerSubOrder" (
  "id" TEXT NOT NULL,
  "subOrderNumber" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'PLACED',
  "subtotal" DECIMAL(14,2) NOT NULL,
  "shippingFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "commissionPercent" DECIMAL(5,2) NOT NULL,
  "commissionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "sellerEarning" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "trackingNumber" TEXT,
  "courierName" TEXT,
  "estimatedDispatchAt" TIMESTAMP(3),
  "estimatedDeliveryAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "shippedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "autoCancelledAt" TIMESTAMP(3),
  "sellerNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerSubOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderItem" (
  "id" TEXT NOT NULL,
  "subOrderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "titleSnapshot" TEXT NOT NULL,
  "imageSnapshot" TEXT,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "totalPrice" DECIMAL(14,2) NOT NULL,
  "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderEvent" (
  "id" TEXT NOT NULL,
  "orderId" TEXT,
  "subOrderId" TEXT,
  "status" "OrderStatus",
  "title" TEXT NOT NULL,
  "description" TEXT,
  "actorType" TEXT NOT NULL DEFAULT 'SYSTEM',
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable: RETURNS & DISPUTES
CREATE TABLE "ReturnRequest" (
  "id" TEXT NOT NULL,
  "returnNumber" TEXT NOT NULL,
  "subOrderId" TEXT NOT NULL,
  "buyerId" TEXT,
  "reason" TEXT NOT NULL,
  "description" TEXT,
  "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedRefund" DECIMAL(14,2) NOT NULL,
  "approvedRefund" DECIMAL(14,2),
  "isPartial" BOOLEAN NOT NULL DEFAULT false,
  "refundMethod" TEXT,
  "sellerDecidedAt" TIMESTAMP(3),
  "sellerNote" TEXT,
  "adminNote" TEXT,
  "evidence" JSONB,
  "returnLabelUrl" TEXT,
  "refundTxId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReturnItem" (
  "id" TEXT NOT NULL,
  "returnId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReturnEvent" (
  "id" TEXT NOT NULL,
  "returnId" TEXT NOT NULL,
  "status" "ReturnStatus" NOT NULL,
  "note" TEXT,
  "actorType" TEXT NOT NULL DEFAULT 'SYSTEM',
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Dispute" (
  "id" TEXT NOT NULL,
  "returnId" TEXT NOT NULL,
  "openedById" TEXT,
  "assignedToId" TEXT,
  "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
  "resolution" TEXT,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PAYMENTS
CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "orderId" TEXT,
  "buyerId" TEXT,
  "method" "PaymentMethod" NOT NULL,
  "purpose" "PaymentPurpose" NOT NULL DEFAULT 'ORDER',
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'LKR',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "stripePaymentIntentId" TEXT,
  "stripeChargeId" TEXT,
  "failureReason" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "walletTxId" TEXT,
  "refundedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "paidAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InstallmentPlan" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "orderId" TEXT,
  "planType" "InstallmentPlanType" NOT NULL,
  "totalAmount" DECIMAL(14,2) NOT NULL,
  "upfrontAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "installmentAmount" DECIMAL(14,2) NOT NULL,
  "tenureMonths" INTEGER NOT NULL,
  "interestRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstallmentPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InstallmentRecord" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "indexNo" INTEGER NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "status" "InstallmentStatus" NOT NULL DEFAULT 'DUE',
  "paidAt" TIMESTAMP(3),
  "paymentRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstallmentRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Wallet" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'LKR',
  "isFrozen" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WalletTransaction" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "type" "TransactionType" NOT NULL,
  "purpose" "WalletTxPurpose" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "balanceAfter" DECIMAL(14,2) NOT NULL,
  "referenceType" "ReferenceEntityType",
  "referenceId" TEXT,
  "description" TEXT,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayoutRequest" (
  "id" TEXT NOT NULL,
  "payoutNumber" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'LKR',
  "bankName" TEXT NOT NULL,
  "bankAccountNo" TEXT NOT NULL,
  "bankBranch" TEXT,
  "accountHolder" TEXT NOT NULL,
  "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
  "reviewedById" TEXT,
  "processedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "stripeTransferId" TEXT,
  "referenceNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionRule" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT,
  "sellerTier" "SellerTier",
  "percent" DECIMAL(5,2) NOT NULL,
  "isBaseline" BOOLEAN NOT NULL DEFAULT false,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PROMOTIONS
CREATE TABLE "Voucher" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "scope" "VoucherScope" NOT NULL,
  "type" "VoucherType" NOT NULL,
  "ownerId" TEXT,
  "createdByStaffId" TEXT,
  "percentOff" DECIMAL(5,2),
  "fixedOff" DECIMAL(12,2),
  "maxDiscount" DECIMAL(12,2),
  "minOrderAmount" DECIMAL(12,2),
  "applicableProducts" TEXT[],
  "newBuyersOnly" BOOLEAN NOT NULL DEFAULT false,
  "oneTimePerUser" BOOLEAN NOT NULL DEFAULT true,
  "usageLimit" INTEGER,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "status" "VoucherStatus" NOT NULL DEFAULT 'ACTIVE',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "targetUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VoucherUsage" (
  "id" TEXT NOT NULL,
  "voucherId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT,
  "discountApplied" DECIMAL(12,2) NOT NULL,
  "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VoucherUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FlashSale" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "bannerUrl" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FlashSale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FlashSaleItem" (
  "id" TEXT NOT NULL,
  "flashSaleId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "salePrice" DECIMAL(12,2) NOT NULL,
  "stockLimit" INTEGER NOT NULL DEFAULT 0,
  "soldCount" INTEGER NOT NULL DEFAULT 0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FlashSaleItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BundleDeal" (
  "id" TEXT NOT NULL,
  "shopId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "dealType" TEXT NOT NULL,
  "buyQuantity" INTEGER NOT NULL DEFAULT 2,
  "getConfigQty" INTEGER NOT NULL DEFAULT 1,
  "discountPercent" DECIMAL(5,2),
  "fixedPrice" DECIMAL(12,2),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BundleDeal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BundleDealItem" (
  "id" TEXT NOT NULL,
  "bundleId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "BundleDealItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Banner" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "placement" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "targetUrl" TEXT,
  "altText" TEXT,
  "mobileImageUrl" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LOYALTY / REFERRAL / SPONSORED
CREATE TABLE "LoyaltyConfig" (
  "id" TEXT NOT NULL,
  "pointsPerCurrency" DECIMAL(8,4) NOT NULL DEFAULT 0.01,
  "pointsToCurrency" DECIMAL(8,4) NOT NULL DEFAULT 1,
  "redeemMinPoints" INTEGER NOT NULL DEFAULT 100,
  "maxRedeemPercent" DECIMAL(5,2) NOT NULL DEFAULT 20,
  "coinsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "cashbackPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "cashbackCategories" TEXT[],
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoyaltyConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoyaltyLedger" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "type" "RewardType" NOT NULL,
  "reason" TEXT NOT NULL,
  "referenceType" "ReferenceEntityType",
  "referenceId" TEXT,
  "balanceAfter" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoyaltyLedger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralConfig" (
  "id" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "rewardType" "RewardType" NOT NULL DEFAULT 'POINTS',
  "referrerReward" INTEGER NOT NULL DEFAULT 500,
  "refereeReward" INTEGER NOT NULL DEFAULT 500,
  "minOrderAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "maxRewardsPerUser" INTEGER NOT NULL DEFAULT 50,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferralConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralReward" (
  "id" TEXT NOT NULL,
  "referrerId" TEXT NOT NULL,
  "refereeId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "rewardAmount" INTEGER NOT NULL,
  "grantedAt" TIMESTAMP(3),
  "orderTriggeredId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SponsoredListing" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "placement" TEXT NOT NULL,
  "bidAmount" DECIMAL(12,2) NOT NULL,
  "billingCycle" TEXT NOT NULL DEFAULT 'WEEKLY',
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "paymentStatus" "SponsoredPaymentStatus" NOT NULL DEFAULT 'UNPAID',
  "paymentId" TEXT,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "approvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SponsoredListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SEARCH & DISCOVERY
CREATE TABLE "SearchQuery" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "query" TEXT NOT NULL,
  "normalized" TEXT NOT NULL,
  "resultsCount" INTEGER NOT NULL DEFAULT 0,
  "clickedProductId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SearchQuery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductView" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "productId" TEXT NOT NULL,
  "sessionId" TEXT,
  "referrer" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductView_pkey" PRIMARY KEY ("id")
);

-- CreateTable: REVIEWS
CREATE TABLE "Review" (
  "id" TEXT NOT NULL,
  "productId" TEXT,
  "sellerId" TEXT,
  "shopId" TEXT,
  "orderItemId" TEXT,
  "buyerId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "title" TEXT,
  "body" TEXT,
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "isReported" BOOLEAN NOT NULL DEFAULT false,
  "reportReason" TEXT,
  "reportedById" TEXT,
  "sellerReply" TEXT,
  "sellerRepliedAt" TIMESTAMP(3),
  "aiSummary" TEXT,
  "sentiment" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReviewHelpful" (
  "id" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "isHelpful" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewHelpful_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReviewMedia" (
  "id" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "uploaderId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'IMAGE',
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WISHLIST
CREATE TABLE "WishlistItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "priceAtAdd" DECIMAL(12,2) NOT NULL,
  "lastNotifiedAt" TIMESTAMP(3),
  CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: NOTIFICATIONS
CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "actionUrl" TEXT,
  "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
  "audience" "NotificationAudience" NOT NULL DEFAULT 'BUYER',
  "data" JSONB,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "typeKey" TEXT NOT NULL,
  "inApp" BOOLEAN NOT NULL DEFAULT true,
  "email" BOOLEAN NOT NULL DEFAULT true,
  "push" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PushSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "keys" JSONB NOT NULL,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SUPPORT & AI & FRAUD
CREATE TABLE "SupportTicket" (
  "id" TEXT NOT NULL,
  "ticketNumber" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "assignedToId" TEXT,
  "type" "TicketType" NOT NULL,
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
  "orderId" TEXT,
  "subOrderId" TEXT,
  "productId" TEXT,
  "sellerUserId" TEXT,
  "resolution" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "flags" TEXT[],
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketMessage" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "attachments" JSONB,
  "isInternal" BOOLEAN NOT NULL DEFAULT false,
  "isCanned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CannedResponse" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "category" TEXT,
  "useCount" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CannedResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiChatSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "guestId" TEXT,
  "topic" TEXT,
  "context" JSONB,
  "messages" JSONB[],
  "rating" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiChatSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FraudAlert" (
  "id" TEXT NOT NULL,
  "subjectType" "FraudSubject" NOT NULL,
  "subjectId" TEXT NOT NULL,
  "signal" TEXT NOT NULL,
  "score" DECIMAL(5,2) NOT NULL,
  "details" JSONB,
  "status" "FraudStatus" NOT NULL DEFAULT 'FLAGGED',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "actionTaken" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FraudAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PLATFORM & AUDIT
CREATE TABLE "Settings" (
  "id" TEXT NOT NULL DEFAULT 'platform',
  "platformName" TEXT NOT NULL DEFAULT 'MarketPlace',
  "platformLogoUrl" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'LKR',
  "currencySymbol" TEXT NOT NULL DEFAULT 'Rs',
  "locale" TEXT NOT NULL DEFAULT 'en',
  "defaultCommissionPercent" DECIMAL(5,2) NOT NULL DEFAULT 8,
  "returnWindowDays" INTEGER NOT NULL DEFAULT 7,
  "codEnabled" BOOLEAN NOT NULL DEFAULT true,
  "codMaxAmount" DECIMAL(14,2),
  "installmentsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "installmentPlans" JSONB,
  "minPayoutAmount" DECIMAL(14,2) NOT NULL DEFAULT 1000,
  "freeShippingThreshold" DECIMAL(12,2) NOT NULL DEFAULT 5000,
  "flatShippingFee" DECIMAL(12,2) NOT NULL DEFAULT 250,
  "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
  "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
  "supportEmail" TEXT NOT NULL DEFAULT 'support@marketplace.local',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformAnnouncement" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "placement" "AnnouncementPlacement" NOT NULL DEFAULT 'SITE_WIDE_BANNER',
  "bgColor" TEXT,
  "textColor" TEXT,
  "ctaLabel" TEXT,
  "ctaUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" "AuditEntityType" NOT NULL,
  "entityId" TEXT,
  "before" JSONB,
  "after" JSONB,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduledJobRun" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "lastRunAt" TIMESTAMP(3) NOT NULL,
  "result" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduledJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable: implicit many-to-many join tables
CREATE TABLE "_ShopToUser" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL,
  CONSTRAINT "_ShopToUser_AB_unique" UNIQUE ("A","B")
);

CREATE TABLE "_VoucherCategories" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL,
  CONSTRAINT "_VoucherCategories_AB_unique" UNIQUE ("A","B")
);

-- CreateIndex (unique)
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE UNIQUE INDEX "SellerProfile_userId_key" ON "SellerProfile"("userId");
CREATE UNIQUE INDEX "Shop_slug_key" ON "Shop"("slug");
CREATE UNIQUE INDEX "SellerEarnings_sellerId_periodStart_periodEnd_key" ON "SellerEarnings"("sellerId","periodStart","periodEnd");
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE UNIQUE INDEX "Attribute_categoryId_slug_key" ON "Attribute"("categoryId","slug");
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE UNIQUE INDEX "CartItem_cartId_productId_variantId_key" ON "CartItem"("cartId","productId","variantId");
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE UNIQUE INDEX "SellerSubOrder_subOrderNumber_key" ON "SellerSubOrder"("subOrderNumber");
CREATE UNIQUE INDEX "ReturnRequest_returnNumber_key" ON "ReturnRequest"("returnNumber");
CREATE UNIQUE INDEX "Dispute_returnId_key" ON "Dispute"("returnId");
CREATE UNIQUE INDEX "Payment_stripePaymentIntentId_key" ON "Payment"("stripePaymentIntentId");
CREATE UNIQUE INDEX "InstallmentRecord_planId_indexNo_key" ON "InstallmentRecord"("planId","indexNo");
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");
CREATE UNIQUE INDEX "PayoutRequest_payoutNumber_key" ON "PayoutRequest"("payoutNumber");
CREATE UNIQUE INDEX "CommissionRule_categoryId_sellerTier_key" ON "CommissionRule"("categoryId","sellerTier");
CREATE UNIQUE INDEX "Voucher_code_key" ON "Voucher"("code");
CREATE UNIQUE INDEX "FlashSale_slug_key" ON "FlashSale"("slug");
CREATE UNIQUE INDEX "FlashSaleItem_flashSaleId_productId_key" ON "FlashSaleItem"("flashSaleId","productId");
CREATE UNIQUE INDEX "BundleDealItem_bundleId_productId_key" ON "BundleDealItem"("bundleId","productId");
CREATE UNIQUE INDEX "ReferralReward_referrerId_refereeId_key" ON "ReferralReward"("referrerId","refereeId");
CREATE UNIQUE INDEX "Review_orderItemId_key" ON "Review"("orderItemId");
CREATE UNIQUE INDEX "ReviewHelpful_reviewId_userId_key" ON "ReviewHelpful"("reviewId","userId");
CREATE UNIQUE INDEX "WishlistItem_userId_productId_key" ON "WishlistItem"("userId","productId");
CREATE UNIQUE INDEX "NotificationPreference_userId_typeKey_key" ON "NotificationPreference"("userId","typeKey");
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE UNIQUE INDEX "SupportTicket_ticketNumber_key" ON "SupportTicket"("ticketNumber");
CREATE UNIQUE INDEX "ScheduledJobRun_key_key" ON "ScheduledJobRun"("key");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role","status");
CREATE INDEX "User_referredById_idx" ON "User"("referredById");
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX "OtpCode_phone_purpose_idx" ON "OtpCode"("phone","purpose");
CREATE INDEX "LoginActivity_userId_createdAt_idx" ON "LoginActivity"("userId","createdAt");
CREATE INDEX "Address_userId_idx" ON "Address"("userId");
CREATE INDEX "SellerProfile_status_tier_idx" ON "SellerProfile"("status","tier");
CREATE INDEX "Shop_sellerId_idx" ON "Shop"("sellerId");
CREATE INDEX "Shop_isActive_idx" ON "Shop"("isActive");
CREATE INDEX "BusinessDocument_sellerId_status_idx" ON "BusinessDocument"("sellerId","status");
CREATE INDEX "Warehouse_sellerId_idx" ON "Warehouse"("sellerId");
CREATE INDEX "SellerEarnings_sellerId_idx" ON "SellerEarnings"("sellerId");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_isActive_isFeatured_idx" ON "Category"("isActive","isFeatured");
CREATE INDEX "AttributeValue_attributeId_idx" ON "AttributeValue"("attributeId");
CREATE INDEX "Brand_categoryId_idx" ON "Brand"("categoryId");
CREATE INDEX "Product_shopId_status_idx" ON "Product"("shopId","status");
CREATE INDEX "Product_categoryId_status_idx" ON "Product"("categoryId","status");
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");
CREATE INDEX "Product_status_isFeatured_idx" ON "Product"("status","isFeatured");
CREATE INDEX "Product_soldCount_idx" ON "Product"("soldCount");
CREATE INDEX "Product_ratingAverage_idx" ON "Product"("ratingAverage");
CREATE INDEX "Product_dealEndsAt_idx" ON "Product"("dealEndsAt");
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "VariantAttributeValue_variantId_idx" ON "VariantAttributeValue"("variantId");
CREATE INDEX "VariantAttributeValue_attributeId_idx" ON "VariantAttributeValue"("attributeId");
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId","createdAt");
CREATE INDEX "StockMovement_warehouseId_idx" ON "StockMovement"("warehouseId");
CREATE INDEX "ProductQa_productId_isVisible_idx" ON "ProductQa"("productId","isVisible");
CREATE INDEX "Cart_userId_idx" ON "Cart"("userId");
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");
CREATE INDEX "Order_buyerId_status_idx" ON "Order"("buyerId","status");
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "SellerSubOrder_orderId_idx" ON "SellerSubOrder"("orderId");
CREATE INDEX "SellerSubOrder_shopId_status_idx" ON "SellerSubOrder"("shopId","status");
CREATE INDEX "SellerSubOrder_sellerId_status_idx" ON "SellerSubOrder"("sellerId","status");
CREATE INDEX "SellerSubOrder_status_createdAt_idx" ON "SellerSubOrder"("status","createdAt");
CREATE INDEX "OrderItem_subOrderId_idx" ON "OrderItem"("subOrderId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId","createdAt");
CREATE INDEX "OrderEvent_subOrderId_createdAt_idx" ON "OrderEvent"("subOrderId","createdAt");
CREATE INDEX "ReturnRequest_subOrderId_idx" ON "ReturnRequest"("subOrderId");
CREATE INDEX "ReturnRequest_status_createdAt_idx" ON "ReturnRequest"("status","createdAt");
CREATE INDEX "ReturnItem_returnId_idx" ON "ReturnItem"("returnId");
CREATE INDEX "ReturnEvent_returnId_createdAt_idx" ON "ReturnEvent"("returnId","createdAt");
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status","createdAt");
CREATE INDEX "Payment_stripePaymentIntentId_idx" ON "Payment"("stripePaymentIntentId");
CREATE INDEX "InstallmentPlan_orderId_idx" ON "InstallmentPlan"("orderId");
CREATE INDEX "InstallmentRecord_status_dueDate_idx" ON "InstallmentRecord"("status","dueDate");
CREATE INDEX "WalletTransaction_walletId_createdAt_idx" ON "WalletTransaction"("walletId","createdAt");
CREATE INDEX "PayoutRequest_sellerId_status_idx" ON "PayoutRequest"("sellerId","status");
CREATE INDEX "PayoutRequest_status_createdAt_idx" ON "PayoutRequest"("status","createdAt");
CREATE INDEX "Voucher_scope_status_idx" ON "Voucher"("scope","status");
CREATE INDEX "Voucher_ownerId_idx" ON "Voucher"("ownerId");
CREATE INDEX "VoucherUsage_voucherId_userId_idx" ON "VoucherUsage"("voucherId","userId");
CREATE INDEX "FlashSale_isActive_startsAt_endsAt_idx" ON "FlashSale"("isActive","startsAt","endsAt");
CREATE INDEX "FlashSaleItem_productId_idx" ON "FlashSaleItem"("productId");
CREATE INDEX "BundleDeal_isActive_idx" ON "BundleDeal"("isActive");
CREATE INDEX "Banner_placement_isActive_sortOrder_idx" ON "Banner"("placement","isActive","sortOrder");
CREATE INDEX "LoyaltyLedger_userId_createdAt_idx" ON "LoyaltyLedger"("userId","createdAt");
CREATE INDEX "ReferralReward_code_idx" ON "ReferralReward"("code");
CREATE INDEX "SponsoredListing_productId_isActive_idx" ON "SponsoredListing"("productId","isActive");
CREATE INDEX "SponsoredListing_placement_isActive_endDate_idx" ON "SponsoredListing"("placement","isActive","endDate");
CREATE INDEX "SearchQuery_normalized_createdAt_idx" ON "SearchQuery"("normalized","createdAt");
CREATE INDEX "SearchQuery_createdAt_idx" ON "SearchQuery"("createdAt");
CREATE INDEX "ProductView_userId_createdAt_idx" ON "ProductView"("userId","createdAt");
CREATE INDEX "ProductView_productId_idx" ON "ProductView"("productId");
CREATE INDEX "Review_productId_isVisible_createdAt_idx" ON "Review"("productId","isVisible","createdAt");
CREATE INDEX "Review_sellerId_idx" ON "Review"("sellerId");
CREATE INDEX "Review_buyerId_idx" ON "Review"("buyerId");
CREATE INDEX "Review_isReported_idx" ON "Review"("isReported");
CREATE INDEX "ReviewMedia_reviewId_idx" ON "ReviewMedia"("reviewId");
CREATE INDEX "WishlistItem_userId_idx" ON "WishlistItem"("userId");
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId","isRead","createdAt");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
CREATE INDEX "SupportTicket_status_priority_idx" ON "SupportTicket"("status","priority");
CREATE INDEX "SupportTicket_creatorId_idx" ON "SupportTicket"("creatorId");
CREATE INDEX "SupportTicket_assignedToId_status_idx" ON "SupportTicket"("assignedToId","status");
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId","createdAt");
CREATE INDEX "AiChatSession_userId_updatedAt_idx" ON "AiChatSession"("userId","updatedAt");
CREATE INDEX "FraudAlert_status_createdAt_idx" ON "FraudAlert"("status","createdAt");
CREATE INDEX "FraudAlert_subjectType_subjectId_idx" ON "FraudAlert"("subjectType","subjectId");
CREATE INDEX "PlatformAnnouncement_isActive_placement_idx" ON "PlatformAnnouncement"("isActive","placement");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType","entityId");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId","createdAt");
CREATE INDEX "ScheduledJobRun_key_idx" ON "ScheduledJobRun"("key");
CREATE INDEX "_ShopToUser_B_index" ON "_ShopToUser"("B");
CREATE INDEX "_VoucherCategories_B_index" ON "_VoucherCategories"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoginActivity" ADD CONSTRAINT "LoginActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerProfile" ADD CONSTRAINT "SellerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessDocument" ADD CONSTRAINT "BusinessDocument_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerEarnings" ADD CONSTRAINT "SellerEarnings_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Attribute" ADD CONSTRAINT "Attribute_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributeValue" ADD CONSTRAINT "AttributeValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VariantAttributeValue" ADD CONSTRAINT "VariantAttributeValue_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VariantAttributeValue" ADD CONSTRAINT "VariantAttributeValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductQa" ADD CONSTRAINT "ProductQa_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductQa" ADD CONSTRAINT "ProductQa_askedById_fkey" FOREIGN KEY ("askedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductQa" ADD CONSTRAINT "ProductQa_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerSubOrder" ADD CONSTRAINT "SellerSubOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerSubOrder" ADD CONSTRAINT "SellerSubOrder_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_subOrderId_fkey" FOREIGN KEY ("subOrderId") REFERENCES "SellerSubOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_subOrderId_fkey" FOREIGN KEY ("subOrderId") REFERENCES "SellerSubOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_subOrderId_fkey" FOREIGN KEY ("subOrderId") REFERENCES "SellerSubOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnEvent" ADD CONSTRAINT "ReturnEvent_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "ReturnRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InstallmentRecord" ADD CONSTRAINT "InstallmentRecord_planId_fkey" FOREIGN KEY ("planId") REFERENCES "InstallmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "SellerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VoucherUsage" ADD CONSTRAINT "VoucherUsage_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlashSaleItem" ADD CONSTRAINT "FlashSaleItem_flashSaleId_fkey" FOREIGN KEY ("flashSaleId") REFERENCES "FlashSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlashSaleItem" ADD CONSTRAINT "FlashSaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BundleDealItem" ADD CONSTRAINT "BundleDealItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "BundleDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BundleDealItem" ADD CONSTRAINT "BundleDealItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoyaltyLedger" ADD CONSTRAINT "LoyaltyLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SponsoredListing" ADD CONSTRAINT "SponsoredListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SponsoredListing" ADD CONSTRAINT "SponsoredListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SearchQuery" ADD CONSTRAINT "SearchQuery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductView" ADD CONSTRAINT "ProductView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductView" ADD CONSTRAINT "ProductView_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewHelpful" ADD CONSTRAINT "ReviewHelpful_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewHelpful" ADD CONSTRAINT "ReviewHelpful_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewMedia" ADD CONSTRAINT "ReviewMedia_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewMedia" ADD CONSTRAINT "ReviewMedia_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiChatSession" ADD CONSTRAINT "AiChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "_ShopToUser" ADD CONSTRAINT "_ShopToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ShopToUser" ADD CONSTRAINT "_ShopToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_VoucherCategories" ADD CONSTRAINT "_VoucherCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_VoucherCategories" ADD CONSTRAINT "_VoucherCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
