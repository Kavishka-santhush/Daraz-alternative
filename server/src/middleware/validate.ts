import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError, z } from 'zod';
import ApiError from '../utils/ApiError';

type Target = 'body' | 'query' | 'params';

/**
 * Validates a request segment against a Zod schema. Replaces the segment with
 * the parsed (coerced, defaulted) value so downstream code trusts the shape.
 */
export function validate(schema: AnyZodObject, target: Target = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[target]);
      if (target === 'query') {
        // req.query is a getter in Express 5; assign to a writable alias instead.
        Object.assign(req, { validatedQuery: parsed });
      } else {
        (req as any)[target] = parsed;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        }));
        return next(ApiError.unprocessable('Validation failed', details));
      }
      next(err);
    }
  };
}

/** Small helper schemas reused across validators. */
export const idParam = z.object({ id: z.string().min(1) });
export const cuid = z.string().min(1);
export const paginationQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.string().optional(),
});
