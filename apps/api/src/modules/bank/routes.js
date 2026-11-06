import { Router } from 'express';
import {
  QuestionBankQuerySchema,
  ApproveQuestionBodySchema,
  RejectQuestionBodySchema,
  EditQuestionBodySchema,
} from '@radiology/contracts';
import { validate } from '../../middleware/validate.js';
import { createRequireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { createBankController } from './controller.js';

/**
 * Creates admin question bank router for instructors
 * @param {any} config
 * @returns {Router}
 */
export function createAdminBankRouter(config) {
  const router = Router();
  const requireAuth = createRequireAuth(config);
  const instructorOnly = requireRole('instructor');
  const controller = createBankController(config);

  // List questions with filters and pagination
  router.get(
    '/admin/questions',
    requireAuth,
    instructorOnly,
    validate({ query: QuestionBankQuerySchema }),
    controller.listQuestions,
  );

  // Stats summary for instructor panel
  router.get('/admin/questions/stats', requireAuth, instructorOnly, controller.getStats);

  // Single question details
  router.get('/admin/questions/:id', requireAuth, instructorOnly, controller.getQuestionById);

  // Approve question
  router.post(
    '/admin/questions/:id/approve',
    requireAuth,
    instructorOnly,
    validate({ body: ApproveQuestionBodySchema }),
    controller.approveQuestion,
  );

  // Reject question
  router.post(
    '/admin/questions/:id/reject',
    requireAuth,
    instructorOnly,
    validate({ body: RejectQuestionBodySchema }),
    controller.rejectQuestion,
  );

  // Edit question
  router.put(
    '/admin/questions/:id',
    requireAuth,
    instructorOnly,
    validate({ body: EditQuestionBodySchema }),
    controller.editQuestion,
  );

  return router;
}
