import { Request } from 'express';

export interface PaginationInput {
  page: number;
  limit: number;
  skip: number;
}

export function getPagination(req: Request, defaultLimit = 20, maxLimit = 100): PaginationInput {
  const page = Math.max(1, Number(req.query.page ?? 1) || 1);
  const rawLimit = Number(req.query.limit ?? defaultLimit) || defaultLimit;
  const limit = Math.min(maxLimit, Math.max(1, rawLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function buildMeta(total: number, page: number, limit: number) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

export function paginated<T>(data: T[], total: number, page: number, limit: number) {
  return { data, meta: buildMeta(total, page, limit) };
}

/** Parses a sort query like "createdAt:desc,ratingAverage:desc" into Prisma orderBy. */
export function parseSort(sort: string | undefined, allowed: string[], fallback: Record<string, 'asc' | 'desc'>) {
  if (!sort) return [fallback];
  const parts = sort
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((token) => {
      const [field, dirRaw] = token.split(':');
      const dir = (dirRaw === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';
      return allowed.includes(field) ? { [field]: dir } : null;
    })
    .filter(Boolean) as Record<string, 'asc' | 'desc'>[];
  return parts.length ? parts : [fallback];
}
