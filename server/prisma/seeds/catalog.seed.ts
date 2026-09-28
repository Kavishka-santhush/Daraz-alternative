import { Prisma, AttributeType } from '@prisma/client';
import { prisma, section, info } from './helpers';

export interface CatalogResult {
  /** category slug -> id */
  categories: Record<string, string>;
  /** brand slug -> id */
  brands: Record<string, string>;
}

interface SeedCategory {
  name: string;
  slug: string;
  commission?: number;
  children?: Array<{ name: string; slug: string; commission?: number }>;
  attributes?: Array<{
    name: string;
    slug: string;
    type?: AttributeType;
    required?: boolean;
    values?: string[];
  }>;
}

const CATEGORIES: SeedCategory[] = [
  {
    name: 'Electronics',
    slug: 'electronics',
    commission: 6,
    children: [
      { name: 'Mobiles', slug: 'electronics-mobiles', commission: 5 },
      { name: 'Laptops', slug: 'electronics-laptops', commission: 5 },
      { name: 'Audio', slug: 'electronics-audio', commission: 8 },
    ],
    attributes: [
      { name: 'Brand', slug: 'brand', type: AttributeType.SELECT, required: true, values: ['Apple', 'Samsung', 'Sony', 'Dell', 'HP'] },
      { name: 'Warranty', slug: 'warranty', type: AttributeType.TEXT },
    ],
  },
  {
    name: 'Fashion',
    slug: 'fashion',
    commission: 12,
    children: [
      { name: "Men's Clothing", slug: 'fashion-mens', commission: 12 },
      { name: "Women's Clothing", slug: 'fashion-womens', commission: 12 },
      { name: 'Footwear', slug: 'fashion-footwear', commission: 10 },
    ],
    attributes: [
      { name: 'Size', slug: 'size', type: AttributeType.SELECT, required: true, values: ['S', 'M', 'L', 'XL', 'XXL'] },
      { name: 'Color', slug: 'color', type: AttributeType.SELECT, values: ['Black', 'White', 'Blue', 'Red'] },
      { name: 'Material', slug: 'material', type: AttributeType.TEXT },
    ],
  },
  {
    name: 'Home & Living',
    slug: 'home-living',
    commission: 10,
    children: [
      { name: 'Kitchen', slug: 'home-living-kitchen', commission: 10 },
      { name: 'Furniture', slug: 'home-living-furniture', commission: 9 },
    ],
    attributes: [
      { name: 'Color', slug: 'color', type: AttributeType.SELECT, values: ['Brown', 'White', 'Grey'] },
    ],
  },
  {
    name: 'Beauty & Health',
    slug: 'beauty-health',
    commission: 11,
    children: [
      { name: 'Skincare', slug: 'beauty-health-skincare', commission: 11 },
      { name: 'Fragrance', slug: 'beauty-health-fragrance', commission: 11 },
    ],
    attributes: [
      { name: 'Volume', slug: 'volume', type: AttributeType.TEXT },
    ],
  },
  {
    name: 'Groceries',
    slug: 'groceries',
    commission: 4,
    children: [
      { name: 'Staples', slug: 'groceries-staples', commission: 4 },
      { name: 'Beverages', slug: 'groceries-beverages', commission: 4 },
    ],
  },
];

const BRANDS: Array<{ name: string; slug: string; categorySlug: string; featured?: boolean }> = [
  { name: 'Apple', slug: 'apple', categorySlug: 'electronics', featured: true },
  { name: 'Samsung', slug: 'samsung', categorySlug: 'electronics', featured: true },
  { name: 'Sony', slug: 'sony', categorySlug: 'electronics-audio' },
  { name: 'Dell', slug: 'dell', categorySlug: 'electronics-laptops' },
  { name: 'Nike', slug: 'nike', categorySlug: 'fashion', featured: true },
  { name: 'Adidas', slug: 'adidas', categorySlug: 'fashion-footwear' },
  { name: 'IKEA', slug: 'ikea', categorySlug: 'home-living-furniture' },
  { name: 'Lakme', slug: 'lakme', categorySlug: 'beauty-health' },
];

/**
 * Hierarchical categories, per-category attributes + values, and brands.
 */
export async function seedCatalog(): Promise<CatalogResult> {
  section('Catalog: categories / attributes / brands');
  const categories: Record<string, string> = {};
  const brands: Record<string, string> = {};

  for (const root of CATEGORIES) {
    const rootRow = await upsertCategory({
      slug: root.slug,
      name: root.name,
      level: 1,
      path: `/${root.slug}`,
      parentId: null,
      commissionPercent: root.commission ?? 8,
      isFeatured: true,
      sortOrder: Object.keys(categories).length,
    });
    categories[root.slug] = rootRow.id;

    for (const attr of root.attributes ?? []) {
      await upsertAttribute(rootRow.id, attr);
    }

    for (const child of root.children ?? []) {
      const childRow = await upsertCategory({
        slug: child.slug,
        name: child.name,
        level: 2,
        path: `/${root.slug}/${child.slug}`,
        parentId: rootRow.id,
        commissionPercent: child.commission ?? root.commission ?? 8,
        isFeatured: false,
        sortOrder: 0,
      });
      categories[child.slug] = childRow.id;
      // children inherit root attributes if they define none
      for (const attr of root.attributes ?? []) {
        await upsertAttribute(childRow.id, attr);
      }
    }
  }
  info(`${Object.keys(categories).length} categories`);

  for (const b of BRANDS) {
    const categoryId = categories[b.categorySlug] ?? null;
    const row = await prisma.brand.upsert({
      where: { slug: b.slug },
      update: { name: b.name, categoryId, isFeatured: !!b.featured },
      create: { name: b.name, slug: b.slug, categoryId, isFeatured: !!b.featured, isActive: true },
    });
    brands[b.slug] = row.id;
  }
  info(`${Object.keys(brands).length} brands`);

  return { categories, brands };
}

async function upsertCategory(data: {
  slug: string;
  name: string;
  level: number;
  path: string;
  parentId: string | null;
  commissionPercent: number;
  isFeatured: boolean;
  sortOrder: number;
}) {
  return prisma.category.upsert({
    where: { slug: data.slug },
    update: {
      name: data.name,
      parentId: data.parentId,
      level: data.level,
      path: data.path,
      commissionPercent: new Prisma.Decimal(data.commissionPercent),
      isFeatured: data.isFeatured,
      sortOrder: data.sortOrder,
    },
    create: {
      slug: data.slug,
      name: data.name,
      parentId: data.parentId,
      level: data.level,
      path: data.path,
      commissionPercent: new Prisma.Decimal(data.commissionPercent),
      returnWindowDays: 7,
      isFeatured: data.isFeatured,
      isActive: true,
      sortOrder: data.sortOrder,
    },
  });
}

async function upsertAttribute(
  categoryId: string,
  attr: { name: string; slug: string; type?: AttributeType; required?: boolean; values?: string[] },
) {
  const row = await prisma.attribute.upsert({
    where: { categoryId_slug: { categoryId, slug: attr.slug } },
    update: { name: attr.name, type: attr.type ?? AttributeType.SELECT, isRequired: !!attr.required },
    create: {
      categoryId,
      name: attr.name,
      slug: attr.slug,
      type: attr.type ?? AttributeType.SELECT,
      isRequired: !!attr.required,
    },
  });
  if (attr.values?.length) {
    for (let i = 0; i < attr.values.length; i++) {
      const value = attr.values[i];
      const exists = await prisma.attributeValue.findFirst({ where: { attributeId: row.id, value } });
      if (!exists) {
        await prisma.attributeValue.create({ data: { attributeId: row.id, value, sortOrder: i } });
      }
    }
  }
  return row;
}
