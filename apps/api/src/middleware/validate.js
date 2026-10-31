import { BadRequestError } from '../lib/httpErrors.js';

/**
 * Middleware factory for validating request parts with Zod schemas
 * @param {{ body?: import('zod').ZodTypeAny, query?: import('zod').ZodTypeAny, params?: import('zod').ZodTypeAny }} schemas
 */
export function validate(schemas) {
  return (req, _res, next) => {
    try {
      req.valid = req.valid || {};

      if (schemas.params) {
        req.valid.params = schemas.params.parse(req.params);
      }
      if (schemas.query) {
        req.valid.query = schemas.query.parse(req.query);
      }
      if (schemas.body) {
        req.valid.body = schemas.body.parse(req.body);
      }

      next();
    } catch (err) {
      if (err?.name === 'ZodError') {
        return next(new BadRequestError('Validation error', err.issues));
      }
      next(err);
    }
  };
}
