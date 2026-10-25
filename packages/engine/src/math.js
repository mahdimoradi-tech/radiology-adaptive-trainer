/**
 * Allocate integers that sum exactly to total, based on given weights.
 * Uses the Largest Remainder (Hamilton-Hare) method.
 *
 * @param {number} total - Total count to distribute (integer >= 0)
 * @param {number[]} weights - Non-negative weights for each bin
 * @returns {number[]} Array of integers summing to total
 */
export function largestRemainder(total, weights) {
  if (total <= 0 || weights.length === 0) {
    return weights.map(() => 0);
  }

  const sumWeights = weights.reduce((acc, w) => acc + w, 0);
  const normalizedWeights =
    sumWeights > 0 ? weights.map((w) => w / sumWeights) : weights.map(() => 1 / weights.length);

  const exacts = normalizedWeights.map((w) => total * w);
  const floored = exacts.map((e) => Math.floor(e));
  const allocated = floored.reduce((acc, f) => acc + f, 0);
  const remainder = total - allocated;

  // Fraction parts with original indices for deterministic tie breaking
  const fractions = exacts.map((e, idx) => ({
    frac: e - floored[idx],
    idx,
  }));

  // Sort descending by fractional part; break ties by lowest index
  fractions.sort((a, b) => {
    const diff = b.frac - a.frac;
    if (Math.abs(diff) > 1e-9) {
      return diff;
    }
    return a.idx - b.idx;
  });

  const result = [...floored];
  for (let i = 0; i < remainder; i++) {
    result[fractions[i].idx] += 1;
  }

  return result;
}

/**
 * Determine difficulty bucket from continuous score and cut-off thresholds.
 *
 * @param {number} difficulty - Continuous difficulty in [0, 1]
 * @param {{ easyMax: number, mediumMax: number }} thresholds - Difficulty cutoffs
 * @returns {'easy' | 'medium' | 'hard'}
 */
export function bucketOf(difficulty, thresholds) {
  if (difficulty < thresholds.easyMax) {
    return 'easy';
  }
  if (difficulty < thresholds.mediumMax) {
    return 'medium';
  }
  return 'hard';
}
