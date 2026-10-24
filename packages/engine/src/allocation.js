import { CLASS_IDS, BUCKETS } from '@radiology/contracts';
import { largestRemainder } from './math.js';
import { perClassCounts } from './rates.js';

/**
 * Allocate question counts across disease classes according to weights,
 * guaranteeing the minimum class share and an exact sum of N.
 *
 * @param {number} totalQuestions - Total questions N (>= 45)
 * @param {Record<import('@radiology/contracts').ClassId, number>} weights - Normalized class weights
 * @param {number} [minClassShare=0.20] - Minimum share per class
 * @param {readonly import('@radiology/contracts').ClassId[]} [classIds=CLASS_IDS] - Classes list
 * @returns {Record<import('@radiology/contracts').ClassId, number>}
 */
export function allocateClassCounts(
  totalQuestions,
  weights,
  minClassShare = 0.2,
  classIds = CLASS_IDS,
) {
  const minClass = Math.ceil(minClassShare * totalQuestions);
  const remainder = totalQuestions - classIds.length * minClass;

  const weightsArray = classIds.map((c) =>
    weights && weights[c] !== undefined ? weights[c] : 1 / classIds.length,
  );

  const remainderAlloc = largestRemainder(Math.max(0, remainder), weightsArray);

  /** @type {any} */
  const counts = {};
  classIds.forEach((c, idx) => {
    counts[c] = minClass + remainderAlloc[idx];
  });

  return counts;
}

/**
 * Allocate question counts across difficulty buckets for each class.
 *
 * @param {Record<import('@radiology/contracts').ClassId, number>} classCounts - Question counts per class
 * @param {number} totalQuestions - Total questions N
 * @param {import('@radiology/contracts').Response[]} [responses=[]] - Past response history
 * @param {Object} [options={}] - Allocation options
 * @param {number} [options.minBucketShare=0.04] - Minimum bucket share
 * @param {number} [options.alpha=1] - Laplace smoothing parameter
 * @param {boolean} [options.isFirstTest=false] - Whether this is a baseline test
 * @param {import('@radiology/contracts').FirstTestBucketShares} [options.firstTestBucketShares={ easy: 0.40, medium: 0.30, hard: 0.30 }] - Shares for first test
 * @param {readonly import('@radiology/contracts').Bucket[]} [options.buckets=BUCKETS] - Buckets
 * @param {readonly import('@radiology/contracts').ClassId[]} [options.classIds=CLASS_IDS] - Classes
 * @returns {Record<import('@radiology/contracts').ClassId, Record<import('@radiology/contracts').Bucket, number>>}
 */
export function allocateBucketCounts(classCounts, totalQuestions, responses = [], options = {}) {
  const {
    minBucketShare = 0.04,
    alpha = 1,
    isFirstTest = false,
    firstTestBucketShares = { easy: 0.4, medium: 0.3, hard: 0.3 },
    buckets = BUCKETS,
    classIds = CLASS_IDS,
  } = options;

  /** @type {any} */
  const result = {};

  if (isFirstTest || responses.length === 0) {
    // Baseline test: allocate by firstTestBucketShares
    const sharesArray = buckets.map((b) => firstTestBucketShares[b] ?? 1 / buckets.length);

    for (const c of classIds) {
      const Nc = classCounts[c] ?? 0;
      const bucketAlloc = largestRemainder(Nc, sharesArray);
      result[c] = {};
      buckets.forEach((b, idx) => {
        result[c][b] = bucketAlloc[idx];
      });
    }

    return result;
  }

  // Adaptive test: allocate based on incorrect rates IR_{c, b}
  const minBucket = Math.max(1, Math.round(minBucketShare * totalQuestions));
  const counts = perClassCounts(responses, classIds, buckets);

  for (const c of classIds) {
    const Nc = classCounts[c] ?? 0;
    const remainder = Math.max(0, Nc - buckets.length * minBucket);

    // Compute IR_{c,b} for each bucket
    const irValues = buckets.map((b) => {
      const bucketRecord = counts[c]?.byBucket[b];
      const incorrect = bucketRecord?.incorrect ?? 0;
      const total = bucketRecord?.total ?? 0;
      return (incorrect + alpha) / (total + 2 * alpha);
    });

    const sumIR = irValues.reduce((acc, v) => acc + v, 0);
    const weights =
      sumIR > 0 ? irValues.map((v) => v / sumIR) : buckets.map(() => 1 / buckets.length);

    const remainderAlloc = largestRemainder(remainder, weights);

    result[c] = {};
    buckets.forEach((b, idx) => {
      result[c][b] = minBucket + remainderAlloc[idx];
    });
  }

  return result;
}
