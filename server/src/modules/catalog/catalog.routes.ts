import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { validate, idParam } from '../../middleware/validate';
import * as c from './catalog.controller';
import * as s from './catalog.schema';
import { categoryImageMiddleware } from './catalog.media';

const router = Router();

// Public catalog browsing
router.get('/categories', c.listCategories);
router.get('/categories/tree', c.tree);
router.get('/categories/:idOrSlug', c.getCategory);
router.get('/brands', c.listBrands);

// Admin management
router.post('/categories', requireAuth, requirePermission('category:manage'), validate(s.createCategorySchema), c.createCategory);
router.patch('/categories/:id', requireAuth, requirePermission('category:manage'), validate(s.updateCategorySchema), c.updateCategory);
router.delete('/categories/:id', requireAuth, requirePermission('category:manage'), c.deleteCategory);
router.post('/categories/:id/icon', requireAuth, requirePermission('category:manage'), categoryImageMiddleware, c.uploadIcon);
router.post('/categories/:id/banner', requireAuth, requirePermission('category:manage'), categoryImageMiddleware, c.uploadBanner);

router.post('/categories/:categoryId/attributes', requireAuth, requirePermission('category:manage'), validate(s.createAttributeSchema), c.createAttribute);
router.delete('/attributes/:id', requireAuth, requirePermission('category:manage'), c.deleteAttribute);

router.post('/brands', requireAuth, requirePermission('brand:manage'), validate(s.createBrandSchema), c.createBrand);
router.patch('/brands/:id', requireAuth, requirePermission('brand:manage'), c.updateBrand);
router.delete('/brands/:id', requireAuth, requirePermission('brand:manage'), c.deleteBrand);

export default router;
