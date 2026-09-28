import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/http';
import * as svc from './catalog.service';
import { uploadCategoryImage } from './catalog.media';

export const listCategories = asyncHandler(async (req, res: Response) => {
  const data = await svc.listCategories(req);
  return ok(res, data.data, 200, data.meta);
});
export const tree = asyncHandler(async (_req, res: Response) => ok(res, await svc.categoryTree()));
export const getCategory = asyncHandler(async (req: Request, res: Response) => ok(res, await svc.getCategory(req.params.idOrSlug)));
export const createCategory = asyncHandler(async (req, res: Response) => created(res, await svc.createCategory(req.body)));
export const updateCategory = asyncHandler(async (req, res: Response) => ok(res, await svc.updateCategory(req.params.id, req.body)));
export const deleteCategory = asyncHandler(async (req, res: Response) => ok(res, await svc.deleteCategory(req.params.id)));

export const uploadIcon = asyncHandler(async (req, res: Response) => ok(res, { url: await uploadCategoryImage(req, 'icon') }));
export const uploadBanner = asyncHandler(async (req, res: Response) => ok(res, { url: await uploadCategoryImage(req, 'banner') }));

export const createAttribute = asyncHandler(async (req, res: Response) => created(res, await svc.createAttribute(req.params.categoryId, req.body)));
export const deleteAttribute = asyncHandler(async (req, res: Response) => ok(res, await svc.deleteAttribute(req.params.id)));

export const listBrands = asyncHandler(async (req, res: Response) => {
  const data = await svc.listBrands(req);
  return ok(res, data.data, 200, data.meta);
});
export const createBrand = asyncHandler(async (req, res: Response) => created(res, await svc.createBrand(req.body)));
export const updateBrand = asyncHandler(async (req, res: Response) => ok(res, await svc.updateBrand(req.params.id, req.body)));
export const deleteBrand = asyncHandler(async (req, res: Response) => ok(res, await svc.deleteBrand(req.params.id)));
