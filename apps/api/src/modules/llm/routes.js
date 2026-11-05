import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ExplanationsBodySchema, NarrativeBodySchema } from '@radiology/contracts';
import { validate } from '../../middleware/validate.js';
import { createRequireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { createLlmController } from './controller.js';
import { RateLimitError } from '../../lib/httpErrors.js';

/**
 * Creates LLM API routes
 * @param {any} config
 */
export function createLlmRouter(config) {
  const router = Router();
  const controller = createLlmController(config);
  const requireAuth = createRequireAuth(config);
  const residentOnly = requireRole('resident');
  const instructorOnly = requireRole('instructor');

  // Rate limiter for session report narrative (30 requests/user/hour default)
  const narrativeLimiter = config.RATE_LIMIT_ENABLED
    ? rateLimit({
        windowMs: 60 * 60 * 1000,
        max: config.LLM_RATE_LIMIT_PER_USER_PER_HOUR || 30,
        keyGenerator: (req) => req.user?._id?.toString() || 'anonymous',
        validate: { keyGeneratorIpFallback: false },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req, _res, next) => {
          next(new RateLimitError('Too many narrative report requests, please try again later'));
        },
      })
    : (_req, _res, next) => next();

  // Resident error explanations (cache or fallback only, never live)
  router.post(
    '/sessions/:id/explanations',
    requireAuth,
    residentOnly,
    validate({ body: ExplanationsBodySchema }),
    controller.getExplanations,
  );

  // Resident pedagogical report narrative
  router.post(
    '/sessions/:id/report-narrative',
    requireAuth,
    residentOnly,
    narrativeLimiter,
    validate({ body: NarrativeBodySchema }),
    controller.getReportNarrative,
  );

  // Instructor administrative LLM status
  router.get('/admin/llm/status', requireAuth, instructorOnly, controller.getAdminStatus);

  return router;
}
