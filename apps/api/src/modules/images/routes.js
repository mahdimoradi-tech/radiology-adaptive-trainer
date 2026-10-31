import { Router } from 'express';
import { createRequireAuth } from '../../middleware/requireAuth.js';
import { findImageByPublicId, canViewImage } from '../catalog/service.js';
import { NotFoundError, ForbiddenError } from '../../lib/httpErrors.js';

const FILENAME_REGEX = /^[A-Za-z0-9_.-]+\.jpe?g$/;

/**
 * Image file serving router
 * @param {any} config
 */
export function createImagesRouter(config) {
  const router = Router();
  const requireAuth = createRequireAuth(config);

  router.get('/images/:publicId/file', requireAuth, async (req, res, next) => {
    try {
      const { publicId } = req.params;
      const image = await findImageByPublicId(publicId);

      if (!image) {
        throw new NotFoundError('Image not found');
      }

      if (!canViewImage(req.user, image)) {
        throw new ForbiddenError('You are not authorized to view this image');
      }

      if (!FILENAME_REGEX.test(image.filename)) {
        throw new NotFoundError('Invalid image filename format');
      }

      res.set('Cache-Control', 'private, max-age=86400');

      res.sendFile(
        image.filename,
        { root: config.catalogImageDirPath, dotfiles: 'deny' },
        (err) => {
          if (err) {
            if (!res.headersSent) {
              next(new NotFoundError('Image file not found on disk'));
            }
          }
        },
      );
    } catch (err) {
      next(err);
    }
  });

  return router;
}
