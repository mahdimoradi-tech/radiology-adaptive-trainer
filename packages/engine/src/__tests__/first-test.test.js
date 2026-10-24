import { describe, it, expect } from 'vitest';
import { createRng, selectFirstTest } from '../index.js';

describe('Adaptive Engine - RNG and First Test Selection', () => {
  describe('createRng (Mulberry32)', () => {
    it('generates identical sequence for the same seed', () => {
      const rng1 = createRng(42);
      const rng2 = createRng(42);

      const seq1 = Array.from({ length: 10 }, () => rng1.next());
      const seq2 = Array.from({ length: 10 }, () => rng2.next());

      expect(seq1).toEqual(seq2);
      for (const val of seq1) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });

    it('generates identical sequence for string seeds', () => {
      const rng1 = createRng('session-test-seed');
      const rng2 = createRng('session-test-seed');

      expect(rng1.next()).toEqual(rng2.next());
      expect(rng1.next()).toEqual(rng2.next());
    });

    it('shuffles arrays deterministically given the same seed', () => {
      const arr1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const arr2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      createRng(12345).shuffle(arr1);
      createRng(12345).shuffle(arr2);

      expect(arr1).toEqual(arr2);
      // Ensure it actually shuffled
      expect(arr1).not.toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
  });

  describe('selectFirstTest', () => {
    // Generate a synthetic image pool of 150 images (50 per class, evenly distributed across buckets)
    function createSyntheticPool() {
      const classes = ['covid19', 'pneumonia', 'normal'];
      const buckets = ['easy', 'medium', 'hard'];
      const pool = [];

      let id = 1;
      for (const c of classes) {
        for (const b of buckets) {
          for (let i = 0; i < 20; i++) {
            pool.push({
              id: `img_${id++}`,
              trueClass: c,
              difficulty: b === 'easy' ? 0.2 : b === 'medium' ? 0.5 : 0.8,
              bucket: b,
              confusedWith: c === 'covid19' ? 'pneumonia' : 'covid19',
            });
          }
        }
      }
      return pool;
    }

    it('selects exact total questions matching bucket allocation and shuffles result', () => {
      const pool = createSyntheticPool();
      const config = {
        totalQuestions: 60,
        seed: 999,
      };

      const result = selectFirstTest(pool, config);

      expect(result.imageIds).toHaveLength(60);
      // All IDs should be unique (no repeats)
      const uniqueIds = new Set(result.imageIds);
      expect(uniqueIds.size).toBe(60);

      // Check plan metadata
      expect(result.plan.classCounts).toEqual({
        covid19: 20,
        pneumonia: 20,
        normal: 20,
      });
      for (const c of ['covid19', 'pneumonia', 'normal']) {
        expect(result.plan.bucketCounts[c]).toEqual({
          easy: 8,
          medium: 6,
          hard: 6,
        });
      }
      expect(result.plan.shortfalls).toEqual([]);
    });

    it('is completely deterministic given the same seed', () => {
      const pool = createSyntheticPool();
      const res1 = selectFirstTest(pool, { totalQuestions: 60, seed: 100 });
      const res2 = selectFirstTest(pool, { totalQuestions: 60, seed: 100 });

      expect(res1.imageIds).toEqual(res2.imageIds);
      expect(res1.plan).toEqual(res2.plan);
    });

    it('records shortfalls and fills from nearest bucket when pool is limited', () => {
      // Pool with only 2 easy covid19 images when 8 are needed
      const pool = [];
      // 2 easy covid19
      pool.push({
        id: 'c_e_1',
        trueClass: 'covid19',
        difficulty: 0.1,
        bucket: 'easy',
        confusedWith: 'pneumonia',
      });
      pool.push({
        id: 'c_e_2',
        trueClass: 'covid19',
        difficulty: 0.2,
        bucket: 'easy',
        confusedWith: 'pneumonia',
      });
      // 20 medium covid19 (to substitute)
      for (let i = 1; i <= 20; i++) {
        pool.push({
          id: `c_m_${i}`,
          trueClass: 'covid19',
          difficulty: 0.5,
          bucket: 'medium',
          confusedWith: 'pneumonia',
        });
      }
      // 20 hard covid19
      for (let i = 1; i <= 20; i++) {
        pool.push({
          id: `c_h_${i}`,
          trueClass: 'covid19',
          difficulty: 0.8,
          bucket: 'hard',
          confusedWith: 'pneumonia',
        });
      }
      // 30 pneumonia, 30 normal
      for (let i = 1; i <= 30; i++) {
        pool.push({
          id: `p_${i}`,
          trueClass: 'pneumonia',
          difficulty: 0.3,
          bucket: 'easy',
          confusedWith: 'covid19',
        });
        pool.push({
          id: `n_${i}`,
          trueClass: 'normal',
          difficulty: 0.3,
          bucket: 'easy',
          confusedWith: 'covid19',
        });
      }

      const result = selectFirstTest(pool, { totalQuestions: 60, seed: 77 });
      expect(result.imageIds).toHaveLength(60);
      expect(result.plan.shortfalls.length).toBeGreaterThan(0);
      const covidEasyShortfall = result.plan.shortfalls.find(
        (s) => s.classId === 'covid19' && s.bucket === 'easy',
      );
      expect(covidEasyShortfall).toBeDefined();
      expect(covidEasyShortfall.requested).toBe(8);
      expect(covidEasyShortfall.available).toBe(2);
      expect(covidEasyShortfall.shortfall).toBe(6);
    });
  });
});
