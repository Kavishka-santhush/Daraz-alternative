import { Prisma, ProductStatus, ProductCondition, ShippingClass } from '@prisma/client';
import { prisma, section, info } from './helpers';
import type { CatalogResult } from './catalog.seed';
import type { UsersResult } from './users.seed';

export interface ProductsResult {
  productIds: string[];
  /** slug -> id */
  bySlug: Record<string, string>;
  variantCount: number;
}

interface ProductSpec {
  slug: string;
  sku: string;
  title: string;
  description: string;
  categorySlug: string;
  brandSlug?: string;
  shopSlug: string;
  originalPrice: number;
  salePrice?: number;
  stock: number;
  images: string[];
  variants?: Array<{ name: string; skuSuffix: string; priceDelta: number; stock: number }>;
  featured?: boolean;
}

// Placeholder images served from the app's local /uploads static route or CDN.
const img = (seed: string, i: number) => `/uploads/demo/${seed}-${i}.jpg`;

const PRODUCTS: ProductSpec[] = [
  {
    slug: 'galaxy-s24-ultra-256gb', sku: 'SKU-SSG-S24U', title: 'Samsung Galaxy S24 Ultra 256GB',
    description: 'Flagship Android smartphone with S-Pen, titanium frame and a 200MP main camera.',
    categorySlug: 'electronics-mobiles', brandSlug: 'samsung', shopSlug: 'techhub',
    originalPrice: 389000, salePrice: 359000, stock: 40,
    images: [img('galaxy', 1), img('galaxy', 2), img('galaxy', 3)],
    variants: [
      { name: 'Titanium Black / 256GB', skuSuffix: 'BLK256', priceDelta: 0, stock: 20 },
      { name: 'Titanium Gray / 512GB', skuSuffix: 'GRY512', priceDelta: 40000, stock: 20 },
    ],
    featured: true,
  },
  {
    slug: 'iphone-15-pro-128gb', sku: 'SKU-APL-15P', title: 'Apple iPhone 15 Pro 128GB',
    description: 'A17 Pro chip, titanium design, Action button and USB-C.',
    categorySlug: 'electronics-mobiles', brandSlug: 'apple', shopSlug: 'techhub',
    originalPrice: 459000, salePrice: 439000, stock: 25,
    images: [img('iphone', 1), img('iphone', 2)],
    variants: [
      { name: 'Natural Titanium', skuSuffix: 'NT', priceDelta: 0, stock: 15 },
      { name: 'Blue Titanium', skuSuffix: 'BT', priceDelta: 0, stock: 10 },
    ],
    featured: true,
  },
  {
    slug: 'dell-xps-15-laptop', sku: 'SKU-DELL-XPS15', title: 'Dell XPS 15 OLED Laptop',
    description: '13th Gen Intel Core i7, 16GB RAM, 512GB SSD, 15.6" OLED touchscreen.',
    categorySlug: 'electronics-laptops', brandSlug: 'dell', shopSlug: 'techhub',
    originalPrice: 520000, stock: 12,
    images: [img('xps', 1), img('xps', 2)],
  },
  {
    slug: 'sony-wh-1000xm5-headphones', sku: 'SKU-SONY-XM5', title: 'Sony WH-1000XM5 Wireless Headphones',
    description: 'Industry-leading noise cancellation with 30-hour battery life.',
    categorySlug: 'electronics-audio', brandSlug: 'sony', shopSlug: 'techhub',
    originalPrice: 129000, salePrice: 109000, stock: 60,
    images: [img('xm5', 1), img('xm5', 2)],
    featured: true,
  },
  {
    slug: 'classic-denim-jacket', sku: 'SKU-NIK-DJ', title: 'Classic Denim Jacket',
    description: 'Timeless unisex denim jacket, 100% cotton, machine washable.',
    categorySlug: 'fashion-mens', brandSlug: 'nike', shopSlug: 'stylehouse',
    originalPrice: 12500, salePrice: 8990, stock: 100,
    images: [img('denim', 1), img('denim', 2)],
    variants: [
      { name: 'Medium', skuSuffix: 'M', priceDelta: 0, stock: 40 },
      { name: 'Large', skuSuffix: 'L', priceDelta: 0, stock: 30 },
      { name: 'XL', skuSuffix: 'XL', priceDelta: 0, stock: 30 },
    ],
  },
  {
    slug: 'running-shoes-airflow', sku: 'SKU-ADI-RS', title: 'AirFlow Running Shoes',
    description: 'Lightweight breathable running shoes with responsive cushioning.',
    categorySlug: 'fashion-footwear', brandSlug: 'adidas', shopSlug: 'stylehouse',
    originalPrice: 18500, salePrice: 14900, stock: 80,
    images: [img('shoes', 1), img('shoes', 2)],
    variants: [
      { name: 'UK 7', skuSuffix: 'U7', priceDelta: 0, stock: 20 },
      { name: 'UK 8', skuSuffix: 'U8', priceDelta: 0, stock: 30 },
      { name: 'UK 9', skuSuffix: 'U9', priceDelta: 0, stock: 30 },
    ],
    featured: true,
  },
  {
    slug: 'nordic-oak-coffee-table', sku: 'SKU-IKEA-CT', title: 'Nordic Oak Coffee Table',
    description: 'Minimalist solid oak coffee table, flat-pack, easy assembly.',
    categorySlug: 'home-living-furniture', brandSlug: 'ikea', shopSlug: 'homenest',
    originalPrice: 34000, salePrice: 28900, stock: 15,
    images: [img('table', 1), img('table', 2)],
  },
  {
    slug: 'ceramic-cookware-set', sku: 'SKU-HN-CW', title: 'Ceramic Non-stick Cookware Set (7pc)',
    description: 'PFOA-free ceramic coating, induction-ready, includes 7 pieces.',
    categorySlug: 'home-living-kitchen', shopSlug: 'homenest',
    originalPrice: 22000, stock: 30,
    images: [img('cookware', 1), img('cookware', 2)],
  },
  {
    slug: 'vitamin-c-serum-30ml', sku: 'SKU-LK-VC', title: 'Vitamin C Brightening Serum 30ml',
    description: '20% vitamin C + hyaluronic acid serum for radiant skin.',
    categorySlug: 'beauty-health-skincare', brandSlug: 'lakme', shopSlug: 'stylehouse',
    originalPrice: 6500, salePrice: 4990, stock: 120,
    images: [img('serum', 1), img('serum', 2)],
    featured: true,
  },
  {
    slug: 'basmati-rice-5kg', sku: 'SKU-GR-BSM', title: 'Premium Basmati Rice 5kg',
    description: 'Aged long-grain basmati rice, aromatic and fluffy.',
    categorySlug: 'groceries-staples', shopSlug: 'homenest',
    originalPrice: 3200, salePrice: 2890, stock: 200,
    images: [img('rice', 1)],
  },
];

/**
 * Demo products with images, variants and initial stock movements.
 */
export async function seedProducts(
  catalog: CatalogResult,
  users: UsersResult,
): Promise<ProductsResult> {
  section('Products: catalog listings / variants / images');

  const shopBySlug = new Map(users.shops.map((s) => [s.slug, s]));
  const bySlug: Record<string, string> = {};
  const productIds: string[] = [];
  let variantCount = 0;

  for (const spec of PRODUCTS) {
    const categoryId = catalog.categories[spec.categorySlug];
    const shop = shopBySlug.get(spec.shopSlug);
    if (!categoryId || !shop) {
      info(`skip ${spec.slug} (missing category/shop link)`);
      continue;
    }
    const brandId = spec.brandSlug ? catalog.brands[spec.brandSlug] ?? null : null;
    const discount =
      spec.salePrice != null
        ? new Prisma.Decimal(((spec.originalPrice - spec.salePrice) / spec.originalPrice) * 100).toDecimalPlaces(2)
        : new Prisma.Decimal(0);

    const product = await prisma.product.upsert({
      where: { slug: spec.slug },
      update: {
        title: spec.title,
        description: spec.description,
        shopId: shop.shopId,
        categoryId,
        brandId,
        originalPrice: new Prisma.Decimal(spec.originalPrice),
        salePrice: spec.salePrice != null ? new Prisma.Decimal(spec.salePrice) : null,
        discountPercent: discount,
        stockQuantity: spec.stock,
        isFeatured: !!spec.featured,
        status: ProductStatus.ACTIVE,
      },
      create: {
        slug: spec.slug,
        sku: spec.sku,
        title: spec.title,
        description: spec.description,
        shopId: shop.shopId,
        categoryId,
        brandId,
        condition: ProductCondition.NEW,
        status: ProductStatus.ACTIVE,
        shippingClass: ShippingClass.SMALL,
        originalPrice: new Prisma.Decimal(spec.originalPrice),
        salePrice: spec.salePrice != null ? new Prisma.Decimal(spec.salePrice) : null,
        discountPercent: discount,
        stockQuantity: spec.stock,
        lowStockThreshold: 5,
        isFeatured: !!spec.featured,
        tags: spec.title.toLowerCase().split(' ').slice(0, 4),
      },
    });
    bySlug[spec.slug] = product.id;
    productIds.push(product.id);

    // Images (only when product has none yet → idempotent).
    const imageCount = await prisma.productImage.count({ where: { productId: product.id } });
    if (imageCount === 0) {
      for (let i = 0; i < spec.images.length; i++) {
        await prisma.productImage.create({
          data: {
            productId: product.id,
            url: spec.images[i],
            position: i,
            isPrimary: i === 0,
            altText: `${spec.title} image ${i + 1}`,
          },
        });
      }
    }

    // Variants.
    for (const v of spec.variants ?? []) {
      const vsku = `${spec.sku}-${v.skuSuffix}`;
      const basePrice = spec.salePrice ?? spec.originalPrice;
      const existing = await prisma.productVariant.findUnique({ where: { sku: vsku } });
      const row =
        existing ??
        (await prisma.productVariant.create({
          data: {
            productId: product.id,
            name: v.name,
            sku: vsku,
            optionLabel: v.name,
            price: new Prisma.Decimal(basePrice + v.priceDelta),
            stockQuantity: v.stock,
            isActive: true,
          },
        }));
      if (!existing) variantCount++;
      void row;
    }

    // Initial stock movement log.
    const movements = await prisma.stockMovement.count({ where: { productId: product.id } });
    if (movements === 0) {
      await prisma.stockMovement.create({
        data: {
          productId: product.id,
          changeType: 'RESTOCK',
          quantityDelta: spec.stock,
          quantityBefore: 0,
          quantityAfter: spec.stock,
          referenceType: 'SYSTEM',
          reason: 'Initial stock (seed)',
        },
      });
    }
  }

  info(`${productIds.length} products, ${variantCount} variants`);
  return { productIds, bySlug, variantCount };
}
