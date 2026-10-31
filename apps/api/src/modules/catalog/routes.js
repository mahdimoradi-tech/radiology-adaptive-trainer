import { Router } from 'express';
import { z } from 'zod';
import { PaginationQuerySchema, ClassIdSchema, BucketSchema } from '@radiology/contracts';
import { validate } from '../../middleware/validate.js';
import { createRequireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { catalogController } from './controller.js';

export const CatalogImagesQuerySchema = PaginationQuerySchema.extend({
  trueClass: ClassIdSchema.optional(),
  bucket: BucketSchema.optional(),
  source: z.string().min(1).optional(),
});

/**
 * Catalog management router for instructors
 * @param {any} config
 */
export function createCatalogRouter(config) {
  const router = Router();
  const requireAuth = createRequireAuth(config);
  const instructorOnly = requireRole('instructor');

  router.get('/catalog/stats', requireAuth, instructorOnly, catalogController.getStats);
  router.get(
    '/catalog/images',
    requireAuth,
    instructorOnly,
    validate({ query: CatalogImagesQuerySchema }),
    catalogController.getImages,
  );

  return router;
}
