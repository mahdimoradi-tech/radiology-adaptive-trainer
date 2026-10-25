import { describe, it, expect } from 'vitest';
import {
  largestRemainder,
  confusionMatrix,
  rates,
  classWeights,
  bucketOf,
  perClassCounts,
} from '../index.js';

describe('Adaptive Engine - Math and Error Rates', () => {
  describe('largestRemainder', () => {
    it('returns exact sum matching total for fractional allocations', () => {
      // weights [0.7, 0.2, 0.1], total = 10
      // exact: [7, 2, 1]
      expect(largestRemainder(10, [0.7, 0.2, 0.1])).toEqual([7, 2, 1]);

      // total = 10, weights [0.333, 0.333, 0.334]
      // exact: [3.33, 3.33, 3.34] -> floor [3, 3, 3] -> remainder 1 -> index 2 has largest frac (.34)
      expect(largestRemainder(10, [0.333, 0.333, 0.334])).toEqual([3, 3, 4]);

      // total = 60, equal weights [1/3, 1/3, 1/3]
      expect(largestRemainder(60, [1 / 3, 1 / 3, 1 / 3])).toEqual([20, 20, 20]);
    });

    it('breaks ties deterministically by lowest index', () => {
      // total = 10, equal weights [0.25, 0.25, 0.25, 0.25]
      // exact: [2.5, 2.5, 2.5, 2.5] -> floor [2, 2, 2, 2] = 8, leftover = 2.
      // Fractional parts are all 0.5. Ties broken by lowest index: indices 0 and 1 get +1.
      expect(largestRemainder(10, [0.25, 0.25, 0.25, 0.25])).toEqual([3, 3, 2, 2]);
    });

    it('handles total 0 and zero weights cleanly', () => {
      expect(largestRemainder(0, [0.5, 0.5])).toEqual([0, 0]);

      // Zero weights with total 10: defaults to uniform distribution
      // [10/3, 10/3, 10/3] -> floor [3, 3, 3] -> indices 0 gets +1
      expect(largestRemainder(10, [0, 0, 0])).toEqual([4, 3, 3]);
    });
  });

  describe('bucketOf', () => {
    const thresholds = { easyMax: 0.34, mediumMax: 0.68 };

    it('maps difficulty to correct buckets according to cutoffs', () => {
      expect(bucketOf(0.1, thresholds)).toBe('easy');
      expect(bucketOf(0.339, thresholds)).toBe('easy');
      expect(bucketOf(0.34, thresholds)).toBe('medium');
      expect(bucketOf(0.5, thresholds)).toBe('medium');
      expect(bucketOf(0.679, thresholds)).toBe('medium');
      expect(bucketOf(0.68, thresholds)).toBe('hard');
      expect(bucketOf(0.95, thresholds)).toBe('hard');
    });
  });

  describe('confusionMatrix and rates (with hand-computed arithmetic)', () => {
    /**
     * Hand-computed verification dataset:
     * 4 responses across 3 classes:
     * 1. true: covid19, answer: covid19 (TP for covid19)
     * 2. true: covid19, answer: pneumonia (FN for covid19, FP for pneumonia, TN for normal)
     * 3. true: pneumonia, answer: pneumonia (TP for pneumonia, TN for covid19, TN for normal)
     * 4. true: normal, answer: pneumonia (FN for normal, FP for pneumonia, TN for covid19)
     *
     * Manual tally:
     * covid19:   TP=1, FN=1, FP=0, TN=2
     * pneumonia: TP=1, FN=0, FP=2, TN=1
     * normal:    TP=0, FN=1, FP=0, TN=3
     *
     * Laplace smoothing (alpha = 1):
     * FNR_c = (FN + alpha) / (TP + FN + 2*alpha)
     * FPR_c = (FP + alpha) / (FP + TN + 2*alpha)
     *
     * covid19:
     *   FNR = (1 + 1) / (1 + 1 + 2) = 2/4 = 0.5
     *   FPR = (0 + 1) / (0 + 2 + 2) = 1/4 = 0.25
     *   Error = 0.5 + 0.25 = 0.75
     *
     * pneumonia:
     *   FNR = (0 + 1) / (1 + 0 + 2) = 1/3 ≈ 0.3333333333
     *   FPR = (2 + 1) / (2 + 1 + 2) = 3/5 = 0.6
     *   Error = 1/3 + 3/5 = 14/15 ≈ 0.9333333333
     *
     * normal:
     *   FNR = (1 + 1) / (0 + 1 + 2) = 2/3 ≈ 0.6666666667
     *   FPR = (0 + 1) / (0 + 3 + 2) = 1/5 = 0.2
     *   Error = 2/3 + 1/5 = 13/15 ≈ 0.8666666667
     *
     * Sum of errors:
     *   0.75 + 14/15 + 13/15 = 3/4 + 27/15 = 3/4 + 9/5 = 51/20 = 2.55
     *
     * Class weights (Weight_c = Error_c / Sum):
     *   covid19:   (3/4) / (51/20) = 15/51 = 5/17 ≈ 0.2941176471
     *   pneumonia: (14/15) / (51/20) = 56/153 ≈ 0.3660130719
     *   normal:    (13/15) / (51/20) = 52/153 ≈ 0.3398692810
     *   Sum = 5/17 + 56/153 + 52/153 = 1.0
     */
    const sampleResponses = [
      {
        sessionId: 's1',
        imageId: 'img1',
        trueClass: 'covid19',
        answer: 'covid19',
        bucket: 'easy',
      },
      {
        sessionId: 's1',
        imageId: 'img2',
        trueClass: 'covid19',
        answer: 'pneumonia',
        bucket: 'medium',
      },
      {
        sessionId: 's1',
        imageId: 'img3',
        trueClass: 'pneumonia',
        answer: 'pneumonia',
        bucket: 'medium',
      },
      {
        sessionId: 's1',
        imageId: 'img4',
        trueClass: 'normal',
        answer: 'pneumonia',
        bucket: 'hard',
      },
    ];

    it('computes confusion matrix counts accurately', () => {
      const cm = confusionMatrix(sampleResponses);
      expect(cm.covid19.covid19).toBe(1);
      expect(cm.covid19.pneumonia).toBe(1);
      expect(cm.covid19.normal).toBe(0);

      expect(cm.pneumonia.covid19).toBe(0);
      expect(cm.pneumonia.pneumonia).toBe(1);
      expect(cm.pneumonia.normal).toBe(0);

      expect(cm.normal.covid19).toBe(0);
      expect(cm.normal.pneumonia).toBe(1);
      expect(cm.normal.normal).toBe(0);
    });

    it('computes rates matching hand-calculated arithmetic exactly', () => {
      const r = rates(sampleResponses, 1);

      // covid19
      expect(r.covid19.tp).toBe(1);
      expect(r.covid19.fn).toBe(1);
      expect(r.covid19.fp).toBe(0);
      expect(r.covid19.tn).toBe(2);
      expect(r.covid19.fnr).toBeCloseTo(0.5, 6);
      expect(r.covid19.fpr).toBeCloseTo(0.25, 6);
      expect(r.covid19.error).toBeCloseTo(0.75, 6);

      // pneumonia
      expect(r.pneumonia.tp).toBe(1);
      expect(r.pneumonia.fn).toBe(0);
      expect(r.pneumonia.fp).toBe(2);
      expect(r.pneumonia.tn).toBe(1);
      expect(r.pneumonia.fnr).toBeCloseTo(1 / 3, 6);
      expect(r.pneumonia.fpr).toBeCloseTo(0.6, 6);
      expect(r.pneumonia.error).toBeCloseTo(14 / 15, 6);

      // normal
      expect(r.normal.tp).toBe(0);
      expect(r.normal.fn).toBe(1);
      expect(r.normal.fp).toBe(0);
      expect(r.normal.tn).toBe(3);
      expect(r.normal.fnr).toBeCloseTo(2 / 3, 6);
      expect(r.normal.fpr).toBeCloseTo(0.2, 6);
      expect(r.normal.error).toBeCloseTo(13 / 15, 6);
    });

    it('rates never returns NaN on empty response history (pure Laplace smoothing)', () => {
      const r = rates([], 1);
      for (const c of ['covid19', 'pneumonia', 'normal']) {
        expect(r[c].tp).toBe(0);
        expect(r[c].fn).toBe(0);
        expect(r[c].fp).toBe(0);
        expect(r[c].tn).toBe(0);
        expect(Number.isNaN(r[c].fnr)).toBe(false);
        expect(Number.isNaN(r[c].fpr)).toBe(false);
        expect(Number.isNaN(r[c].error)).toBe(false);
        // With 0 responses, FNR = 1/(0+2) = 0.5, FPR = 1/(0+2) = 0.5, Error = 1.0
        expect(r[c].fnr).toBe(0.5);
        expect(r[c].fpr).toBe(0.5);
        expect(r[c].error).toBe(1.0);
      }
    });

    it('classWeights matches hand-calculated weights and sums to 1.0', () => {
      const r = rates(sampleResponses, 1);
      const w = classWeights(r);

      expect(w.covid19).toBeCloseTo(5 / 17, 6);
      expect(w.pneumonia).toBeCloseTo(56 / 153, 6);
      expect(w.normal).toBeCloseTo(52 / 153, 6);

      const sum = w.covid19 + w.pneumonia + w.normal;
      expect(sum).toBeCloseTo(1.0, 6);
    });

    it('classWeights returns uniform weights 1/3 when all errors are equal or zero', () => {
      const emptyRates = rates([], 1);
      const w = classWeights(emptyRates);
      expect(w.covid19).toBeCloseTo(1 / 3, 6);
      expect(w.pneumonia).toBeCloseTo(1 / 3, 6);
      expect(w.normal).toBeCloseTo(1 / 3, 6);
      expect(w.covid19 + w.pneumonia + w.normal).toBeCloseTo(1.0, 6);
    });

    it('classWeights is monotonic with error rate', () => {
      const mockRates = {
        covid19: { error: 0.2 },
        pneumonia: { error: 0.8 },
        normal: { error: 1.0 },
      };
      const w = classWeights(mockRates);
      expect(w.covid19).toBeLessThan(w.pneumonia);
      expect(w.pneumonia).toBeLessThan(w.normal);
      expect(w.covid19 + w.pneumonia + w.normal).toBeCloseTo(1.0, 6);
    });
  });

  describe('perClassCounts', () => {
    it('tallies total and incorrect responses per class and bucket', () => {
      const responses = [
        {
          sessionId: 's1',
          imageId: 'i1',
          trueClass: 'covid19',
          answer: 'covid19',
          bucket: 'easy',
        },
        {
          sessionId: 's1',
          imageId: 'i2',
          trueClass: 'covid19',
          answer: 'pneumonia',
          bucket: 'easy',
        },
        {
          sessionId: 's1',
          imageId: 'i3',
          trueClass: 'covid19',
          answer: 'normal',
          bucket: 'hard',
        },
      ];

      const counts = perClassCounts(responses);
      expect(counts.covid19.total).toBe(3);
      expect(counts.covid19.incorrect).toBe(2);
      expect(counts.covid19.byBucket.easy.total).toBe(2);
      expect(counts.covid19.byBucket.easy.incorrect).toBe(1);
      expect(counts.covid19.byBucket.hard.total).toBe(1);
      expect(counts.covid19.byBucket.hard.incorrect).toBe(1);
      expect(counts.covid19.byBucket.medium.total).toBe(0);
      expect(counts.covid19.byBucket.medium.incorrect).toBe(0);
    });
  });
});
