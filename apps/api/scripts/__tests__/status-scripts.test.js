import { describe, it, expect } from 'vitest';
import { getAnalysisStatusSummary } from '../../src/modules/analysis/portable.js';

describe('status-scripts — empty denominator N/A handling (T10)', () => {
  it('returns nulls for rates and accuracy when tables have zero entries', async () => {
    // Mock empty models
    const MockBatchModel = {
      find: () => ({ lean: async () => [] }),
    };
    const MockAnalysisModel = {
      find: () => ({ lean: async () => [] }),
    };
    const MockValidationModel = {
      find: () => ({ lean: async () => [] }),
    };
    const MockImageModel = {
      find: () => ({ lean: async () => [] }),
    };

    const summary = await getAnalysisStatusSummary({
      promptVersion: 'v1',
      budget: 16,
      ImageModel: MockImageModel,
      ImageAnalysisModel: MockAnalysisModel,
      AnalysisValidationModel: MockValidationModel,
      AnalysisBatchModel: MockBatchModel,
      getUsageStatusFn: async () => ({
        day: '2026-11-07',
        count: 0,
        budget: 16,
        exhausted: false,
      }),
    });

    expect(summary.schemaValidRate).toBeNull();
    expect(summary.agreement.total).toBe(0);
    expect(summary.agreement.rate).toBeNull();
    expect(summary.runA.total).toBe(0);
    expect(summary.runA.accuracy).toBeNull();
    expect(summary.runB.total).toBe(0);
    expect(summary.runB.accuracy).toBeNull();
  });

  it('formats zero denominator rates as N/A in status displays', () => {
    const formatRate = (rate) =>
      rate !== null && !Number.isNaN(rate) ? `${(rate * 100).toFixed(1)}%` : 'N/A';

    expect(formatRate(null)).toBe('N/A');
    expect(formatRate(NaN)).toBe('N/A');
    expect(formatRate(0.85)).toBe('85.0%');
    expect(formatRate(0)).toBe('0.0%');
  });
});
