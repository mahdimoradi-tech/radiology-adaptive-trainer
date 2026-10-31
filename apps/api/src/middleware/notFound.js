import { NotFoundError } from '../lib/httpErrors.js';

/**
 * 404 handler middleware
 */
export function notFound(_req, _res, next) {
  next(new NotFoundError('Route not found'));
}
