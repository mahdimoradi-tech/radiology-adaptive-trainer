import { describe, it, expect } from 'vitest';
import {
  CLASS_IDS,
  BUCKETS,
  MASTERY_THRESHOLD,
  ClassIdSchema,
  BucketSchema,
  ImageMetaSchema,
  ResponseSchema,
  EngineConfigSchema,
  DEFAULT_ENGINE_CONFIG,
  QuestionBankItemSchema,
} from '../index.js';

describe('Contracts - Engine Shapes and Schemas', () => {
  it('validates ClassId values', () => {
    expect(CLASS_IDS).toEqual(['covid19', 'pneumonia', 'normal']);
    for (const c of CLASS_IDS) {
      expect(ClassIdSchema.parse(c)).toBe(c);
    }
    expect(() => ClassIdSchema.parse('invalid_class')).toThrow();
  });

  it('validates Bucket values', () => {
    expect(BUCKETS).toEqual(['easy', 'medium', 'hard']);
    for (const b of BUCKETS) {
      expect(BucketSchema.parse(b)).toBe(b);
    }
    expect(() => BucketSchema.parse('super_hard')).toThrow();
  });

  it('validates ImageMeta schema', () => {
    const validMeta = {
      id: 'img_001',
      trueClass: 'covid19',
      difficulty: 0.45,
      bucket: 'medium',
      confusedWith: 'pneumonia',
    };
    expect(ImageMetaSchema.parse(validMeta)).toEqual(validMeta);

    expect(() =>
      ImageMetaSchema.parse({
        ...validMeta,
        difficulty: 1.5,
      }),
    ).toThrow();
  });

  it('validates Response schema', () => {
    const validResponse = {
      sessionId: 'sess_123',
      imageId: 'img_001',
      trueClass: 'covid19',
      answer: 'covid19',
      bucket: 'medium',
    };
    expect(ResponseSchema.parse(validResponse)).toEqual(validResponse);

    expect(() =>
      ResponseSchema.parse({
        ...validResponse,
        answer: 'unknown',
      }),
    ).toThrow();
  });

  describe('EngineConfigSchema', () => {
    it('parses default config with valid values', () => {
      const config = EngineConfigSchema.parse({});
      expect(config.totalQuestions).toBe(60);
      expect(config.minClassShare).toBe(0.2);
      expect(config.minBucketShare).toBe(0.04);
      expect(config.firstTestBucketShares).toEqual({
        easy: 0.4,
        medium: 0.3,
        hard: 0.3,
      });
      expect(config.alpha).toBe(1);
      expect(config.allowRepeats).toBe(false);
      expect(config.difficultyThresholds).toEqual({
        easyMax: 0.34,
        mediumMax: 0.68,
      });
      expect(config.masteryThreshold).toBe(0.8);
      expect(config.masteryThreshold).toBe(MASTERY_THRESHOLD);
      expect(MASTERY_THRESHOLD).toBe(0.8);
      expect(DEFAULT_ENGINE_CONFIG).toEqual(config);
    });

    it('rejects totalQuestions < 45', () => {
      expect(() =>
        EngineConfigSchema.parse({
          totalQuestions: 44,
        }),
      ).toThrow(/at least 45/);
    });

    it('rejects when 3 * ceil(minClassShare * N) > N', () => {
      // For N=45, if minClassShare = 0.35, ceil(0.35 * 45) = 16. 3 * 16 = 48 > 45.
      expect(() =>
        EngineConfigSchema.parse({
          totalQuestions: 45,
          minClassShare: 0.35,
        }),
      ).toThrow();
    });

    it('rejects when 3 * minBucketCount > minClassCount', () => {
      // For N=60, minClassCount = ceil(0.10 * 60) = 6.
      // If minBucketShare = 0.05, minBucketCount = round(0.05 * 60) = 3.
      // 3 * 3 = 9 > 6 -> should fail.
      expect(() =>
        EngineConfigSchema.parse({
          totalQuestions: 60,
          minClassShare: 0.1,
          minBucketShare: 0.05,
        }),
      ).toThrow(/exceeds minClassCount/);
    });

    it('rejects firstTestBucketShares that do not sum to 1.0', () => {
      expect(() =>
        EngineConfigSchema.parse({
          firstTestBucketShares: {
            easy: 0.5,
            medium: 0.5,
            hard: 0.5,
          },
        }),
      ).toThrow(/must sum to 1.0/);
    });

    it('rejects difficultyThresholds where easyMax >= mediumMax', () => {
      expect(() =>
        EngineConfigSchema.parse({
          difficultyThresholds: {
            easyMax: 0.7,
            mediumMax: 0.5,
          },
        }),
      ).toThrow(/strictly less than/);
    });
  });

  it('validates QuestionBankItem schema', () => {
    const validBankItem = {
      id: 'q_001',
      imageId: 'img_001',
      type: 'finding',
      pair: {
        trueClass: 'covid19',
        confusedWith: 'pneumonia',
      },
      bucket: 'easy',
      status: 'approved',
    };
    expect(QuestionBankItemSchema.parse(validBankItem)).toEqual(validBankItem);

    expect(() =>
      QuestionBankItemSchema.parse({
        ...validBankItem,
        status: 'draft',
      }),
    ).toThrow();
  });
});
