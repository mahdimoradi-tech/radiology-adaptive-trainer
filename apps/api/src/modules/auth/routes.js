import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { RegisterBodySchema, LoginBodySchema } from '@radiology/contracts';
import { validate } from '../../middleware/validate.js';
import { createAuthController } from './controller.js';
import { createRequireAuth } from '../../middleware/requireAuth.js';
import { RateLimitError } from '../../lib/httpErrors.js';

/**
 * Auth module router
 * @param {any} config
 */
export function createAuthRouter(config) {
  const router = Router();
  const controller = createAuthController(config);
  const requireAuth = createRequireAuth(config);

  const authLimiter = config.RATE_LIMIT_ENABLED
    ? rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req, _res, next) => {
          next(new RateLimitError('Too many authentication attempts, please try again later'));
        },
      })
    : (_req, _res, next) => next();

  router.post(
    '/auth/register',
    authLimiter,
    validate({ body: RegisterBodySchema }),
    controller.register,
  );
  router.post('/auth/login', authLimiter, validate({ body: LoginBodySchema }), controller.login);
  router.post('/auth/logout', controller.logout);
  router.get('/me', requireAuth, controller.me);

  return router;
}
