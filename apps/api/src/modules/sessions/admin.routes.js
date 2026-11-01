import { Router } from 'express';
import { PaginationQuerySchema } from '@radiology/contracts';
import { validate } from '../../middleware/validate.js';
import { createRequireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { createSessionController } from './controller.js';

/**
 * Admin sessions and resident evaluation routes for instructors
 *
 * @param {any} config
 */
export function createAdminSessionsRouter(config) {
  const router = Router();
  const requireAuth = createRequireAuth(config);
  const instructorOnly = requireRole('instructor');
  const controller = createSessionController(config);

  // List residents with session counts and metrics
  router.get(
    '/admin/users',
    requireAuth,
    instructorOnly,
    validate({ query: PaginationQuerySchema }),
    controller.getAdminUsers,
  );

  // Get resident progress trajectory
  router.get(
    '/admin/users/:userId/progress',
    requireAuth,
    instructorOnly,
    controller.getAdminUserProgress,
  );

  // Get report for any finished session
  router.get(
    '/admin/sessions/:id/report',
    requireAuth,
    instructorOnly,
    controller.getAdminSessionReport,
  );

  return router;
}
