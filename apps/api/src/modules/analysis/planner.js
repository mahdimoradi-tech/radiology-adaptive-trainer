/**
 * @fileoverview Batch planner for T08a analysis pipeline.
 *
 * Rules (from task file):
 *   - Batch size: 6 images per API call.
 *   - Each batch MIXES classes (the whole set is shuffled once with the seed,
 *     then cut into groups of 6). No single-class batches when 3 classes exist.
 *   - Run B uses the SAME 6 images in a reversed-then-rotated order.
 *   - batchId format: "v1-g07-A" (promptVersion-group0padded2-run)
 *   - Idempotent: if the batch doc already exists in the DB it is left unchanged.
 *
 * This module has NO side effects. The script that calls it handles DB writes.
 */

// ---------------------------------------------------------------------------
// Tiny seeded PRNG — Mulberry32 (same as sampling.js — no shared import)
// ---------------------------------------------------------------------------

/** @param {number} seed @returns {() => number} */
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {string} str @returns {number} */
function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** @template T @param {T[]} arr @param {() => number} rng @returns {T[]} */
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Run B ordering: reversed-then-rotated by 1 position
// ---------------------------------------------------------------------------

/**
 * Produce the Run B image order from the Run A order.
 * Strategy: reverse the array, then rotate left by 1 (move first element to end).
 * This guarantees the order differs from A and is deterministic.
 * @template T
 * @param {T[]} runAOrder
 * @returns {T[]}
 */
export function runBOrder(runAOrder) {
  if (runAOrder.length === 0) return [];
  const reversed = [...runAOrder].reverse();
  // rotate left by 1
  return [...reversed.slice(1), reversed[0]];
}

// ---------------------------------------------------------------------------
// Main: planBatches
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} AnalysisSetEntry
 * @property {string} imageId
 * @property {string} trueClass
 * @property {string} bucket
 * @property {string} source
 * @property {string} stratum
 */

/**
 * @typedef {Object} BatchPlan
 * @property {string} batchId
 * @property {number} group
 * @property {'A' | 'B'} run
 * @property {string[]} imageIds
 * @property {'pending'} status
 * @property {number} attempts
 * @property {null} lastError
 * @property {null} requestedAt
 * @property {null} finishedAt
 * @property {string} model
 * @property {string} promptVersion
 */

/**
 * Plan all batches for both run A and run B from the analysis set.
 *
 * @param {AnalysisSetEntry[]} analysisSet - The 120-image set from selectAnalysisSet()
 * @param {object} [opts]
 * @param {string} [opts.seed='analysis-v1'] - PRNG seed (must match the sampling seed)
 * @param {number} [opts.batchSize=6] - Images per batch
 * @param {string} [opts.promptVersion='v1'] - Prompt version prefix in batchId
 * @param {string} [opts.model='gemini-3.8-flash'] - Model identifier
 * @returns {BatchPlan[]} All planned batches (run A, then run B for each group)
 */
export function planBatches(analysisSet, opts = {}) {
  const seed = opts.seed ?? 'analysis-v1';
  const batchSize = opts.batchSize ?? 6;
  const promptVersion = opts.promptVersion ?? 'v1';
  const model = opts.model ?? 'gemini-3.8-flash';

  // Shuffle the whole set once to mix classes across batches
  const rng = mulberry32(hashSeed(seed + ':plan'));
  const shuffled = shuffle([...analysisSet], rng);

  /** @type {BatchPlan[]} */
  const plans = [];

  const numGroups = Math.ceil(shuffled.length / batchSize);
  for (let g = 0; g < numGroups; g++) {
    const slice = shuffled.slice(g * batchSize, (g + 1) * batchSize);
    const runAIds = slice.map((e) => e.imageId);
    const runBIds = runBOrder(runAIds);

    const groupLabel = String(g).padStart(2, '0');

    plans.push({
      batchId: `${promptVersion}-g${groupLabel}-A`,
      group: g,
      run: 'A',
      imageIds: runAIds,
      status: 'pending',
      attempts: 0,
      lastError: null,
      requestedAt: null,
      finishedAt: null,
      model,
      promptVersion,
    });

    plans.push({
      batchId: `${promptVersion}-g${groupLabel}-B`,
      group: g,
      run: 'B',
      imageIds: runBIds,
      status: 'pending',
      attempts: 0,
      lastError: null,
      requestedAt: null,
      finishedAt: null,
      model,
      promptVersion,
    });
  }

  return plans;
}
