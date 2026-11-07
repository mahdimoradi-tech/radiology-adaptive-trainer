import { Router } from 'express';
import {
  PracticeCreateRequestSchema,
  PracticeAnswerRequestSchema,
  PaginationQuerySchema,
} from '@radiology/contracts';
import { createRequireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { createPracticeController } from './controller.js';

/**
 * Creates Express Router for Resident Targeted Practice
 *
 * @param {any} config
 * @returns {Router}
 */
export function createPracticeRouter(config) {
  const router = Router();
  const requireAuth = createRequireAuth(config);
  const residentOnly = requireRole('resident');
  const controller = createPracticeController();

  // Create new targeted practice set
  router.post(
    '/practice',
    requireAuth,
    residentOnly,
    validate({ body: PracticeCreateRequestSchema }),
    controller.createPracticeSet,
  );

  // List own practice sets
  router.get(
    '/practice',
    requireAuth,
    residentOnly,
    validate({ query: PaginationQuerySchema }),
    controller.getPracticeSets,
  );

  // Get single practice set detail
  router.get('/practice/:id', requireAuth, residentOnly, controller.getPracticeSetById);

  // Submit answer for a practice question
  router.put(
    '/practice/:id/questions/:no/answer',
    requireAuth,
    residentOnly,
    validate({ body: PracticeAnswerRequestSchema }),
    controller.answerPracticeQuestion,
  );

  return router;
}
