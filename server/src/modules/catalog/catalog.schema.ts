import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(2).max(80),
  parentId: z.string().optional(),
  description: z.string().max(2000).optional(),
  commissionPercent: z.number().min(0).max(100).optional(),
  returnWindowDays: z.number().int().min(0).max(365).optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  metaTitle: z.string().max(120).optional(),
  metaDescription: z.string().max(200).optional(),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const createAttributeSchema = z.object({
  name: z.string().min(1).max(60),
  type: z.enum(['TEXT', 'SELECT', 'NUMBER', 'BOOLEAN', 'RANGE']).default('SELECT'),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  values: z.array(z.string().min(1)).max(200).optional(),
});

export const createBrandSchema = z.object({
  name: z.string().min(1).max(80),
  categoryId: z.string().optional(),
  description: z.string().max(2000).optional(),
  isFeatured: z.boolean().optional(),
});

export const updateBrandSchema = createBrandSchema.partial().extend({ isActive: z.boolean().optional() });
