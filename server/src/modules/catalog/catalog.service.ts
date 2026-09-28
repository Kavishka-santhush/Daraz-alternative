import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';
import { slugify, uniqueSlug } from '../../utils/nano';
import { getPagination, paginated } from '../../utils/pagination';
import type { Request } from 'express';

export async function listCategories(req: Request) {
  const { page, limit } = getPagination(req, 100);
  const where = { isActive: true, ...(req.query.parentId ? { parentId: req.query.parentId as string } : { parentId: null }) };
  const [items, total] = await prisma.$transaction([
    prisma.category.findMany({
      where,
      include: { children: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.category.count({ where }),
  ]);
  return paginated(items, total, page, limit);
}

export async function categoryTree() {
  const all = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
    select: { id: true, parentId: true, name: true, slug: true, iconUrl: true, level: true, isFeatured: true },
  });
  const byParent = new Map<string | null, any[]>();
  for (const c of all) {
    const key = c.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }
  const build = (parentId: string | null): any[] =>
    (byParent.get(parentId) ?? []).map((c) => ({ ...c, children: build(c.id) }));
  return build(null);
}

export async function getCategory(idOrSlug: string) {
  const cat = await prisma.category.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: { attributes: { include: { values: true }, orderBy: { sortOrder: 'asc' } }, brands: true, children: true },
  });
  if (!cat) throw ApiError.notFound('Category not found');
  return cat;
}

export async function createCategory(data: {
  name: string; parentId?: string; description?: string; commissionPercent?: number;
  returnWindowDays?: number; isFeatured?: boolean; sortOrder?: number; metaTitle?: string; metaDescription?: string;
}) {
  let level = 1;
  let path = '';
  if (data.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: data.parentId } });
    if (!parent) throw ApiError.badRequest('Invalid parent category');
    level = parent.level + 1;
    path = `${parent.path}/${slugify(data.name)}`;
  } else {
    path = `/${slugify(data.name)}`;
  }
  const slug = await uniqueSlug(slugify(data.name), async (s) => !!(await prisma.category.findUnique({ where: { slug: s } })));
  return prisma.category.create({ data: { ...data, slug, level, path } as any });
}

export async function updateCategory(id: string, data: Record<string, unknown>) {
  await ensureCategory(id);
  return prisma.category.update({ where: { id }, data: data as any });
}

export async function deleteCategory(id: string) {
  await ensureCategory(id);
  const productCount = await prisma.product.count({ where: { categoryId: id } });
  if (productCount > 0) {
    // Soft-disable instead of hard delete to protect references.
    return prisma.category.update({ where: { id }, data: { isActive: false } });
  }
  return prisma.category.delete({ where: { id } });
}

async function ensureCategory(id: string) {
  const exists = await prisma.category.findUnique({ where: { id } });
  if (!exists) throw ApiError.notFound('Category not found');
}

// ── Attributes ──
export async function createAttribute(categoryId: string, data: { name: string; type: string; isRequired?: boolean; sortOrder?: number; values?: string[] }) {
  await ensureCategory(categoryId);
  const slug = slugify(data.name);
  return prisma.attribute.create({
    data: {
      categoryId,
      name: data.name,
      slug,
      type: data.type as any,
      isRequired: data.isRequired,
      sortOrder: data.sortOrder,
      values: data.values ? { create: data.values.map((v, i) => ({ value: v, sortOrder: i })) } : undefined,
    },
    include: { values: true },
  });
}

export async function deleteAttribute(id: string) {
  return prisma.attribute.delete({ where: { id } });
}

// ── Brands ──
export async function listBrands(req: Request) {
  const { page, limit } = getPagination(req, 100);
  const where = { isActive: true, ...(req.query.categoryId ? { categoryId: req.query.categoryId as string } : {}) };
  const [items, total] = await prisma.$transaction([
    prisma.brand.findMany({ where, orderBy: { name: 'asc' }, skip: (page - 1) * limit, take: limit }),
    prisma.brand.count({ where }),
  ]);
  return paginated(items, total, page, limit);
}

export async function createBrand(data: { name: string; categoryId?: string; description?: string; isFeatured?: boolean }) {
  const slug = await uniqueSlug(slugify(data.name), async (s) => !!(await prisma.brand.findUnique({ where: { slug: s } })));
  return prisma.brand.create({ data: { ...data, slug } as any });
}

export async function updateBrand(id: string, data: Record<string, unknown>) {
  return prisma.brand.update({ where: { id }, data: data as any });
}

export async function deleteBrand(id: string) {
  return prisma.brand.update({ where: { id }, data: { isActive: false } });
}
