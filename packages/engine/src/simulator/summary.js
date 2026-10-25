/**
 * Generate a transparent, data-driven summary of simulation results.
 * Plainly reports which policy converged fastest without hard-coded assumptions.
 *
 * @param {Record<'fixed'|'random'|'adaptive', { policy: string, masteryRate: number, avgSessionsToMastery: number }>} results
 * @returns {string}
 */
export function formatSimulationSummary(results) {
  const policies = /** @type {const} */ (['fixed', 'random', 'adaptive']);
  const sorted = [...policies].sort(
    (a, b) => results[a].avgSessionsToMastery - results[b].avgSessionsToMastery,
  );
  const best = sorted[0];
  const bestMean = results[best].avgSessionsToMastery;
  const adaptiveMean = results.adaptive.avgSessionsToMastery;

  let text = `Data-driven summary: Policy ${best.toUpperCase()} achieved the lowest mean sessions-to-mastery (${bestMean.toFixed(2)} sessions, mastery rate: ${(results[best].masteryRate * 100).toFixed(1)}%).\n`;

  if (best === 'adaptive') {
    text += `Adaptive training converged faster on the balanced probe test compared to fixed (${results.fixed.avgSessionsToMastery.toFixed(2)}) and random (${results.random.avgSessionsToMastery.toFixed(2)}).`;
  } else {
    text += `Under the modeled learning assumptions, ADAPTIVE (${adaptiveMean.toFixed(2)} sessions) did not outperform ${best.toUpperCase()} (${bestMean.toFixed(2)} sessions) on the balanced probe test. Adaptive allocation concentrates exposures on error-prone classes, which improves targeted weakness recovery, but mastery on the balanced probe requires passing all classes simultaneously.`;
  }

  return text;
}
