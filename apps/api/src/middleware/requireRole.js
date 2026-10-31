import { ForbiddenError, UnauthenticatedError } from '../lib/httpErrors.js';

/**
 * Middleware factory requiring specific user roles
 * @param {...import('@radiology/contracts').Role} allowedRoles
 */
export function requireRole(...allowedRoles) {
  const roleSet = new Set(allowedRoles);

  return (req, _res, next) => {
    if (!req.user) {
      return next(new UnauthenticatedError('Authentication required'));
    }

    if (!roleSet.has(req.user.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
}
