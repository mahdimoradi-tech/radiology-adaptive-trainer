/**
 * Computes Wilson score interval for a binomial proportion.
 *
 * @param {number} k - Number of successes
 * @param {number} n - Total trials
 * @param {number} [z=1.96] - z-score (1.96 for ~95% confidence)
 * @returns {{ p: number | null, low: number | null, high: number | null }}
 */
export function wilsonInterval(k, n, z = 1.96) {
  if (typeof n !== 'number' || n <= 0 || typeof k !== 'number' || k < 0) {
    return { p: null, low: null, high: null };
  }

  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));

  const low = Math.max(0, center - half);
  const high = Math.min(1, center + half);

  return { p, low, high };
}
