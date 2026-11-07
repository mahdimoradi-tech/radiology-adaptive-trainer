import { CONTRACTS_VERSION } from '@radiology/contracts';

export const ENGINE_VERSION = '0.0.0';
export { CONTRACTS_VERSION };

export { largestRemainder, bucketOf } from './math.js';
export { confusionMatrix, rates, classWeights, perClassCounts } from './rates.js';
export { allocateClassCounts, allocateBucketCounts } from './allocation.js';
export { createRng } from './rng.js';
export { wilsonInterval, cohenKappa } from './stats/index.js';
export { selectFirstTest, selectNextTest } from './selection.js';
export { isMastered, selectTargetedQuestions } from './targeted.js';
export { VirtualResident } from './simulator/resident.js';
export {
  createSimulatorPool,
  createBalancedProbeTest,
  simulateResident,
  runSimulation,
} from './simulator/runner.js';
export { formatSimulationSummary } from './simulator/summary.js';
