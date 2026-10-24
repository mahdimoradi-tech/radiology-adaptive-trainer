import { describe, it, expect } from 'vitest';
import { allocateClassCounts, allocateBucketCounts } from '../index.js';

describe('Adaptive Engine - Allocation', () => {
  describe('allocateClassCounts', () => {
    it('allocates counts that sum exactly to N and respect minimum class share', () => {
      const N = 60;
      const minClassShare = 0.2; // ceil(0.2 * 60) = 12
      const weights = { covid19: 0.6, pneumonia: 0.3, normal: 0.1 };

      const counts = allocateClassCounts(N, weights, minClassShare);

      expect(counts.covid19).toBeGreaterThanOrEqual(12);
      expect(counts.pneumonia).toBeGreaterThanOrEqual(12);
      expect(counts.normal).toBeGreaterThanOrEqual(12);

      const sum = counts.covid19 + counts.pneumonia + counts.normal;
      expect(sum).toBe(60);

      // Total leftover R = 60 - 36 = 24.
      // largestRemainder(24, [0.6, 0.3, 0.1]) -> 24 * 0.6 = 14.4 (14), 24 * 0.3 = 7.2 (7), 24 * 0.1 = 2.4 (2)
      // 14 + 7 + 2 = 23, remainder = 1.
      // Fractions: .4, .2, .4. Ties broken by lowest index (covid19 idx 0 vs normal idx 2 -> covid19 gets +1).
      // So extra: [15, 7, 2].
      // Counts: [12+15, 12+7, 12+2] = [27, 19, 14].
      expect(counts).toEqual({
        covid19: 27,
        pneumonia: 19,
        normal: 14,
      });
    });

    it('handles extreme weights (100% on one class) without starving others below minimum', () => {
      const N = 45;
      const minClassShare = 0.2; // ceil(0.2 * 45) = 9
      const weights = { covid19: 1.0, pneumonia: 0.0, normal: 0.0 };

      const counts = allocateClassCounts(N, weights, minClassShare);
      expect(counts.pneumonia).toBe(9);
      expect(counts.normal).toBe(9);
      expect(counts.covid19).toBe(45 - 18); // 27
      expect(counts.covid19 + counts.pneumonia + counts.normal).toBe(45);
    });

    it('handles equal weights uniformly', () => {
      const N = 60;
      const weights = { covid19: 1 / 3, pneumonia: 1 / 3, normal: 1 / 3 };
      const counts = allocateClassCounts(N, weights, 0.2);
      expect(counts).toEqual({
        covid19: 20,
        pneumonia: 20,
        normal: 20,
      });
    });
  });

  describe('allocateBucketCounts', () => {
    it('allocates first test buckets according to firstTestBucketShares (40/30/30)', () => {
      const classCounts = { covid19: 20, pneumonia: 20, normal: 20 };
      const N = 60;
      const bucketCounts = allocateBucketCounts(classCounts, N, [], {
        isFirstTest: true,
        firstTestBucketShares: { easy: 0.4, medium: 0.3, hard: 0.3 },
      });

      // For 20 items:
      // easy: 20 * 0.4 = 8
      // medium: 20 * 0.3 = 6
      // hard: 20 * 0.3 = 6
      for (const c of ['covid19', 'pneumonia', 'normal']) {
        expect(bucketCounts[c]).toEqual({
          easy: 8,
          medium: 6,
          hard: 6,
        });
        expect(bucketCounts[c].easy + bucketCounts[c].medium + bucketCounts[c].hard).toBe(20);
      }
    });

    it('allocates adaptive test buckets based on incorrect rates and respects minimum bucket share', () => {
      const classCounts = { covid19: 27, pneumonia: 19, normal: 14 };
      const N = 60;
      const minBucketShare = 0.04; // round(0.04 * 60) = 2. minBucket = max(1, 2) = 2.

      // Responses where covid19 had lots of errors in hard bucket:
      const responses = [
        { trueClass: 'covid19', answer: 'pneumonia', bucket: 'hard' },
        { trueClass: 'covid19', answer: 'pneumonia', bucket: 'hard' },
        { trueClass: 'covid19', answer: 'pneumonia', bucket: 'hard' },
        { trueClass: 'covid19', answer: 'covid19', bucket: 'easy' },
        { trueClass: 'covid19', answer: 'covid19', bucket: 'medium' },
      ];

      const bucketCounts = allocateBucketCounts(classCounts, N, responses, {
        minBucketShare,
        alpha: 1,
      });

      for (const c of ['covid19', 'pneumonia', 'normal']) {
        expect(bucketCounts[c].easy).toBeGreaterThanOrEqual(2);
        expect(bucketCounts[c].medium).toBeGreaterThanOrEqual(2);
        expect(bucketCounts[c].hard).toBeGreaterThanOrEqual(2);

        const classTotal = bucketCounts[c].easy + bucketCounts[c].medium + bucketCounts[c].hard;
        expect(classTotal).toBe(classCounts[c]);
      }

      // Hard bucket for covid19 should have received more questions due to errors
      expect(bucketCounts.covid19.hard).toBeGreaterThan(bucketCounts.covid19.easy);
    });
  });
});
