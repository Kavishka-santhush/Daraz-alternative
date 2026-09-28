import { z } from 'zod';

const variantSchema = z.object({
  name: z.string().min(1).max(80),
  sku: z.string().min(1).max(80),
  optionLabel: z.string().max(120).optional(),
  price: z.number().nonnegative(),
  compareAtPrice: z.number().nonnegative().optional(),
  stockQuantity: z.number().int().nonnegative().default(0),
  attributes: z.array(z.object({ attributeId: z.string(), value: z.string() })).optional(),
});

export const createProductSchema = z.object({
  shopId: z.string().min(1),
  categoryId: z.string().min(1),
  brandId: z.string().optional(),
  title: z.string().min(3).max(160),
  subtitle: z.string().max(200).optional(),
  description: z.string().min(10),
  richDescription: z.any().optional(),
  tags: z.array(z.string()).max(30).optional(),
  condition: z.enum(['NEW', 'REFURBISHED', 'USED']).default('NEW'),
  sku: z.string().min(1).max(80),
  originalPrice: z.number().nonnegative(),
  salePrice: z.number().nonnegative().optional(),
  stockQuantity: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().optional(),
  weightGrams: z.number().int().nonnegative().optional(),
  lengthCm: z.number().optional(),
  widthCm: z.number().optional(),
  heightCm: z.number().optional(),
  shippingClass: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'HEAVY', 'FRAGILE']).default('SMALL'),
  videoUrl: z.string().url().optional(),
  metaTitle: z.string().max(120).optional(),
  metaDescription: z.string().max(200).optional(),
  dealStartsAt: z.coerce.date().optional(),
  dealEndsAt: z.coerce.date().optional(),
  attributes: z.record(z.any()).optional(),
  variants: z.array(variantSchema).max(200).optional(),
  submitForReview: z.boolean().default(false),
});

export const updateProductSchema = createProductSchema.partial().omit({ shopId: true, submitForReview: true });

export const listProductsQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(24),
  q: z.string().optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  shopId: z.string().optional(),
  status: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  condition: z.string().optional(),
  minRating: z.coerce.number().optional(),
  sort: z.string().optional(),
});

export const createQaSchema = z.object({
  productId: z.string().min(1),
  answer: z.string().min(2).max(2000).optional(),
});

export const bulkStockSchema = z.object({
  items: z.array(z.object({ variantId: z.string().optional(), productId: z.string(), quantity: z.number().int().nonnegative() })).min(1),
});
