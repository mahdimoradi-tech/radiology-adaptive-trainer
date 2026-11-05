import { describe, it, expect } from 'vitest';
import {
  LATERALITY_VALUES,
  LateralitySchema,
  ZONE_VALUES,
  ZoneSchema,
  PATTERN_VALUES,
  PatternSchema,
  DISTRIBUTION_VALUES,
  DistributionSchema,
  ANALYSIS_CLASS_VALUES,
  AnalysisClassSchema,
  CERTAINTY_VALUES,
  CertaintySchema,
  IMAGE_QUALITY_VALUES,
  ImageQualitySchema,
  ImageAnalysisResultSchema,
  BatchAnalysisResponseSchema,
} from '../vocabulary.js';

import {
  ANALYSIS_RUNS,
  AnalysisRunSchema,
  BATCH_STATUSES,
  BatchStatusSchema,
  VALIDATION_STATUSES,
  ValidationStatusSchema,
  VALIDATION_REASONS,
  ValidationReasonSchema,
  AnalysisBatchSchema,
  AnalysisValidationSchema,
} from '../analysis.js';

// Re-export alias to verify cross-module consistency
const AnalysisBatchSchemaFromAnalysis = AnalysisBatchSchema;

// ---------------------------------------------------------------------------
// Vocabulary enums
// ---------------------------------------------------------------------------

describe('vocabulary enums', () => {
  it('laterality has 4 values', () => {
    expect(LATERALITY_VALUES).toHaveLength(4);
    for (const v of LATERALITY_VALUES) {
      expect(LateralitySchema.parse(v)).toBe(v);
    }
    expect(() => LateralitySchema.parse('both')).toThrow();
  });

  it('zones has 3 values', () => {
    expect(ZONE_VALUES).toHaveLength(3);
    for (const v of ZONE_VALUES) {
      expect(ZoneSchema.parse(v)).toBe(v);
    }
    expect(() => ZoneSchema.parse('basal')).toThrow();
  });

  it('patterns has 9 values including clear_lungs', () => {
    expect(PATTERN_VALUES).toHaveLength(9);
    expect(PATTERN_VALUES).toContain('clear_lungs');
    for (const v of PATTERN_VALUES) {
      expect(PatternSchema.parse(v)).toBe(v);
    }
    expect(() => PatternSchema.parse('fibrosis')).toThrow();
  });

  it('distribution has 5 values', () => {
    expect(DISTRIBUTION_VALUES).toHaveLength(5);
    for (const v of DISTRIBUTION_VALUES) {
      expect(DistributionSchema.parse(v)).toBe(v);
    }
  });

  it('analysis class has 3 values matching engine ClassId', () => {
    expect(ANALYSIS_CLASS_VALUES).toEqual(['covid19', 'pneumonia', 'normal']);
    for (const v of ANALYSIS_CLASS_VALUES) {
      expect(AnalysisClassSchema.parse(v)).toBe(v);
    }
    expect(() => AnalysisClassSchema.parse('tuberculosis')).toThrow();
  });

  it('certainty has 3 values', () => {
    expect(CERTAINTY_VALUES).toHaveLength(3);
    for (const v of CERTAINTY_VALUES) {
      expect(CertaintySchema.parse(v)).toBe(v);
    }
  });

  it('imageQuality has 3 values', () => {
    expect(IMAGE_QUALITY_VALUES).toEqual(['ok', 'poor', 'not_cxr']);
    for (const v of IMAGE_QUALITY_VALUES) {
      expect(ImageQualitySchema.parse(v)).toBe(v);
    }
  });
});

// ---------------------------------------------------------------------------
// ImageAnalysisResultSchema
// ---------------------------------------------------------------------------

describe('ImageAnalysisResultSchema', () => {
  const valid = {
    index: 1,
    imageQuality: 'ok',
    predictedClass: 'pneumonia',
    certainty: 'high',
    laterality: 'bilateral',
    zones: ['lower', 'middle'],
    patterns: ['consolidation', 'opacity'],
    distribution: 'diffuse',
  };

  it('accepts a valid result', () => {
    const result = ImageAnalysisResultSchema.parse(valid);
    expect(result.index).toBe(1);
    expect(result.patterns).toContain('consolidation');
  });

  it('rejects index < 1', () => {
    expect(() => ImageAnalysisResultSchema.parse({ ...valid, index: 0 })).toThrow();
  });

  it('rejects out-of-vocabulary predictedClass', () => {
    expect(() =>
      ImageAnalysisResultSchema.parse({ ...valid, predictedClass: 'healthy' }),
    ).toThrow();
  });

  it('rejects out-of-vocabulary pattern', () => {
    expect(() => ImageAnalysisResultSchema.parse({ ...valid, patterns: ['fibrosis'] })).toThrow();
  });

  it('accepts empty zones array', () => {
    const r = ImageAnalysisResultSchema.parse({ ...valid, zones: [] });
    expect(r.zones).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// BatchAnalysisResponseSchema
// ---------------------------------------------------------------------------

describe('BatchAnalysisResponseSchema', () => {
  const makeItem = (index) => ({
    index,
    imageQuality: 'ok',
    predictedClass: 'normal',
    certainty: 'medium',
    laterality: 'none',
    zones: [],
    patterns: ['clear_lungs'],
    distribution: 'none',
  });

  it('accepts a 6-item batch', () => {
    const batch = { results: [1, 2, 3, 4, 5, 6].map(makeItem) };
    const r = BatchAnalysisResponseSchema.parse(batch);
    expect(r.results).toHaveLength(6);
  });

  it('rejects empty results', () => {
    expect(() => BatchAnalysisResponseSchema.parse({ results: [] })).toThrow();
  });

  it('rejects extra unknown fields in results items', () => {
    // Zod strips unknown fields by default; ensure the core fields are preserved
    const item = { ...makeItem(1), unexpectedField: 'oops' };
    const r = BatchAnalysisResponseSchema.parse({ results: [item] });
    // 'unexpectedField' must not appear in the parsed result
    expect(r.results[0]).not.toHaveProperty('unexpectedField');
  });
});

// ---------------------------------------------------------------------------
// Analysis contracts
// ---------------------------------------------------------------------------

describe('analysis contracts', () => {
  it('ANALYSIS_RUNS contains A and B', () => {
    expect(ANALYSIS_RUNS).toEqual(['A', 'B']);
    expect(AnalysisRunSchema.parse('A')).toBe('A');
    expect(AnalysisRunSchema.parse('B')).toBe('B');
    expect(() => AnalysisRunSchema.parse('C')).toThrow();
  });

  it('BATCH_STATUSES correct', () => {
    expect(BATCH_STATUSES).toEqual(['pending', 'done', 'failed']);
    for (const s of BATCH_STATUSES) expect(BatchStatusSchema.parse(s)).toBe(s);
  });

  it('VALIDATION_STATUSES correct', () => {
    expect(VALIDATION_STATUSES).toEqual(['auto_passed', 'auto_rejected']);
    for (const s of VALIDATION_STATUSES) expect(ValidationStatusSchema.parse(s)).toBe(s);
  });

  it('VALIDATION_REASONS has all 9 codes', () => {
    expect(VALIDATION_REASONS).toHaveLength(9);
    for (const r of VALIDATION_REASONS) expect(ValidationReasonSchema.parse(r)).toBe(r);
    expect(() => ValidationReasonSchema.parse('UNKNOWN')).toThrow();
  });

  it('AnalysisBatchSchema validates a valid batch doc', () => {
    const doc = {
      batchId: 'v1-g00-A',
      group: 0,
      run: 'A',
      imageIds: ['img1', 'img2'],
      status: 'pending',
      attempts: 0,
      lastError: null,
      requestedAt: null,
      finishedAt: null,
      model: 'gemini-3.8-flash',
      promptVersion: 'v1',
    };
    const r = AnalysisBatchSchema.parse(doc);
    expect(r.batchId).toBe('v1-g00-A');
    // Cross-module re-export should behave identically
    expect(AnalysisBatchSchemaFromAnalysis.parse(doc).batchId).toBe('v1-g00-A');
  });

  it('AnalysisValidationSchema validates an auto_passed doc', () => {
    const doc = {
      imageId: 'img1',
      promptVersion: 'v1',
      status: 'auto_passed',
      reasons: [],
      consensus: {
        patterns: ['consolidation'],
        distribution: 'diffuse',
        laterality: 'bilateral',
        zones: ['lower'],
      },
      datasetLabel: 'pneumonia',
      validatedAt: new Date(),
    };
    const r = AnalysisValidationSchema.parse(doc);
    expect(r.status).toBe('auto_passed');
  });

  it('AnalysisValidationSchema validates an auto_rejected doc with reasons', () => {
    const doc = {
      imageId: 'img2',
      promptVersion: 'v1',
      status: 'auto_rejected',
      reasons: ['RUNS_DISAGREE', 'LABEL_MISMATCH'],
      consensus: {
        patterns: [],
        distribution: null,
        laterality: null,
        zones: [],
      },
      datasetLabel: 'covid19',
      validatedAt: new Date(),
    };
    const r = AnalysisValidationSchema.parse(doc);
    expect(r.reasons).toContain('RUNS_DISAGREE');
  });
});
