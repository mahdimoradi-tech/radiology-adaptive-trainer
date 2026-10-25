import { CLASS_IDS, BUCKETS } from '@radiology/contracts';

/**
 * Build 3x3 confusion matrix counts: matrix[trueClass][answer].
 *
 * @param {import('@radiology/contracts').Response[]} responses - Response history
 * @param {readonly import('@radiology/contracts').ClassId[]} [classIds=CLASS_IDS] - Classes
 * @returns {Record<import('@radiology/contracts').ClassId, Record<import('@radiology/contracts').ClassId, number>>}
 */
export function confusionMatrix(responses, classIds = CLASS_IDS) {
  /** @type {any} */
  const matrix = {};
  for (const tc of classIds) {
    matrix[tc] = {};
    for (const ans of classIds) {
      matrix[tc][ans] = 0;
    }
  }

  for (const r of responses) {
    if (matrix[r.trueClass] && matrix[r.trueClass][r.answer] !== undefined) {
      matrix[r.trueClass][r.answer] += 1;
    }
  }

  return matrix;
}

/**
 * Compute one-vs-rest metrics per class with Laplace smoothing.
 *
 * @param {import('@radiology/contracts').Response[]} responses - Response history
 * @param {number} [alpha=1] - Laplace smoothing parameter
 * @param {readonly import('@radiology/contracts').ClassId[]} [classIds=CLASS_IDS] - Classes
 * @returns {Record<import('@radiology/contracts').ClassId, { tp: number, fn: number, fp: number, tn: number, fnr: number, fpr: number, error: number }>}
 */
export function rates(responses, alpha = 1, classIds = CLASS_IDS) {
  /** @type {any} */
  const result = {};

  for (const c of classIds) {
    let tp = 0;
    let fn = 0;
    let fp = 0;
    let tn = 0;

    for (const r of responses) {
      if (r.trueClass === c) {
        if (r.answer === c) {
          tp += 1;
        } else {
          fn += 1;
        }
      } else {
        if (r.answer === c) {
          fp += 1;
        } else {
          tn += 1;
        }
      }
    }

    const fnr = (fn + alpha) / (tp + fn + 2 * alpha);
    const fpr = (fp + alpha) / (fp + tn + 2 * alpha);
    const error = fnr + fpr;

    result[c] = { tp, fn, fp, tn, fnr, fpr, error };
  }

  return result;
}

/**
 * Compute normalized class weights from error rates.
 * If total error is 0, distributes weights uniformly (1 / N).
 *
 * @param {Record<import('@radiology/contracts').ClassId, { error: number }>} ratesResult - Per-class rates
 * @param {readonly import('@radiology/contracts').ClassId[]} [classIds=CLASS_IDS] - Classes
 * @returns {Record<import('@radiology/contracts').ClassId, number>}
 */
export function classWeights(ratesResult, classIds = CLASS_IDS) {
  const totalError = classIds.reduce((sum, c) => sum + (ratesResult[c]?.error || 0), 0);

  /** @type {any} */
  const weights = {};

  if (totalError <= 0) {
    const uniform = 1 / classIds.length;
    for (const c of classIds) {
      weights[c] = uniform;
    }
    return weights;
  }

  for (const c of classIds) {
    weights[c] = (ratesResult[c]?.error || 0) / totalError;
  }

  return weights;
}

/**
 * Tallies total and incorrect responses per class and per bucket.
 *
 * @param {import('@radiology/contracts').Response[]} responses - Response history
 * @param {readonly import('@radiology/contracts').ClassId[]} [classIds=CLASS_IDS] - Classes
 * @param {readonly import('@radiology/contracts').Bucket[]} [buckets=BUCKETS] - Buckets
 * @returns {Record<import('@radiology/contracts').ClassId, { total: number, incorrect: number, byBucket: Record<import('@radiology/contracts').Bucket, { total: number, incorrect: number }> }>}
 */
export function perClassCounts(responses, classIds = CLASS_IDS, buckets = BUCKETS) {
  /** @type {any} */
  const counts = {};

  for (const c of classIds) {
    const byBucket = /** @type {any} */ ({});
    for (const b of buckets) {
      byBucket[b] = { total: 0, incorrect: 0 };
    }
    counts[c] = { total: 0, incorrect: 0, byBucket };
  }

  for (const r of responses) {
    const classRecord = counts[r.trueClass];
    if (!classRecord) continue;

    classRecord.total += 1;
    const isWrong = r.answer !== r.trueClass;
    if (isWrong) {
      classRecord.incorrect += 1;
    }

    if (classRecord.byBucket[r.bucket]) {
      classRecord.byBucket[r.bucket].total += 1;
      if (isWrong) {
        classRecord.byBucket[r.bucket].incorrect += 1;
      }
    }
  }

  return counts;
}
