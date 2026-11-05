import { describe, it, expect } from 'vitest';
import { validateAnalysis } from '../validate.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** @returns {import('../validate.js').ImageAnalysisResult} */
function goodOutput(overrides = {}) {
  return {
    index: 1,
    imageQuality: 'ok',
    predictedClass: 'pneumonia',
    certainty: 'high',
    laterality: 'bilateral',
    zones: ['lower'],
    patterns: ['consolidation', 'opacity'],
    distribution: 'diffuse',
    ...overrides,
  };
}

function runPair(aOverrides = {}, bOverrides = {}) {
  return {
    runA: goodOutput(aOverrides),
    runB: goodOutput(bOverrides),
    datasetLabel: 'pneumonia',
  };
}

// ---------------------------------------------------------------------------
// All-pass case
// ---------------------------------------------------------------------------

describe('validateAnalysis — auto_passed', () => {
  it('passes with two identical valid disease runs', () => {
    const result = validateAnalysis(runPair());
    expect(result.status).toBe('auto_passed');
    expect(result.reasons).toHaveLength(0);
  });

  it('passes for normal with correct patterns on both runs', () => {
    const result = validateAnalysis({
      runA: goodOutput({
        predictedClass: 'normal',
        patterns: ['clear_lungs'],
        laterality: 'none',
        zones: [],
        distribution: 'none',
      }),
      runB: goodOutput({
        predictedClass: 'normal',
        patterns: ['clear_lungs'],
        laterality: 'none',
        zones: [],
        distribution: 'none',
      }),
      datasetLabel: 'normal',
    });
    expect(result.status).toBe('auto_passed');
    expect(result.reasons).toHaveLength(0);
  });

  it('consensus: patterns = intersection, distribution/laterality agree', () => {
    const result = validateAnalysis({
      runA: goodOutput({
        patterns: ['consolidation', 'opacity'],
        distribution: 'diffuse',
        laterality: 'bilateral',
        zones: ['lower', 'middle'],
      }),
      runB: goodOutput({
        patterns: ['consolidation', 'ground_glass'],
        distribution: 'diffuse',
        laterality: 'bilateral',
        zones: ['lower', 'upper'],
      }),
      datasetLabel: 'pneumonia',
    });
    expect(result.status).toBe('auto_passed');
    // patterns intersection: ['consolidation']
    expect(result.consensus.patterns).toEqual(['consolidation']);
    expect(result.consensus.distribution).toBe('diffuse');
    expect(result.consensus.laterality).toBe('bilateral');
    // zones intersection: ['lower']
    expect(result.consensus.zones).toEqual(['lower']);
  });

  it('consensus: distribution null when runs disagree on distribution', () => {
    const result = validateAnalysis({
      runA: goodOutput({ distribution: 'diffuse' }),
      runB: goodOutput({ distribution: 'peripheral' }),
      datasetLabel: 'pneumonia',
    });
    expect(result.consensus.distribution).toBeNull();
  });

  it('consensus: laterality null when runs disagree', () => {
    const result = validateAnalysis({
      runA: goodOutput({ laterality: 'bilateral' }),
      runB: goodOutput({ laterality: 'left' }),
      datasetLabel: 'pneumonia',
    });
    expect(result.consensus.laterality).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Reason: RUN_MISSING
// ---------------------------------------------------------------------------

describe('validateAnalysis — RUN_MISSING', () => {
  it('rejects when runA is null', () => {
    const result = validateAnalysis({ runA: null, runB: goodOutput(), datasetLabel: 'pneumonia' });
    expect(result.status).toBe('auto_rejected');
    expect(result.reasons).toContain('RUN_MISSING');
  });

  it('rejects when runB is undefined', () => {
    const result = validateAnalysis({
      runA: goodOutput(),
      runB: undefined,
      datasetLabel: 'pneumonia',
    });
    expect(result.status).toBe('auto_rejected');
    expect(result.reasons).toContain('RUN_MISSING');
  });

  it('returns empty consensus when run missing', () => {
    const result = validateAnalysis({ runA: null, runB: null, datasetLabel: 'pneumonia' });
    expect(result.consensus.patterns).toHaveLength(0);
    expect(result.consensus.distribution).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Reason: SCHEMA_INVALID
// ---------------------------------------------------------------------------

describe('validateAnalysis — SCHEMA_INVALID', () => {
  it('rejects when runA output has an invalid predictedClass', () => {
    const bad = goodOutput({ predictedClass: 'tuberculosis' });
    const result = validateAnalysis({ runA: bad, runB: goodOutput(), datasetLabel: 'pneumonia' });
    expect(result.status).toBe('auto_rejected');
    expect(result.reasons).toContain('SCHEMA_INVALID');
  });

  it('rejects when runB output is not an object', () => {
    const result = validateAnalysis({
      runA: goodOutput(),
      runB: 'not-an-object',
      datasetLabel: 'pneumonia',
    });
    expect(result.status).toBe('auto_rejected');
    expect(result.reasons).toContain('SCHEMA_INVALID');
  });

  it('rejects when a pattern value is out of vocabulary', () => {
    const bad = goodOutput({ patterns: ['fibrosis'] });
    const result = validateAnalysis({ runA: bad, runB: goodOutput(), datasetLabel: 'pneumonia' });
    expect(result.reasons).toContain('SCHEMA_INVALID');
  });
});

// ---------------------------------------------------------------------------
// Reason: QUALITY_NOT_OK
// ---------------------------------------------------------------------------

describe('validateAnalysis — QUALITY_NOT_OK', () => {
  it('rejects when runA imageQuality is poor', () => {
    const result = validateAnalysis(runPair({ imageQuality: 'poor' }));
    expect(result.reasons).toContain('QUALITY_NOT_OK');
  });

  it('rejects when runB imageQuality is not_cxr', () => {
    const result = validateAnalysis(runPair({}, { imageQuality: 'not_cxr' }));
    expect(result.reasons).toContain('QUALITY_NOT_OK');
  });

  it('no QUALITY_NOT_OK when both are ok', () => {
    const result = validateAnalysis(runPair());
    expect(result.reasons).not.toContain('QUALITY_NOT_OK');
  });
});

// ---------------------------------------------------------------------------
// Reason: RUNS_DISAGREE
// ---------------------------------------------------------------------------

describe('validateAnalysis — RUNS_DISAGREE', () => {
  it('rejects when predictedClass differs', () => {
    const result = validateAnalysis(
      runPair({ predictedClass: 'covid19' }, { predictedClass: 'pneumonia' }),
    );
    expect(result.reasons).toContain('RUNS_DISAGREE');
  });

  it('no RUNS_DISAGREE when both predict same class', () => {
    const result = validateAnalysis(runPair());
    expect(result.reasons).not.toContain('RUNS_DISAGREE');
  });
});

// ---------------------------------------------------------------------------
// Reason: LABEL_MISMATCH
// ---------------------------------------------------------------------------

describe('validateAnalysis — LABEL_MISMATCH', () => {
  it('rejects when run A predictedClass != datasetLabel', () => {
    const result = validateAnalysis({
      runA: goodOutput({ predictedClass: 'covid19' }),
      runB: goodOutput({ predictedClass: 'covid19' }),
      datasetLabel: 'pneumonia',
    });
    expect(result.reasons).toContain('LABEL_MISMATCH');
  });

  it('no LABEL_MISMATCH when predictedClass == datasetLabel', () => {
    const result = validateAnalysis(runPair());
    expect(result.reasons).not.toContain('LABEL_MISMATCH');
  });
});

// ---------------------------------------------------------------------------
// Reason: RULE_CLEAR_EXCLUSIVE
// ---------------------------------------------------------------------------

describe('validateAnalysis — RULE_CLEAR_EXCLUSIVE', () => {
  it('rejects when runA has clear_lungs with another pattern', () => {
    const result = validateAnalysis(runPair({ patterns: ['clear_lungs', 'opacity'] }));
    expect(result.reasons).toContain('RULE_CLEAR_EXCLUSIVE');
  });

  it('rejects when runB has clear_lungs with another pattern', () => {
    const result = validateAnalysis(runPair({}, { patterns: ['clear_lungs', 'consolidation'] }));
    expect(result.reasons).toContain('RULE_CLEAR_EXCLUSIVE');
  });

  it('allows clear_lungs alone', () => {
    const result = validateAnalysis({
      runA: goodOutput({
        predictedClass: 'normal',
        patterns: ['clear_lungs'],
        laterality: 'none',
        zones: [],
        distribution: 'none',
      }),
      runB: goodOutput({
        predictedClass: 'normal',
        patterns: ['clear_lungs'],
        laterality: 'none',
        zones: [],
        distribution: 'none',
      }),
      datasetLabel: 'normal',
    });
    expect(result.reasons).not.toContain('RULE_CLEAR_EXCLUSIVE');
  });
});

// ---------------------------------------------------------------------------
// Reason: RULE_NORMAL_PATTERNS
// ---------------------------------------------------------------------------

describe('validateAnalysis — RULE_NORMAL_PATTERNS', () => {
  it('rejects when datasetLabel=normal and runA has patterns != [clear_lungs]', () => {
    const result = validateAnalysis({
      runA: goodOutput({
        predictedClass: 'normal',
        patterns: ['opacity'],
        laterality: 'none',
        zones: [],
        distribution: 'none',
      }),
      runB: goodOutput({
        predictedClass: 'normal',
        patterns: ['clear_lungs'],
        laterality: 'none',
        zones: [],
        distribution: 'none',
      }),
      datasetLabel: 'normal',
    });
    expect(result.reasons).toContain('RULE_NORMAL_PATTERNS');
  });

  it('no RULE_NORMAL_PATTERNS for disease labels', () => {
    const result = validateAnalysis(runPair());
    expect(result.reasons).not.toContain('RULE_NORMAL_PATTERNS');
  });
});

// ---------------------------------------------------------------------------
// Reason: RULE_DISEASE_NEEDS_PATTERN
// ---------------------------------------------------------------------------

describe('validateAnalysis — RULE_DISEASE_NEEDS_PATTERN', () => {
  it('rejects when pneumonia runA has only clear_lungs', () => {
    const result = validateAnalysis(runPair({ patterns: ['clear_lungs'] }));
    expect(result.reasons).toContain('RULE_DISEASE_NEEDS_PATTERN');
  });

  it('rejects when covid19 runB has empty patterns', () => {
    const result = validateAnalysis({
      runA: goodOutput({ predictedClass: 'covid19', patterns: ['ground_glass'] }),
      runB: goodOutput({ predictedClass: 'covid19', patterns: [] }),
      datasetLabel: 'covid19',
    });
    expect(result.reasons).toContain('RULE_DISEASE_NEEDS_PATTERN');
  });

  it('no RULE_DISEASE_NEEDS_PATTERN for normal label', () => {
    const result = validateAnalysis({
      runA: goodOutput({
        predictedClass: 'normal',
        patterns: ['clear_lungs'],
        laterality: 'none',
        zones: [],
        distribution: 'none',
      }),
      runB: goodOutput({
        predictedClass: 'normal',
        patterns: ['clear_lungs'],
        laterality: 'none',
        zones: [],
        distribution: 'none',
      }),
      datasetLabel: 'normal',
    });
    expect(result.reasons).not.toContain('RULE_DISEASE_NEEDS_PATTERN');
  });
});

// ---------------------------------------------------------------------------
// Reason: NO_CONSENSUS_PATTERN
// ---------------------------------------------------------------------------

describe('validateAnalysis — NO_CONSENSUS_PATTERN', () => {
  it('rejects when disease patterns A ∩ B is empty', () => {
    const result = validateAnalysis({
      runA: goodOutput({ patterns: ['consolidation'] }),
      runB: goodOutput({ patterns: ['opacity'] }),
      datasetLabel: 'pneumonia',
    });
    expect(result.reasons).toContain('NO_CONSENSUS_PATTERN');
  });

  it('no NO_CONSENSUS_PATTERN for normal label (uses fixed clear_lungs)', () => {
    const result = validateAnalysis({
      runA: goodOutput({
        predictedClass: 'normal',
        patterns: ['clear_lungs'],
        laterality: 'none',
        zones: [],
        distribution: 'none',
      }),
      runB: goodOutput({
        predictedClass: 'normal',
        patterns: ['clear_lungs'],
        laterality: 'none',
        zones: [],
        distribution: 'none',
      }),
      datasetLabel: 'normal',
    });
    expect(result.reasons).not.toContain('NO_CONSENSUS_PATTERN');
  });

  it('no NO_CONSENSUS_PATTERN when patterns share at least one value', () => {
    const result = validateAnalysis({
      runA: goodOutput({ patterns: ['consolidation', 'opacity'] }),
      runB: goodOutput({ patterns: ['consolidation', 'ground_glass'] }),
      datasetLabel: 'pneumonia',
    });
    expect(result.reasons).not.toContain('NO_CONSENSUS_PATTERN');
  });

  it('consensus.patterns for normal always = [clear_lungs]', () => {
    const result = validateAnalysis({
      runA: goodOutput({
        predictedClass: 'normal',
        patterns: ['clear_lungs'],
        laterality: 'none',
        zones: [],
        distribution: 'none',
      }),
      runB: goodOutput({
        predictedClass: 'normal',
        patterns: ['clear_lungs'],
        laterality: 'none',
        zones: [],
        distribution: 'none',
      }),
      datasetLabel: 'normal',
    });
    expect(result.consensus.patterns).toEqual(['clear_lungs']);
  });
});

// ---------------------------------------------------------------------------
// Multiple reasons can coexist
// ---------------------------------------------------------------------------

describe('validateAnalysis — multiple reasons', () => {
  it('accumulates RUNS_DISAGREE + LABEL_MISMATCH + RULE_DISEASE_NEEDS_PATTERN', () => {
    const result = validateAnalysis({
      runA: goodOutput({ predictedClass: 'covid19', patterns: ['clear_lungs'] }),
      runB: goodOutput({ predictedClass: 'normal', patterns: ['clear_lungs'] }),
      datasetLabel: 'pneumonia',
    });
    expect(result.reasons).toContain('RUNS_DISAGREE');
    expect(result.reasons).toContain('LABEL_MISMATCH');
    expect(result.reasons).toContain('RULE_DISEASE_NEEDS_PATTERN');
    expect(result.status).toBe('auto_rejected');
  });
});
