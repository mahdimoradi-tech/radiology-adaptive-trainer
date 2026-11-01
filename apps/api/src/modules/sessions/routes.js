import { Router } from 'express';
import {
  CreateSessionBodySchema,
  AnswerBodySchema,
  PaginationQuerySchema,
} from '@radiology/contracts';
import { validate } from '../../middleware/validate.js';
import { createRequireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { createSessionController } from './controller.js';

/**
 * Training session routes for resident trainees
 *
 * @param {any} config
 */
export function createSessionsRouter(config) {
  const router = Router();
  const requireAuth = createRequireAuth(config);
  const residentOnly = requireRole('resident');
  const controller = createSessionController(config);

  // Create new session
  router.post(
    '/sessions',
    requireAuth,
    residentOnly,
    validate({ body: CreateSessionBodySchema }),
    controller.createSession,
  );

  // List own sessions
  router.get(
    '/sessions',
    requireAuth,
    residentOnly,
    validate({ query: PaginationQuerySchema }),
    controller.getSessions,
  );

  // Get own session detail
  router.get('/sessions/:id', requireAuth, residentOnly, controller.getSessionById);

  // Record answer for a question in own in-progress session
  router.put(
    '/sessions/:id/questions/:no/answer',
    requireAuth,
    residentOnly,
    validate({ body: AnswerBodySchema }),
    controller.answerQuestion,
  );

  // Finish session and compute metrics
  router.post('/sessions/:id/finish', requireAuth, residentOnly, controller.finishSession);

  // Get report for finished session
  router.get('/sessions/:id/report', requireAuth, residentOnly, controller.getSessionReport);

  // Get historical progress trajectory
  router.get('/progress', requireAuth, residentOnly, controller.getProgress);

  return router;
}
