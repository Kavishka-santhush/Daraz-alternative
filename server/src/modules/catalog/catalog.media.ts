import { Request } from 'express';
import { prisma } from '../../config/prisma';
import ApiError from '../../utils/ApiError';
import { uploader, withCategory, toPublicUrl } from '../../lib/upload';

/** Multer middleware that stores category icon/banner images under uploads/categories/. */
export const categoryImageMiddleware = [withCategory('categories'), uploader(1).single('image')];

export async function uploadCategoryImage(req: Request, field: 'icon' | 'banner') {
  if (!req.file) throw ApiError.badRequest('No image uploaded');
  const url = toPublicUrl(req.file.path);
  const id = req.params.id;
  if (id) {
    await prisma.category.update({ where: { id }, data: field === 'icon' ? { iconUrl: url } : { bannerUrl: url } });
  }
  return url;
}
