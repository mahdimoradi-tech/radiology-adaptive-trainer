import { z } from 'zod';
import { ImageMetaSchema, ClassIdSchema, BucketSchema } from './engine.js';

/**
 * Catalog entry schema matching ml/artifacts/catalog.json
 * @typedef {Object} CatalogEntry
 * @property {string} id
 * @property {string} [imageId]
 * @property {string} filename
 * @property {import('./engine.js').ClassId} trueClass
 * @property {string} source
 * @property {number} difficulty
 * @property {import('./engine.js').Bucket} bucket
 * @property {import('./engine.js').ClassId} confusedWith
 */
export const CatalogEntrySchema = ImageMetaSchema.extend({
  imageId: z.string().optional(),
  filename: z.string().regex(/^[A-Za-z0-9_.-]+\.jpe?g$/, 'Invalid filename format'),
  source: z.string().min(1),
}).refine((entry) => entry.imageId === undefined || entry.imageId === entry.id, {
  message: 'If imageId is provided, it must match id',
  path: ['imageId'],
});

/**
 * Catalog file schema: non-empty array of catalog entries with unique IDs
 */
export const CatalogFileSchema = z
  .array(CatalogEntrySchema)
  .min(1, 'Catalog must contain at least one entry')
  .refine(
    (entries) => {
      const ids = new Set();
      for (const entry of entries) {
        if (ids.has(entry.id)) return false;
        ids.add(entry.id);
      }
      return true;
    },
    { message: 'Catalog contains duplicate image IDs' },
  );

/**
 * Public image schema returned to resident
 * @typedef {Object} ImagePublic
 * @property {string} id - Opaque publicId (HMAC-SHA256)
 * @property {string} url - /api/images/:publicId/file
 */
export const ImagePublicSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
});

/**
 * Catalog image schema for instructor panel (full metadata + publicId + url)
 * @typedef {Object} CatalogImageAdmin
 * @property {string} id
 * @property {string} filename
 * @property {import('./engine.js').ClassId} trueClass
 * @property {string} source
 * @property {number} difficulty
 * @property {import('./engine.js').Bucket} bucket
 * @property {import('./engine.js').ClassId} confusedWith
 * @property {string} publicId
 * @property {string} url
 */
export const CatalogImageAdminSchema = ImageMetaSchema.extend({
  filename: z.string().regex(/^[A-Za-z0-9_.-]+\.jpe?g$/, 'Invalid filename format'),
  source: z.string().min(1),
  publicId: z.string().min(1),
  url: z.string().min(1),
});

/**
 * Catalog aggregated statistics schema
 * @typedef {Object} CatalogStats
 * @property {number} total
 * @property {Record<import('./engine.js').ClassId, number>} byClass
 * @property {Record<import('./engine.js').Bucket, number>} byBucket
 * @property {Record<import('./engine.js').ClassId, Record<import('./engine.js').Bucket, number>>} byClassBucket
 * @property {Record<string, number>} bySource
 */
export const CatalogStatsSchema = z.object({
  total: z.number().int().min(0),
  byClass: z.record(ClassIdSchema, z.number().int().min(0)),
  byBucket: z.record(BucketSchema, z.number().int().min(0)),
  byClassBucket: z.record(ClassIdSchema, z.record(BucketSchema, z.number().int().min(0))),
  bySource: z.record(z.string(), z.number().int().min(0)),
});
