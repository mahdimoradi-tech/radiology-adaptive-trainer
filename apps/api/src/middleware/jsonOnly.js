import { UnsupportedMediaTypeError } from '../lib/httpErrors.js';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH']);

/**
 * Middleware that rejects state-changing requests lacking Content-Type: application/json
 */
export function jsonOnly(req, _res, next) {
  if (STATE_CHANGING_METHODS.has(req.method)) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      return next(new UnsupportedMediaTypeError('Content-Type must be application/json'));
    }
  }
  next();
}
