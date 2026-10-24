import { CLASS_IDS, BUCKETS, EngineConfigSchema } from '@radiology/contracts';
import { allocateClassCounts, allocateBucketCounts } from './allocation.js';
import { createRng } from './rng.js';

/**
 * Helper to determine fallback bucket search order for shortage substitution.
 *
 * @param {import('@radiology/contracts').Bucket} bucket - Current bucket
 * @returns {import('@radiology/contracts').Bucket[]} Ordered fallback buckets
 */
function getNearestBucketOrder(bucket) {
  if (bucket === 'easy') {
    return ['medium', 'hard'];
  }
  if (bucket === 'hard') {
    return ['medium', 'easy'];
  }
  return ['easy', 'hard'];
}

/**
 * Core image picking logic from image pool given bucket counts and fallback rules.
 *
 * @param {import('@radiology/contracts').ImageMeta[]} imagePool - Full image catalog
 * @param {Record<import('@radiology/contracts').ClassId, Record<import('@radiology/contracts').Bucket, number>>} bucketCounts - Target counts
 * @param {Record<import('@radiology/contracts').ClassId, number>} weights - Class weights
 * @param {Record<import('@radiology/contracts').ClassId, any> | null} errors - Per-class error metrics or null
 * @param {string[]} [shownImageIds=[]] - Image IDs already shown to user
 * @param {import('@radiology/contracts').EngineConfig} config - Engine configuration
 * @param {ReturnType<typeof createRng>} rng - Seeded RNG
 * @returns {{ imageIds: string[], plan: any }}
 */
export function pickImagesFromPool(
  imagePool,
  bucketCounts,
  weights,
  errors,
  shownImageIds = [],
  config,
  rng,
) {
  const shownSet = new Set(shownImageIds);
  const selectedSet = new Set();
  const selectedImageIds = [];
  const shortfalls = [];

  // Group pool into bins by [class][bucket]
  /** @type {Record<string, Record<string, import('@radiology/contracts').ImageMeta[]>>} */
  const bins = {};
  for (const c of CLASS_IDS) {
    bins[c] = {};
    for (const b of BUCKETS) {
      bins[c][b] = [];
    }
  }

  for (const img of imagePool) {
    if (bins[img.trueClass] && bins[img.trueClass][img.bucket]) {
      // If allowRepeats is false, skip previously shown images
      if (config.allowRepeats || !shownSet.has(img.id)) {
        bins[img.trueClass][img.bucket].push(img);
      }
    }
  }

  // Shuffle all bins for deterministic randomness
  for (const c of CLASS_IDS) {
    for (const b of BUCKETS) {
      rng.shuffle(bins[c][b]);
    }
  }

  // First pass: satisfy requested bucket quotas
  for (const c of CLASS_IDS) {
    for (const b of BUCKETS) {
      const requested = bucketCounts[c]?.[b] ?? 0;
      let availableCount = 0;

      while (bins[c][b].length > 0 && availableCount < requested) {
        const img = bins[c][b].pop();
        if (img && !selectedSet.has(img.id)) {
          selectedSet.add(img.id);
          selectedImageIds.push(img.id);
          availableCount += 1;
        }
      }

      const shortfall = requested - availableCount;
      if (shortfall > 0) {
        shortfalls.push({
          classId: c,
          bucket: b,
          requested,
          available: availableCount,
          shortfall,
        });
      }
    }
  }

  // Second pass: fill shortfalls from nearest bucket of same class, then other classes by weight
  for (const sf of shortfalls) {
    let needed = sf.shortfall;
    const sameClass = sf.classId;

    // 1. Nearest bucket of same class (medium first)
    const fallbackBuckets = getNearestBucketOrder(sf.bucket);
    for (const fb of fallbackBuckets) {
      while (bins[sameClass][fb].length > 0 && needed > 0) {
        const img = bins[sameClass][fb].pop();
        if (img && !selectedSet.has(img.id)) {
          selectedSet.add(img.id);
          selectedImageIds.push(img.id);
          needed -= 1;
        }
      }
      if (needed === 0) break;
    }

    // 2. Other classes ordered by weight
    if (needed > 0) {
      const otherClasses = CLASS_IDS.filter((c) => c !== sameClass).sort(
        (a, b) => (weights[b] ?? 0) - (weights[a] ?? 0),
      );

      for (const oc of otherClasses) {
        for (const b of ['medium', 'easy', 'hard']) {
          while (bins[oc][b].length > 0 && needed > 0) {
            const img = bins[oc][b].pop();
            if (img && !selectedSet.has(img.id)) {
              selectedSet.add(img.id);
              selectedImageIds.push(img.id);
              needed -= 1;
            }
          }
          if (needed === 0) break;
        }
        if (needed === 0) break;
      }
    }
  }

  // Final shuffle of selected images so order is random
  rng.shuffle(selectedImageIds);

  const classCounts = /** @type {any} */ ({});
  for (const c of CLASS_IDS) {
    classCounts[c] = BUCKETS.reduce((sum, b) => sum + (bucketCounts[c]?.[b] ?? 0), 0);
  }

  return {
    imageIds: selectedImageIds,
    plan: {
      classCounts,
      bucketCounts,
      weights,
      errors,
      shortfalls,
    },
  };
}

/**
 * Select questions for the initial (baseline) diagnostic test.
 *
 * @param {import('@radiology/contracts').ImageMeta[]} imagePool - Catalog of images
 * @param {Partial<import('@radiology/contracts').EngineConfig>} [userConfig={}] - Configuration overrides
 * @returns {{ imageIds: string[], plan: any }}
 */
export function selectFirstTest(imagePool, userConfig = {}) {
  const config = EngineConfigSchema.parse(userConfig);
  const rng = createRng(config.seed);

  // Equal class weights for first test
  const uniformWeight = 1 / CLASS_IDS.length;
  /** @type {any} */
  const weights = {};
  for (const c of CLASS_IDS) {
    weights[c] = uniformWeight;
  }

  const classCounts = allocateClassCounts(config.totalQuestions, weights, config.minClassShare);

  const bucketCounts = allocateBucketCounts(classCounts, config.totalQuestions, [], {
    isFirstTest: true,
    firstTestBucketShares: config.firstTestBucketShares,
  });

  return pickImagesFromPool(imagePool, bucketCounts, weights, null, [], config, rng);
}
