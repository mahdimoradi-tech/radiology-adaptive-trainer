import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  largestRemainder,
  allocateClassCounts,
  allocateBucketCounts,
  rates,
  classWeights,
  createRng,
  selectFirstTest,
  selectNextTest,
} from '../index.js';

describe('Adaptive Engine - Property-Based Tests (fast-check)', () => {
  it('largestRemainder always sums exactly to total and contains no NaN/Infinity', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 300 }),
        fc.array(fc.float({ min: 0, max: 100, noNaN: true }), {
          minLength: 1,
          maxLength: 10,
        }),
        (total, weights) => {
          const result = largestRemainder(total, weights);
          expect(result).toHaveLength(weights.length);

          const sum = result.reduce((acc, v) => acc + v, 0);
          expect(sum).toBe(total);

          for (const val of result) {
            expect(Number.isInteger(val)).toBe(true);
            expect(val).toBeGreaterThanOrEqual(0);
            expect(Number.isNaN(val)).toBe(false);
          }
        },
      ),
    );
  });

  it('allocateClassCounts satisfies N in [45..120], minimum share and exact sum', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 45, max: 120 }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        (N, wCovid, wPneu, wNorm) => {
          const weights = {
            covid19: wCovid,
            pneumonia: wPneu,
            normal: wNorm,
          };
          const minShare = 0.2;
          const minExpected = Math.ceil(minShare * N);

          const counts = allocateClassCounts(N, weights, minShare);
          expect(counts.covid19).toBeGreaterThanOrEqual(minExpected);
          expect(counts.pneumonia).toBeGreaterThanOrEqual(minExpected);
          expect(counts.normal).toBeGreaterThanOrEqual(minExpected);

          const totalAllocated = counts.covid19 + counts.pneumonia + counts.normal;
          expect(totalAllocated).toBe(N);
        },
      ),
    );
  });

  it('allocateBucketCounts satisfies per-class sums and minimum bucket share for N in [45..120]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 45, max: 120 }),
        fc.array(
          fc.record({
            sessionId: fc.constant('sess_prop'),
            imageId: fc.string({ minLength: 1, maxLength: 10 }),
            trueClass: fc.constantFrom('covid19', 'pneumonia', 'normal'),
            answer: fc.constantFrom('covid19', 'pneumonia', 'normal'),
            bucket: fc.constantFrom('easy', 'medium', 'hard'),
          }),
          { maxLength: 50 },
        ),
        (N, randomResponses) => {
          const minShare = 0.2;
          const minBucketShare = 0.04;
          const classCounts = allocateClassCounts(
            N,
            { covid19: 0.33, pneumonia: 0.33, normal: 0.34 },
            minShare,
          );

          const bucketCounts = allocateBucketCounts(classCounts, N, randomResponses, {
            minBucketShare,
            alpha: 1,
          });

          const minExpectedBucket = Math.max(1, Math.round(minBucketShare * N));

          let grandTotal = 0;
          for (const c of ['covid19', 'pneumonia', 'normal']) {
            expect(bucketCounts[c].easy).toBeGreaterThanOrEqual(minExpectedBucket);
            expect(bucketCounts[c].medium).toBeGreaterThanOrEqual(minExpectedBucket);
            expect(bucketCounts[c].hard).toBeGreaterThanOrEqual(minExpectedBucket);

            const classTotal = bucketCounts[c].easy + bucketCounts[c].medium + bucketCounts[c].hard;
            expect(classTotal).toBe(classCounts[c]);
            grandTotal += classTotal;
          }

          expect(grandTotal).toBe(N);
        },
      ),
    );
  });

  it('rates and classWeights never produce NaN and classWeights always sum to 1.0', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            sessionId: fc.constant('s'),
            imageId: fc.string({ minLength: 1, maxLength: 5 }),
            trueClass: fc.constantFrom('covid19', 'pneumonia', 'normal'),
            answer: fc.constantFrom('covid19', 'pneumonia', 'normal'),
            bucket: fc.constantFrom('easy', 'medium', 'hard'),
          }),
          { maxLength: 80 },
        ),
        (responses) => {
          const r = rates(responses, 1);
          for (const c of ['covid19', 'pneumonia', 'normal']) {
            expect(Number.isNaN(r[c].fnr)).toBe(false);
            expect(Number.isNaN(r[c].fpr)).toBe(false);
            expect(Number.isNaN(r[c].error)).toBe(false);
            expect(r[c].fnr).toBeGreaterThanOrEqual(0);
            expect(r[c].fpr).toBeGreaterThanOrEqual(0);
          }

          const w = classWeights(r);
          const weightSum = w.covid19 + w.pneumonia + w.normal;
          expect(weightSum).toBeCloseTo(1.0, 5);
          expect(Number.isNaN(w.covid19)).toBe(false);
          expect(Number.isNaN(w.pneumonia)).toBe(false);
          expect(Number.isNaN(w.normal)).toBe(false);
        },
      ),
    );
  });

  it('Mulberry32 PRNG and selection functions are strictly deterministic across seeds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000000 }),
        fc.integer({ min: 45, max: 75 }),
        (seed, N) => {
          const rng1 = createRng(seed);
          const rng2 = createRng(seed);

          const r1 = Array.from({ length: 20 }, () => rng1.next());
          const r2 = Array.from({ length: 20 }, () => rng2.next());
          expect(r1).toEqual(r2);

          // Build synthetic pool
          const pool = [];
          let id = 1;
          for (const c of ['covid19', 'pneumonia', 'normal']) {
            for (const b of ['easy', 'medium', 'hard']) {
              for (let i = 0; i < 30; i++) {
                pool.push({
                  id: `img_${id++}`,
                  trueClass: c,
                  difficulty: 0.5,
                  bucket: b,
                  confusedWith: c === 'covid19' ? 'pneumonia' : 'covid19',
                });
              }
            }
          }

          const test1 = selectFirstTest(pool, { totalQuestions: N, seed });
          const test2 = selectFirstTest(pool, { totalQuestions: N, seed });
          expect(test1.imageIds).toEqual(test2.imageIds);
          expect(test1.imageIds).toHaveLength(N);

          const next1 = selectNextTest(pool, [], { totalQuestions: N, seed });
          const next2 = selectNextTest(pool, [], { totalQuestions: N, seed });
          expect(next1.imageIds).toEqual(next2.imageIds);
          expect(next1.imageIds).toHaveLength(N);
        },
      ),
    );
  });
});
