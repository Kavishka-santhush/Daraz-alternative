import { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth, requireAuth, requirePermission } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/http';
import * as search from './search.service';

const router = Router();

/** Whitelisted query params converted into a typed search input. */
function toInput(q: Request['query']): search.SearchInput {
  const num = (v: unknown) => (v === undefined || v === '' ? undefined : Number(v));
  const attributes: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(q as Record<string, unknown>)) {
    if (!key.startsWith('attr_')) continue;
    attributes[key.slice(5)] = Array.isArray(value) ? value.map(String) : String(value);
  }
  return {
    q: q.q ? String(q.q) : undefined,
    categoryId: q.categoryId ? String(q.categoryId) : undefined,
    brandId: q.brandId ? String(q.brandId) : undefined,
    shopId: q.shopId ? String(q.shopId) : undefined,
    condition: q.condition ? String(q.condition) : undefined,
    minPrice: num(q.minPrice),
    maxPrice: num(q.maxPrice),
    minRating: num(q.minRating),
    inStock: q.inStock === 'true',
    onSale: q.onSale === 'true',
    attributes: Object.keys(attributes).length ? attributes : undefined,
    sort: (q.sort ? String(q.sort) : undefined) as search.SearchInput['sort'],
    page: num(q.page),
    limit: num(q.limit),
  };
}

router.get('/', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  const input = toInput(req.query);
  const withFacets = req.query.facets === 'true';
  const data = await search.searchProducts(input, req.user?.id);
  const facets = withFacets ? await search.getFacets(input) : undefined;
  return ok(res, data.data, 200, { ...data.meta, facets });
}));

router.get('/suggest', asyncHandler(async (req: Request, res: Response) => ok(res, await search.suggestions(String(req.query.q ?? '')))));
router.get('/popular', asyncHandler(async (req: Request, res: Response) => ok(res, await search.popularSearches())));
router.get('/facets', asyncHandler(async (req: Request, res: Response) => ok(res, await search.getFacets(toInput(req.query)))));

router.post('/ai', optionalAuth, validate(z.object({ query: z.string().min(2).max(300) })), asyncHandler(async (req: Request, res: Response) => ok(res, await search.aiSearch(req.body.query, req.user?.id))));

// ── Analytics (staff) ──
router.get('/analytics/queries', requireAuth, requirePermission('settings:manage'), asyncHandler(async (req: Request, res: Response) => ok(res, await search.popularSearches(Number(req.query.limit ?? 50)))));

export default router;
