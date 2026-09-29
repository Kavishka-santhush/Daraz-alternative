import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';

export async function getOrCreateCart(userId: string) {
  let cart = await prisma.cart.findUnique({ where: { userId }, include: CART_INCLUDE });
  if (!cart) cart = await prisma.cart.create({ data: { userId }, include: CART_INCLUDE });
  return hydrateCart(cart);
}

const CART_INCLUDE = {
  items: {
    orderBy: { addedAt: 'asc' },
    include: {
      product: { include: { images: { where: { isPrimary: true }, take: 1 }, shop: { select: { id: true, name: true, slug: true } }, category: { select: { id: true, returnWindowDays: true } } } },
    },
  },
} as const;

export async function addToCart(userId: string, input: { productId: string; variantId?: string; quantity?: number }) {
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product || product.status !== 'ACTIVE') throw ApiError.badRequest('Product is not available');
  const qty = Math.max(1, input.quantity ?? 1);
  const cart = await prisma.cart.findUnique({ where: { userId } }) ?? (await prisma.cart.create({ data: { userId } }));

  const existing = await prisma.cartItem.findFirst({
    where: { cartId: cart.id, productId: input.productId, variantId: input.variantId ?? null },
  });
  const targetQty = (existing?.quantity ?? 0) + qty;
  if (targetQty > product.stockQuantity) throw ApiError.badRequest('Requested quantity exceeds available stock');

  if (existing) {
    await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: targetQty } });
  } else {
    await prisma.cartItem.create({ data: { cartId: cart.id, productId: input.productId, variantId: input.variantId ?? null, quantity: qty } });
  }
  return getOrCreateCart(userId);
}

export async function updateCartItem(userId: string, itemId: string, quantity: number) {
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cart: { userId } }, include: { product: true } });
  if (!item) throw ApiError.notFound('Cart item not found');
  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: itemId } });
  } else {
    if (quantity > item.product.stockQuantity) throw ApiError.badRequest('Not enough stock');
    await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
  }
  return getOrCreateCart(userId);
}

export async function removeCartItem(userId: string, itemId: string) {
  await prisma.cartItem.deleteMany({ where: { id: itemId, cart: { userId } } });
  return getOrCreateCart(userId);
}

export async function clearCart(userId: string) {
  await prisma.cart.deleteMany({ where: { userId } });
  return { ok: true };
}

/** Groups items by shop and computes totals (subtotal per group, platform totals). */
export async function hydrateCart(cart: any) {
  const groups = new Map<string, any>();
  let subtotal = 0;
  for (const item of cart.items) {
    const price = item.product.salePrice != null ? Number(item.product.salePrice) : Number(item.product.originalPrice);
    const lineTotal = Number(new Prisma.Decimal(price).mul(item.quantity));
    subtotal += lineTotal;
    const shop = item.product.shop;
    if (!groups.has(shop.id)) groups.set(shop.id, { shop, items: [], subtotal: 0 });
    const g = groups.get(shop.id);
    g.items.push({
      id: item.id,
      productId: item.product.id,
      variantId: item.variantId,
      title: item.product.title,
      image: item.product.images?.[0]?.url ?? null,
      unitPrice: price,
      quantity: item.quantity,
      lineTotal,
      stock: item.product.stockQuantity,
      returnWindowDays: item.product.category?.returnWindowDays ?? 7,
    });
    g.subtotal += lineTotal;
  }
  const groupList = [...groups.values()];
  return {
    cartId: cart.id,
    groups: groupList,
    itemCount: cart.items.length,
    subtotal: Number(new Prisma.Decimal(subtotal).toFixed(2)),
  };
}
