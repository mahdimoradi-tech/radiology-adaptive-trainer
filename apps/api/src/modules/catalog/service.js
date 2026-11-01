import { ImageModel } from './model.js';
import { SessionModel } from '../sessions/model.js';

/**
 * Check whether a user is authorized to view an image.
 * Instructors can view any image; residents can view only images included in their sessions.
 *
 * @param {any} user
 * @param {any} image
 * @returns {Promise<boolean>}
 */
export async function canViewImage(user, image) {
  if (!user || !image) return false;
  if (user.role === 'instructor') return true;
  const exists = await SessionModel.exists({
    userId: user._id,
    'questions.publicId': image.publicId,
  });
  return Boolean(exists);
}

/**
 * Find image document by publicId
 * @param {string} publicId
 */
export async function findImageByPublicId(publicId) {
  return ImageModel.findOne({ publicId }).lean();
}

/**
 * Retrieve aggregated statistics of the image catalog
 * @returns {Promise<import('@radiology/contracts').CatalogStats>}
 */
export async function getCatalogStats() {
  const [total, groupStats] = await Promise.all([
    ImageModel.countDocuments(),
    ImageModel.aggregate([
      {
        $group: {
          _id: {
            trueClass: '$trueClass',
            bucket: '$bucket',
            source: '$source',
          },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const byClass = { covid19: 0, pneumonia: 0, normal: 0 };
  const byBucket = { easy: 0, medium: 0, hard: 0 };
  const byClassBucket = {
    covid19: { easy: 0, medium: 0, hard: 0 },
    pneumonia: { easy: 0, medium: 0, hard: 0 },
    normal: { easy: 0, medium: 0, hard: 0 },
  };
  const bySource = {};

  for (const item of groupStats) {
    const { trueClass, bucket, source } = item._id;
    const count = item.count;

    if (byClass[trueClass] !== undefined) {
      byClass[trueClass] += count;
    }
    if (byBucket[bucket] !== undefined) {
      byBucket[bucket] += count;
    }
    if (byClassBucket[trueClass]?.[bucket] !== undefined) {
      byClassBucket[trueClass][bucket] += count;
    }
    bySource[source] = (bySource[source] || 0) + count;
  }

  return {
    total,
    byClass,
    byBucket,
    byClassBucket,
    bySource,
  };
}

/**
 * Retrieve paginated and filtered images for instructor panel
 * @param {Object} query
 * @param {number} [query.page=1]
 * @param {number} [query.pageSize=20]
 * @param {string} [query.trueClass]
 * @param {string} [query.bucket]
 * @param {string} [query.source]
 */
export async function getCatalogImages(query) {
  const page = query.page || 1;
  const pageSize = query.pageSize || 20;

  const filter = {};
  if (query.trueClass) filter.trueClass = query.trueClass;
  if (query.bucket) filter.bucket = query.bucket;
  if (query.source) filter.source = query.source;

  const [total, docs] = await Promise.all([
    ImageModel.countDocuments(filter),
    ImageModel.find(filter)
      .sort({ _id: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
  ]);

  const items = docs.map((doc) => ({
    id: doc._id,
    filename: doc.filename,
    trueClass: doc.trueClass,
    source: doc.source,
    difficulty: doc.difficulty,
    bucket: doc.bucket,
    confusedWith: doc.confusedWith,
    publicId: doc.publicId,
    url: `/api/images/${doc.publicId}/file`,
  }));

  return {
    items,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
