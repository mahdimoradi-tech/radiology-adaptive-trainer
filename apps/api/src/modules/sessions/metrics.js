import { CLASS_IDS, BUCKETS } from '@radiology/contracts';
import { confusionMatrix, rates, classWeights, isMastered } from './engine.adapter.js';

/**
 * Compute raw unsmoothed one-vs-rest metrics for a disease class.
 * (accuracy of a class = correct / questions of that class = recall)
 *
 * @param {Array<{ trueClass: import('@radiology/contracts').ClassId, answer: import('@radiology/contracts').ClassId }>} responses
 * @param {import('@radiology/contracts').ClassId} classId
 * @returns {import('@radiology/contracts').ClassMetrics}
 */
export function computeClassMetrics(responses, classId) {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;

  for (const r of responses) {
    if (r.trueClass === classId) {
      if (r.answer === classId) {
        tp += 1;
      } else {
        fn += 1;
      }
    } else {
      if (r.answer === classId) {
        fp += 1;
      } else {
        tn += 1;
      }
    }
  }

  const classQuestions = tp + fn;
  const accuracy = classQuestions > 0 ? tp / classQuestions : 0;
  const recall = accuracy;
  const precisionDenominator = tp + fp;
  const precision = precisionDenominator > 0 ? tp / precisionDenominator : 0;
  const f1Denominator = precision + recall;
  const f1 = f1Denominator > 0 ? (2 * precision * recall) / f1Denominator : 0;

  const negativeQuestions = fp + tn;
  const fpr = negativeQuestions > 0 ? fp / negativeQuestions : 0;
  const fnr = classQuestions > 0 ? fn / classQuestions : 0;

  return {
    tp,
    fp,
    fn,
    tn,
    accuracy,
    precision,
    recall,
    f1,
    fpr,
    fnr,
  };
}

/**
 * Extract top off-diagonal confusion pairs sorted descending by count.
 *
 * @param {Array<{ trueClass: import('@radiology/contracts').ClassId, answer: import('@radiology/contracts').ClassId }>} responses
 * @param {number} [limit=5]
 * @returns {Array<{ trueClass: import('@radiology/contracts').ClassId, predicted: import('@radiology/contracts').ClassId, count: number }>}
 */
export function topConfusions(responses, limit = 5) {
  const matrix = confusionMatrix(responses, CLASS_IDS);
  /** @type {Array<{ trueClass: import('@radiology/contracts').ClassId, predicted: import('@radiology/contracts').ClassId, count: number }>} */
  const confusions = [];

  for (const tc of CLASS_IDS) {
    for (const pred of CLASS_IDS) {
      if (tc !== pred && matrix[tc]?.[pred] > 0) {
        confusions.push({
          trueClass: tc,
          predicted: pred,
          count: matrix[tc][pred],
        });
      }
    }
  }

  confusions.sort((a, b) => b.count - a.count);
  return confusions.slice(0, limit);
}

/**
 * Build complete session report from stored session questions and recorded responses.
 *
 * @param {Object} params
 * @param {any} params.session - Mongoose session document or plain object
 * @param {Array<any>} params.responses - Response documents for this session
 * @param {number} [params.masteryThreshold=0.80] - Accuracy threshold
 * @returns {import('@radiology/contracts').SessionReport}
 */
export function buildReport({ session, responses, masteryThreshold = 0.8 }) {
  const answeredCount = responses.length;
  const unansweredCount = Math.max(0, session.size - answeredCount);

  let correctCount = 0;
  for (const r of responses) {
    if (r.correct ?? r.answer === r.trueClass) {
      correctCount += 1;
    }
  }
  const overallAccuracy = answeredCount > 0 ? correctCount / answeredCount : 0;

  const overall = {
    correct: correctCount,
    total: answeredCount,
    accuracy: overallAccuracy,
  };

  const confusion = confusionMatrix(responses, CLASS_IDS);

  /** @type {Record<import('@radiology/contracts').ClassId, import('@radiology/contracts').ClassMetrics>} */
  const perClass = /** @type {any} */ ({});
  /** @type {Record<import('@radiology/contracts').ClassId, boolean>} */
  const perClassMastered = /** @type {any} */ ({});

  for (const c of CLASS_IDS) {
    const metrics = computeClassMetrics(responses, c);
    perClass[c] = metrics;

    const classTotal = metrics.tp + metrics.fn;
    perClassMastered[c] = classTotal > 0 && metrics.accuracy >= masteryThreshold;
  }

  // byClassBucket correct / incorrect tallies
  /** @type {Record<import('@radiology/contracts').ClassId, Record<import('@radiology/contracts').Bucket, { correct: number, incorrect: number }>>} */
  const byClassBucket = /** @type {any} */ ({});
  for (const c of CLASS_IDS) {
    byClassBucket[c] = /** @type {any} */ ({});
    for (const b of BUCKETS) {
      byClassBucket[c][b] = { correct: 0, incorrect: 0 };
    }
  }

  for (const r of responses) {
    if (byClassBucket[r.trueClass]?.[r.bucket]) {
      if (r.answer === r.trueClass) {
        byClassBucket[r.trueClass][r.bucket].correct += 1;
      } else {
        byClassBucket[r.trueClass][r.bucket].incorrect += 1;
      }
    }
  }

  const mastered = isMastered(responses, masteryThreshold, CLASS_IDS);

  // Map review items from session.questions
  const responseMap = new Map();
  for (const r of responses) {
    responseMap.set(r.questionNo, r);
  }

  /** @type {import('@radiology/contracts').ReportItem[]} */
  const review = (session.questions || []).map((q) => {
    const resp = responseMap.get(q.no);
    return {
      no: q.no,
      imageUrl: `/api/images/${q.publicId}/file`,
      trueClass: q.trueClass,
      answer: resp ? resp.answer : null,
      correct: resp ? (resp.correct ?? resp.answer === q.trueClass) : null,
      bucket: q.bucket,
      difficulty: Number(q.difficulty.toFixed(2)),
    };
  });

  return {
    sessionId: String(session._id),
    index: session.index,
    kind: session.kind,
    size: session.size,
    answeredCount,
    unansweredCount,
    overall,
    confusion,
    perClass,
    byClassBucket,
    mastered,
    perClassMastered,
    plan: session.plan || {
      classCounts: { covid19: 0, pneumonia: 0, normal: 0 },
      bucketCounts: {
        covid19: { easy: 0, medium: 0, hard: 0 },
        pneumonia: { easy: 0, medium: 0, hard: 0 },
        normal: { easy: 0, medium: 0, hard: 0 },
      },
      weights: { covid19: 1 / 3, pneumonia: 1 / 3, normal: 1 / 3 },
      errors: null,
      shortfalls: [],
      deficit: 0,
    },
    review,
  };
}

/**
 * Build resident progress analysis across all historical sessions.
 *
 * @param {Object} params
 * @param {Array<any>} params.finishedSessions - Array of finished Session documents
 * @param {Array<any>} params.allFinishedResponses - Array of all responses from finished sessions
 * @returns {import('@radiology/contracts').Progress}
 */
export function buildProgress({ finishedSessions, allFinishedResponses }) {
  // Sort sessions chronologically by index
  const sortedSessions = [...finishedSessions].sort((a, b) => a.index - b.index);

  /** @type {import('@radiology/contracts').ProgressSessionPoint[]} */
  const sessionPoints = sortedSessions.map((s) => {
    const m = s.metrics || {};
    /** @type {Record<import('@radiology/contracts').ClassId, { accuracy: number, fpr: number, fnr: number }>} */
    const perClass = /** @type {any} */ ({});
    for (const c of CLASS_IDS) {
      perClass[c] = {
        accuracy: m.perClass?.[c]?.accuracy ?? 0,
        fpr: m.perClass?.[c]?.fpr ?? 0,
        fnr: m.perClass?.[c]?.fnr ?? 0,
      };
    }

    return {
      id: String(s._id),
      index: s.index,
      kind: s.kind,
      finishedAt: s.finishedAt || s.updatedAt || s.createdAt,
      overallAccuracy: m.overall?.accuracy ?? 0,
      perClass,
      mastered: Boolean(m.mastered),
    };
  });

  const currentErrors = allFinishedResponses.length > 0 ? rates(allFinishedResponses, 1) : null;
  const currentWeights = currentErrors
    ? classWeights(currentErrors)
    : { covid19: 1 / 3, pneumonia: 1 / 3, normal: 1 / 3 };

  const confusions = topConfusions(allFinishedResponses, 5);

  return {
    sessions: sessionPoints,
    currentWeights,
    currentErrors,
    topConfusions: confusions,
    totals: {
      sessionsFinished: sortedSessions.length,
      answered: allFinishedResponses.length,
    },
  };
}
