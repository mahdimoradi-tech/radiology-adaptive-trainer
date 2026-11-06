import { CLASS_IDS, MASTERY_THRESHOLD } from '@radiology/contracts';
import { largestRemainder } from './math.js';
import { confusionMatrix } from './rates.js';
import { createRng } from './rng.js';

/**
 * Check if the resident has achieved mastery in the latest session.
 * Mastery requires per-class accuracy >= threshold for ALL classes,
 * and every class must have at least one question in the session.
 *
 * @param {import('@radiology/contracts').Response[]} latestSessionResponses - Responses from latest test
 * @param {number} [threshold=MASTERY_THRESHOLD] - Accuracy threshold (default 0.80)
 * @param {readonly import('@radiology/contracts').ClassId[]} [classIds=CLASS_IDS] - Classes list
 * @returns {boolean}
 */
export function isMastered(
  latestSessionResponses,
  threshold = MASTERY_THRESHOLD,
  classIds = CLASS_IDS,
) {
  if (!latestSessionResponses || latestSessionResponses.length === 0) {
    return false;
  }

  for (const c of classIds) {
    const classResponses = latestSessionResponses.filter((r) => r.trueClass === c);
    if (classResponses.length === 0) {
      return false;
    }

    const correctCount = classResponses.filter((r) => r.answer === c).length;
    const accuracy = correctCount / classResponses.length;

    if (accuracy < threshold) {
      return false;
    }
  }

  return true;
}

/**
 * Select targeted practice questions from the question bank matching
 * the resident's error confusion pairs.
 *
 * @param {import('@radiology/contracts').QuestionBankItem[]} bank - Question bank catalog
 * @param {import('@radiology/contracts').Response[]} [history=[]] - Resident response history (contract-shaped)
 * @param {Object} [config={}] - Selection configuration
 * @param {number|string} [config.seed] - Seed for PRNG
 * @param {number} [config.alpha=1] - Laplace smoothing parameter
 * @param {number} [n=10] - Number of questions to select
 * @param {string[]|Set<string>} [answeredQuestionIds=[]] - Question IDs already answered by user
 * @param {readonly import('@radiology/contracts').ClassId[]} [classIds=CLASS_IDS] - Classes list
 * @returns {{ questionIds: string[], plan: any }}
 */
export function selectTargetedQuestions(
  bank,
  history = [],
  config = {},
  n = 10,
  answeredQuestionIds = [],
  classIds = CLASS_IDS,
) {
  const seed = config.seed ?? 123456789;
  const alpha = config.alpha ?? 1;
  const rng = createRng(seed);

  // Exclude previously answered question IDs
  const answeredSet =
    answeredQuestionIds instanceof Set ? answeredQuestionIds : new Set(answeredQuestionIds || []);

  const eligibleBank = bank.filter((q) => q.status === 'approved' && !answeredSet.has(q.id));

  // Generate 6 off-diagonal confusion pairs
  /** @type {Array<{ key: string, trueClass: import('@radiology/contracts').ClassId, confusedWith: import('@radiology/contracts').ClassId, weight: number }>} */
  const pairs = [];
  const cm = confusionMatrix(history, classIds);

  for (const tc of classIds) {
    for (const ans of classIds) {
      if (tc !== ans) {
        const count = cm[tc]?.[ans] ?? 0;
        pairs.push({
          key: `${tc}->${ans}`,
          trueClass: tc,
          confusedWith: ans,
          weight: count + alpha,
        });
      }
    }
  }

  const sumWeights = pairs.reduce((acc, p) => acc + p.weight, 0);
  const pairWeights = pairs.map((p) => p.weight / sumWeights);

  const countsPerPair = largestRemainder(n, pairWeights);

  /** @type {Record<string, number>} */
  const planCounts = {};
  pairs.forEach((p, idx) => {
    planCounts[p.key] = countsPerPair[idx];
  });

  const selectedSet = new Set();
  const selectedQuestionIds = [];
  const shortfalls = [];

  // Group eligible questions by pair
  /** @type {Record<string, import('@radiology/contracts').QuestionBankItem[]>} */
  const pairBins = {};
  for (const p of pairs) {
    pairBins[p.key] = eligibleBank.filter(
      (q) => q.pair.trueClass === p.trueClass && q.pair.confusedWith === p.confusedWith,
    );
    rng.shuffle(pairBins[p.key]);
  }

  // Pass 1: select exact pair matches
  for (const p of pairs) {
    const requested = planCounts[p.key];
    let availableCount = 0;

    while (pairBins[p.key].length > 0 && availableCount < requested) {
      const q = pairBins[p.key].pop();
      if (q && !selectedSet.has(q.id)) {
        selectedSet.add(q.id);
        selectedQuestionIds.push(q.id);
        availableCount += 1;
      }
    }

    const shortfall = requested - availableCount;
    if (shortfall > 0) {
      shortfalls.push({
        pair: p.key,
        trueClass: p.trueClass,
        confusedWith: p.confusedWith,
        requested,
        available: availableCount,
        shortfall,
      });
    }
  }

  // Pass 2: fill shortfalls from matching trueClass, then any approved item
  for (const sf of shortfalls) {
    let needed = sf.shortfall;

    // 1. Same trueClass
    const sameClassCandidates = eligibleBank.filter(
      (q) => q.pair.trueClass === sf.trueClass && !selectedSet.has(q.id),
    );
    rng.shuffle(sameClassCandidates);

    while (sameClassCandidates.length > 0 && needed > 0) {
      const q = sameClassCandidates.pop();
      if (q && !selectedSet.has(q.id)) {
        selectedSet.add(q.id);
        selectedQuestionIds.push(q.id);
        needed -= 1;
      }
    }

    // 2. Any approved eligible question
    if (needed > 0) {
      const anyCandidates = eligibleBank.filter((q) => !selectedSet.has(q.id));
      rng.shuffle(anyCandidates);

      while (anyCandidates.length > 0 && needed > 0) {
        const q = anyCandidates.pop();
        if (q && !selectedSet.has(q.id)) {
          selectedSet.add(q.id);
          selectedQuestionIds.push(q.id);
          needed -= 1;
        }
      }
    }
  }

  // Final shuffle of question IDs
  rng.shuffle(selectedQuestionIds);

  return {
    questionIds: selectedQuestionIds,
    plan: {
      pairs: pairs.map((p) => p.key),
      counts: planCounts,
      shortfalls,
    },
  };
}
