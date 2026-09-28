import { Prisma, ReferenceEntityType, StockChangeType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';
import { notify } from '../notifications/notification.service';
import { templates } from '../../lib/email/templates';

/**
 * Adjusts product (and optionally variant) stock, records a movement, and
 * fires a low-stock alert when the threshold is crossed. Used by ordering,
 * cancellation, restock and returns flows.
 */
export async function adjustStock(params: {
  productId: string;
  variantId?: string;
  delta: number;
  changeType: StockChangeType;
  referenceType?: ReferenceEntityType;
  referenceId?: string;
  reason?: string;
  actorId?: string;
  warehouseId?: string;
}) {
  const { productId, variantId, delta, changeType } = params;
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw ApiError.notFound('Product not found');
    const before = product.stockQuantity;
    const after = Math.max(0, before + delta);

    await tx.product.update({
      where: { id: productId },
      data: {
        stockQuantity: after,
        ...(after === 0 && product.status === 'ACTIVE' ? { status: 'OUT_OF_STOCK' } : {}),
        ...(after > 0 && product.status === 'OUT_OF_STOCK' ? { status: 'ACTIVE' } : {}),
      },
    });

    if (variantId) {
      const variant = await tx.productVariant.findUnique({ where: { id: variantId } });
      if (variant) await tx.productVariant.update({ where: { id: variantId }, data: { stockQuantity: Math.max(0, variant.stockQuantity + delta) } });
    }

    await tx.stockMovement.create({
      data: {
        productId,
        variantId,
        warehouseId: params.warehouseId,
        changeType,
        quantityDelta: delta,
        quantityBefore: before,
        quantityAfter: after,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        reason: params.reason,
        actorId: params.actorId,
      },
    });

    if (after > 0 && after <= product.lowStockThreshold) {
      await notifyLowStock(productId, product.soldCount, after, product.lowStockThreshold);
    }
    return after;
  });
}

export async function notifyLowStock(productId: string, _sold: number, remaining: number, threshold: number) {
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { shop: { include: { seller: { include: { user: true } } } } } });
  if (!product?.shop?.seller?.user) return;
  const user = product.shop.seller.user;
  // Debounce: only notify if none sent in the last 6 hours.
  const recent = await prisma.notification.findFirst({
    where: { userId: user.id, type: 'LOW_STOCK', data: { path: ['productId'], equals: productId }, createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) } },
  });
  if (recent) return;
  await notify({
    userId: user.id,
    audience: 'SELLER',
    type: 'LOW_STOCK',
    title: 'Low stock alert',
    body: `"${product.title}" has ${remaining} left (threshold ${threshold}).`,
    actionUrl: '/seller/inventory',
    emailHtml: templates.lowStock(user.name, product.title, remaining),
    data: { productId },
  });
}

export async function restock(userId: string, productId: string, quantity: number, warehouseId?: string) {
  await ensureSellerProduct(userId, productId);
  return adjustStock({ productId, delta: quantity, changeType: StockChangeType.RESTOCK, actorId: userId, warehouseId, reason: 'Manual restock' });
}

export async function setStock(userId: string, productId: string, quantity: number) {
  const product = await ensureSellerProduct(userId, productId);
  const delta = quantity - product.stockQuantity;
  return adjustStock({ productId, delta, changeType: StockChangeType.ADJUSTMENT, actorId: userId, reason: 'Manual set' });
}

export async function bulkUpdateStock(userId: string, items: { productId: string; variantId?: string; quantity: number }[]) {
  const results = [];
  for (const item of items) {
    try {
      await ensureSellerProduct(userId, item.productId);
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      const delta = item.quantity - (product?.stockQuantity ?? 0);
      const after = await adjustStock({ productId: item.productId, variantId: item.variantId, delta, changeType: StockChangeType.BULK_UPDATE, actorId: userId });
      results.push({ productId: item.productId, ok: true, stock: after });
    } catch (err) {
      results.push({ productId: item.productId, ok: false, error: (err as Error).message });
    }
  }
  return results;
}

export async function stockHistory(productId: string, limit = 50) {
  await prisma.product.findUnique({ where: { id: productId } });
  return prisma.stockMovement.findMany({ where: { productId }, orderBy: { createdAt: 'desc' }, take: limit });
}

async function ensureSellerProduct(userId: string, productId: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, shop: { seller: { userId } } } });
  if (!product) throw ApiError.forbidden('Product not found or not owned by you');
  return product;
}

// ── Warehouses ──
export async function listWarehouses(userId: string) {
  const seller = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (!seller) throw ApiError.notFound('Seller profile not found');
  return prisma.warehouse.findMany({ where: { sellerId: seller.id }, orderBy: { createdAt: 'asc' } });
}

export async function createWarehouse(userId: string, data: { name: string; address: string; city: string; province?: string; isDefault?: boolean }) {
  const seller = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (!seller) throw ApiError.notFound('Seller profile not found');
  if (data.isDefault) await prisma.warehouse.updateMany({ where: { sellerId: seller.id }, data: { isDefault: false } });
  return prisma.warehouse.create({ data: { ...data, sellerId: seller.id } });
}

export async function deleteWarehouse(userId: string, id: string) {
  const seller = await prisma.sellerProfile.findUnique({ where: { userId } });
  await prisma.warehouse.deleteMany({ where: { id, sellerId: seller?.id } });
  return { ok: true };
}
