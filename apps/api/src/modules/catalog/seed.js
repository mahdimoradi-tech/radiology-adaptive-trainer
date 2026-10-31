import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CatalogFileSchema } from '@radiology/contracts';
import { ImageModel } from './model.js';
import { computePublicId } from './publicId.js';

/**
 * Seed the catalog into MongoDB
 * @param {Object} options
 * @param {string} options.filePath
 * @param {string} [options.imagesDir]
 * @param {boolean} [options.prune=false]
 * @param {boolean} [options.requireFiles=false]
 * @param {string} options.salt
 */
export async function seedCatalog({
  filePath,
  imagesDir,
  prune = false,
  requireFiles = false,
  salt,
}) {
  if (!filePath || !existsSync(filePath)) {
    throw new Error(`Catalog file not found at: ${filePath}`);
  }

  const rawText = readFileSync(filePath, 'utf8');
  let jsonData;
  try {
    jsonData = JSON.parse(rawText);
  } catch (err) {
    throw new Error(`Catalog file contains malformed JSON: ${err.message}`, { cause: err });
  }

  const parseResult = CatalogFileSchema.safeParse(jsonData);
  if (!parseResult.success) {
    const issues = parseResult.error.issues
      .slice(0, 10)
      .map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(
      `Catalog validation failed with ${parseResult.error.issues.length} issues:\n${issues.join('\n')}`,
    );
  }

  const entries = parseResult.data;
  let missingFilesCount = 0;

  if (imagesDir) {
    for (const entry of entries) {
      const imgPath = join(imagesDir, entry.filename);
      if (!existsSync(imgPath)) {
        missingFilesCount++;
      }
    }

    if (requireFiles && missingFilesCount > 0) {
      throw new Error(`Missing ${missingFilesCount} required image files in ${imagesDir}`);
    }
  }

  // Prepare batch bulk writes of 500 entries
  const BATCH_SIZE = 500;
  let upsertedCount = 0;
  let modifiedCount = 0;
  let matchedCount = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE);
    const operations = chunk.map((entry) => {
      const publicId = computePublicId(entry.id, salt);
      return {
        updateOne: {
          filter: { _id: entry.id },
          update: {
            $set: {
              publicId,
              filename: entry.filename,
              trueClass: entry.trueClass,
              source: entry.source,
              difficulty: entry.difficulty,
              bucket: entry.bucket,
              confusedWith: entry.confusedWith,
            },
          },
          upsert: true,
          timestamps: false,
        },
      };
    });

    const result = await ImageModel.bulkWrite(operations, { ordered: false });
    upsertedCount += result.upsertedCount;
    modifiedCount += result.modifiedCount;
    matchedCount += result.matchedCount;
  }

  let deletedCount = 0;
  if (prune) {
    const validIds = entries.map((e) => e.id);
    const deleteResult = await ImageModel.deleteMany({ _id: { $nin: validIds } });
    deletedCount = deleteResult.deletedCount || 0;
  }

  // Calculate aggregation statistics and pool health
  const total = entries.length;
  const byClass = { covid19: 0, pneumonia: 0, normal: 0 };
  const byBucket = { easy: 0, medium: 0, hard: 0 };
  const byClassBucket = {
    covid19: { easy: 0, medium: 0, hard: 0 },
    pneumonia: { easy: 0, medium: 0, hard: 0 },
    normal: { easy: 0, medium: 0, hard: 0 },
  };
  const bySource = {};

  for (const entry of entries) {
    byClass[entry.trueClass] = (byClass[entry.trueClass] || 0) + 1;
    byBucket[entry.bucket] = (byBucket[entry.bucket] || 0) + 1;
    byClassBucket[entry.trueClass][entry.bucket] =
      (byClassBucket[entry.trueClass][entry.bucket] || 0) + 1;
    bySource[entry.source] = (bySource[entry.source] || 0) + 1;
  }

  const warnings = [];
  const classes = ['covid19', 'pneumonia', 'normal'];
  const buckets = ['easy', 'medium', 'hard'];

  for (const c of classes) {
    for (const b of buckets) {
      const count = byClassBucket[c][b];
      if (count < 6) {
        warnings.push(
          `Pool health warning: [${c} x ${b}] has only ${count} images (< 6). Tests need at least 2 per test and images do not repeat.`,
        );
      }
    }
  }

  return {
    total,
    upsertedCount,
    matchedCount,
    modifiedCount,
    deletedCount,
    missingFilesCount,
    stats: {
      total,
      byClass,
      byBucket,
      byClassBucket,
      bySource,
    },
    warnings,
  };
}
