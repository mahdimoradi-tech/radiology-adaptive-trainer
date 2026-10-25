import { CLASS_IDS, BUCKETS } from '@radiology/contracts';
import { selectFirstTest, selectNextTest } from '../selection.js';
import { rates } from '../rates.js';
import { isMastered } from '../targeted.js';
import { createRng } from '../rng.js';
import { VirtualResident } from './resident.js';

/**
 * Generate a synthetic 1,500-image catalog for simulation (500 per class).
 *
 * @returns {import('@radiology/contracts').ImageMeta[]}
 */
export function createSimulatorPool() {
  const pool = [];
  let id = 1;

  for (const c of CLASS_IDS) {
    const confused = c === 'covid19' ? 'pneumonia' : 'covid19';
    for (const b of BUCKETS) {
      const difficultyBase = b === 'easy' ? 0.2 : b === 'medium' ? 0.5 : 0.8;
      // ~167 images per bucket = ~500 per class
      for (let i = 0; i < 167; i++) {
        pool.push({
          id: `sim_img_${id++}`,
          trueClass: c,
          difficulty: difficultyBase,
          bucket: b,
          confusedWith: confused,
        });
      }
    }
  }

  return pool;
}

/**
 * Generate a fixed balanced probe test (60 items: 20 per class, balanced buckets).
 * Used to measure trainee mastery impartially across all policies without skill updates.
 *
 * @param {import('@radiology/contracts').ImageMeta[]} pool - Full catalog pool
 * @param {number} seed - Deterministic resident seed
 * @returns {import('@radiology/contracts').ImageMeta[]} 60-image balanced probe test
 */
export function createBalancedProbeTest(pool, seed) {
  const rng = createRng((seed ^ 0xdeadbeef) >>> 0);
  const probeItems = [];

  for (const c of CLASS_IDS) {
    const classPool = pool.filter((img) => img.trueClass === c);
    for (const b of BUCKETS) {
      // 7 easy, 7 medium, 6 hard = 20 items per class
      const quota = b === 'hard' ? 6 : 7;
      const bucketImages = classPool.filter((img) => img.bucket === b);
      rng.shuffle(bucketImages);
      probeItems.push(...bucketImages.slice(0, quota));
    }
  }

  return rng.shuffle(probeItems);
}

/**
 * Select questions for fixed policy (always equal classes, 40/30/30 buckets).
 *
 * @param {import('@radiology/contracts').ImageMeta[]} pool - Pool
 * @param {string[]} shownIds - Already shown
 * @param {number} totalQuestions - N
 * @param {ReturnType<typeof createRng>} rng - RNG
 * @returns {string[]}
 */
function selectFixedQuestions(pool, shownIds, totalQuestions, rng) {
  const shownSet = new Set(shownIds);
  const eligible = pool.filter((img) => !shownSet.has(img.id));
  rng.shuffle(eligible);

  const perClass = Math.floor(totalQuestions / CLASS_IDS.length);
  const selected = [];

  for (const c of CLASS_IDS) {
    const classImages = eligible.filter((img) => img.trueClass === c);
    for (let i = 0; i < perClass && classImages.length > 0; i++) {
      const picked = classImages.pop();
      if (picked) selected.push(picked.id);
    }
  }

  // Fill remainder if needed
  while (selected.length < totalQuestions && eligible.length > 0) {
    const img = eligible.pop();
    if (img && !selected.includes(img.id)) {
      selected.push(img.id);
    }
  }

  return rng.shuffle(selected);
}

/**
 * Select questions for random policy (uniform random sample without repeats).
 *
 * @param {import('@radiology/contracts').ImageMeta[]} pool - Pool
 * @param {string[]} shownIds - Already shown
 * @param {number} totalQuestions - N
 * @param {ReturnType<typeof createRng>} rng - RNG
 * @returns {string[]}
 */
function selectRandomQuestions(pool, shownIds, totalQuestions, rng) {
  const shownSet = new Set(shownIds);
  const eligible = pool.filter((img) => !shownSet.has(img.id));
  rng.shuffle(eligible);
  return eligible.slice(0, totalQuestions).map((img) => img.id);
}

/**
 * Simulate a single virtual resident through training sessions.
 * Mastery is measured after each training session on a fixed balanced probe test.
 *
 * @param {Object} params
 * @param {'fixed' | 'random' | 'adaptive'} params.policy
 * @param {import('@radiology/contracts').ImageMeta[]} params.pool
 * @param {Object} [params.residentParams]
 * @param {Object} [params.engineConfig]
 * @param {number} [params.maxSessions=12]
 * @param {number} params.seed
 * @returns {{ policy: string, mastered: boolean, sessionsToMastery: number, finalFpr: Record<string, number>, finalFnr: Record<string, number> }}
 */
export function simulateResident({
  policy,
  pool,
  residentParams = {},
  engineConfig = {},
  maxSessions = 12,
  seed,
}) {
  const resident = new VirtualResident(residentParams);
  const totalQuestions = engineConfig.totalQuestions ?? 60;
  const masteryThreshold = engineConfig.masteryThreshold ?? 0.8;

  // Fixed balanced probe test generated once per resident seed
  const probeTest = createBalancedProbeTest(pool, seed);

  const allHistory = [];
  let latestProbeResponses = [];
  let sessionsCompleted = maxSessions;
  let mastered = false;

  const poolMap = new Map(pool.map((img) => [img.id, img]));

  for (let s = 1; s <= maxSessions; s++) {
    const policyCode = policy === 'adaptive' ? 1 : policy === 'random' ? 2 : 3;
    const sessionRng = createRng((seed * 31 + s * 997 + policyCode) >>> 0);

    let imageIds;
    if (policy === 'adaptive') {
      const result =
        s === 1
          ? selectFirstTest(pool, {
              ...engineConfig,
              seed: sessionRng.next() * 1e9,
            })
          : selectNextTest(pool, allHistory, {
              ...engineConfig,
              seed: sessionRng.next() * 1e9,
            });
      imageIds = result.imageIds;
    } else if (policy === 'random') {
      const shownIds = allHistory.map((r) => r.imageId);
      imageIds = selectRandomQuestions(pool, shownIds, totalQuestions, sessionRng);
    } else {
      // fixed
      const shownIds = allHistory.map((r) => r.imageId);
      imageIds = selectFixedQuestions(pool, shownIds, totalQuestions, sessionRng);
    }

    // Trainee answers training questions and updates diagnostic skills
    for (const imgId of imageIds) {
      const img = poolMap.get(imgId);
      if (!img) continue;

      const ans = resident.answer(img, sessionRng, true);
      const resp = {
        sessionId: `sess_${s}`,
        imageId: img.id,
        trueClass: img.trueClass,
        answer: ans,
        bucket: img.bucket,
      };
      allHistory.push(resp);
    }

    // Impartial evaluation: assess mastery on the fixed balanced probe test (skills NOT updated)
    const probeRng = createRng((seed * 7919 + s * 1013) >>> 0);
    latestProbeResponses = probeTest.map((img) => ({
      sessionId: `probe_${s}`,
      imageId: img.id,
      trueClass: img.trueClass,
      answer: resident.answer(img, probeRng, false),
      bucket: img.bucket,
    }));

    if (isMastered(latestProbeResponses, masteryThreshold)) {
      mastered = true;
      sessionsCompleted = s;
      break;
    }
  }

  const finalRates = rates(latestProbeResponses, 1);
  const finalFpr = /** @type {any} */ ({});
  const finalFnr = /** @type {any} */ ({});
  for (const c of CLASS_IDS) {
    finalFpr[c] = finalRates[c].fpr;
    finalFnr[c] = finalRates[c].fnr;
  }

  return {
    policy,
    mastered,
    sessionsToMastery: sessionsCompleted,
    finalFpr,
    finalFnr,
  };
}

/**
 * Run comprehensive simulation comparing fixed, random, and adaptive policies.
 * Uses a paired benchmark: each resident seed is tested identically across policies.
 *
 * @param {Object} [options={}]
 * @param {number} [options.numResidents=50] - Number of residents per policy
 * @param {number} [options.maxSessions=12] - Max sessions allowed
 * @param {number} [options.seed=42] - Master simulation seed
 * @param {Object} [options.engineConfig] - Engine config options
 * @returns {Record<'fixed' | 'random' | 'adaptive', { policy: string, masteryRate: number, avgSessionsToMastery: number, avgFpr: Record<string, number>, avgFnr: Record<string, number> }>}
 */
export function runSimulation(options = {}) {
  const numResidents = options.numResidents ?? 50;
  const maxSessions = options.maxSessions ?? 12;
  const masterSeed = options.seed ?? 42;
  const pool = createSimulatorPool();

  const policies = /** @type {const} */ (['fixed', 'random', 'adaptive']);
  /** @type {any} */
  const results = {};

  for (const policy of policies) {
    const residentResults = [];
    for (let i = 0; i < numResidents; i++) {
      // Identical resident initial seed for paired benchmark comparison
      const residentSeed = (masterSeed * 10007 + i * 37) >>> 0;
      const res = simulateResident({
        policy,
        pool,
        residentParams: {
          initialSkills: { covid19: 0.4, pneumonia: 0.5, normal: 0.6 },
          learningRate: 0.03,
          difficultyPenalty: 0.25,
        },
        engineConfig: options.engineConfig ?? { totalQuestions: 60, masteryThreshold: 0.8 },
        maxSessions,
        seed: residentSeed,
      });
      residentResults.push(res);
    }

    const masteredCount = residentResults.filter((r) => r.mastered).length;
    const avgSessions =
      residentResults.reduce((acc, r) => acc + r.sessionsToMastery, 0) / numResidents;

    const avgFpr = /** @type {any} */ ({});
    const avgFnr = /** @type {any} */ ({});
    for (const c of CLASS_IDS) {
      avgFpr[c] = residentResults.reduce((acc, r) => acc + r.finalFpr[c], 0) / numResidents;
      avgFnr[c] = residentResults.reduce((acc, r) => acc + r.finalFnr[c], 0) / numResidents;
    }

    results[policy] = {
      policy,
      masteryRate: masteredCount / numResidents,
      avgSessionsToMastery: avgSessions,
      avgFpr,
      avgFnr,
    };
  }

  return results;
}
