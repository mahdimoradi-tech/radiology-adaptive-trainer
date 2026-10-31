import jwt from 'jsonwebtoken';
import { UnauthenticatedError } from '../lib/httpErrors.js';
import { SESSION_COOKIE_NAME, findUserById } from '../modules/auth/service.js';

/**
 * Middleware factory requiring a valid authenticated session
 * @param {any} config
 */
export function createRequireAuth(config) {
  return async (req, _res, next) => {
    try {
      const token = req.cookies?.[SESSION_COOKIE_NAME];
      if (!token) {
        return next(new UnauthenticatedError('Authentication required'));
      }

      let payload;
      try {
        payload = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] });
      } catch {
        return next(new UnauthenticatedError('Invalid or expired authentication session'));
      }

      if (!payload?.sub) {
        return next(new UnauthenticatedError('Invalid authentication session'));
      }

      const user = await findUserById(payload.sub);
      if (!user) {
        return next(new UnauthenticatedError('Authenticated user no longer exists'));
      }

      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}
