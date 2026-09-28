import { Request } from 'express';
import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';
import { uploader, withCategory, toPublicUrl } from '../../lib/upload';
import { slugify, uniqueSlug } from '../../utils/nano';

/** Multer middleware for product image uploads (up to 10 files) under uploads/products/. */
export const productImageMiddleware = [withCategory('products'), uploader(10).array('images', 10)];

export async function addProductImages(userId: string, productId: string, files: Express.Multer.File[]) {
  const product = await prisma.product.findFirst({ where: { id: productId, shop: { seller: { userId } } } });
  if (!product) throw ApiError.forbidden('Product not found or not owned by you');
  const startIndex = await prisma.productImage.count({ where: { productId } });
  const created = await prisma.productImage.createMany({
    data: files.map((f, i) => ({ productId, url: toPublicUrl(f.path), position: startIndex + i, isPrimary: startIndex === 0 && i === 0 })),
  });
  const images = await prisma.productImage.findMany({ where: { productId }, orderBy: { position: 'asc' } });
  return { created: created.count, images };
}

export async function deleteProductImage(userId: string, imageId: string) {
  const image = await prisma.productImage.findFirst({ where: { id: imageId, product: { shop: { seller: { userId } } } } });
  if (!image) throw ApiError.notFound('Image not found');
  await prisma.productImage.delete({ where: { id: imageId } });
  return { ok: true };
}

export async function setPrimaryImage(userId: string, imageId: string) {
  const image = await prisma.productImage.findFirst({ where: { id: imageId, product: { shop: { seller: { userId } } } } });
  if (!image) throw ApiError.notFound('Image not found');
  await prisma.productImage.updateMany({ where: { productId: image.productId }, data: { isPrimary: false } });
  await prisma.productImage.update({ where: { id: imageId }, data: { isPrimary: true } });
  return { ok: true };
}

/**
 * Bulk CSV import. Expects headers: title,description,categorySlug,price,salePrice,sku,stock,condition,tags(;sep)
 * Rows are created as DRAFT products for the seller's default shop.
 */
export async function importProductsCsv(userId: string, text: string) {
  const seller = await prisma.sellerProfile.findUnique({ where: { userId }, include: { shops: { where: { isActive: true }, take: 1 } } });
  if (!seller || !seller.shops.length) throw ApiError.badRequest('You need an active shop before importing products');
  const shop = seller.shops[0];

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw ApiError.badRequest('CSV must include a header row and at least one product');
  const headers = splitCsv(lines[0]).map((h) => h.trim().toLowerCase());
  const col = (name: string) => headers.indexOf(name);
  const required = ['title', 'description', 'categoryslug', 'price', 'sku'];
  for (const r of required) if (col(r) === -1) throw ApiError.badRequest(`CSV missing required column: ${r}`);

  const results: { row: number; ok: boolean; error?: string; slug?: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsv(lines[i]);
    try {
      const title = cells[col('title')];
      const categorySlug = cells[col('categoryslug')];
      const category = await prisma.category.findUnique({ where: { slug: categorySlug } });
      if (!category) throw new Error(`Unknown category slug "${categorySlug}"`);
      const sku = cells[col('sku')];
      const existing = await prisma.product.findUnique({ where: { sku } });
      if (existing) throw new Error(`SKU "${sku}" already exists`);
      const price = Number(cells[col('price')]);
      const saleRaw = cells[col('saleprice')];
      const sale = saleRaw ? Number(saleRaw) : null;
      const slug = await uniqueSlug(slugify(title), async (s) => !!(await prisma.product.findUnique({ where: { slug: s } })));
      await prisma.product.create({
        data: {
          shopId: shop.id,
          categoryId: category.id,
          title,
          slug,
          description: cells[col('description')],
          sku,
          originalPrice: price,
          salePrice: sale,
          discountPercent: sale && sale < price ? Number((((price - sale) / price) * 100).toFixed(2)) : 0,
          stockQuantity: Number(cells[col('stock')] ?? 0),
          condition: ((cells[col('condition')] ?? 'NEW').toUpperCase() as any) || 'NEW',
          tags: col('tags') >= 0 ? (cells[col('tags')] ?? '').split(';').map((t) => t.trim()).filter(Boolean) : [],
          status: 'DRAFT',
        },
      });
      results.push({ row: i, ok: true, slug });
    } catch (err) {
      results.push({ row: i, ok: false, error: (err as Error).message });
    }
  }
  const succeeded = results.filter((r) => r.ok).length;
  return { total: results.length, succeeded, failed: results.length - succeeded, results };
}

/** Minimal CSV cell splitter handling quoted values with commas. */
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      out.push(cur); cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

// ── Customer Q&A ──
export async function askQuestion(buyerId: string, productId: string, body: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw ApiError.notFound('Product not found');
  return prisma.productQa.create({ data: { productId, askedById: buyerId, question: body, answer: null }, include: { askedBy: { select: { name: true } } } });
}

export async function answerQuestion(userId: string, qaId: string, answer: string) {
  const qa = await prisma.productQa.findFirst({ where: { id: qaId, product: { shop: { seller: { userId } } } } });
  if (!qa) throw ApiError.forbidden('Question not found or not yours to answer');
  return prisma.productQa.update({ where: { id: qaId }, data: { answer, answeredById: userId, answeredAt: new Date() } });
}
