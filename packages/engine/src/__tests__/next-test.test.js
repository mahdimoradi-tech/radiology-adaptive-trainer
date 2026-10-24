import { describe, it, expect } from 'vitest';
import { selectNextTest } from '../index.js';

describe('Adaptive Engine - Adaptive Next Test Selection', () => {
  function createSyntheticPool(countPerClassBucket = 20) {
    const classes = ['covid19', 'pneumonia', 'normal'];
    const buckets = ['easy', 'medium', 'hard'];
    const pool = [];

    let id = 1;
    for (const c of classes) {
      for (const b of buckets) {
        for (let i = 0; i < countPerClassBucket; i++) {
          pool.push({
            id: `img_${c}_${b}_${id++}`,
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

  it('adapts question selection toward classes and buckets with more errors', () => {
    const pool = createSyntheticPool(30);

    // Resident has massive errors on covid19 (all wrong), perfect on others
    const history = [];
    for (let i = 0; i < 20; i++) {
      history.push({
        sessionId: 's1',
        imageId: `hist_${i}`,
        trueClass: 'covid19',
        answer: 'pneumonia', // wrong
        bucket: 'hard',
      });
    }
    for (let i = 0; i < 20; i++) {
      history.push({
        sessionId: 's1',
        imageId: `hist_p_${i}`,
        trueClass: 'pneumonia',
        answer: 'pneumonia', // correct
        bucket: 'medium',
      });
      history.push({
        sessionId: 's1',
        imageId: `hist_n_${i}`,
        trueClass: 'normal',
        answer: 'normal', // correct
        bucket: 'easy',
      });
    }

    const result = selectNextTest(pool, history, {
      totalQuestions: 60,
      seed: 42,
    });

    expect(result.imageIds).toHaveLength(60);
    // covid19 should have the highest class count
    expect(result.plan.classCounts.covid19).toBeGreaterThan(result.plan.classCounts.pneumonia);
    expect(result.plan.classCounts.covid19).toBeGreaterThan(result.plan.classCounts.normal);

    // Within covid19, hard bucket had all the errors, so it should have more questions
    expect(result.plan.bucketCounts.covid19.hard).toBeGreaterThan(
      result.plan.bucketCounts.covid19.easy,
    );
    expect(result.plan.weights.covid19).toBeGreaterThan(result.plan.weights.pneumonia);
    expect(result.plan.errors).toBeDefined();
  });

  it('strictly enforces no-repeat rule when allowRepeats is false', () => {
    const pool = createSyntheticPool(25);

    // Pick 20 images from the pool and mark them as already answered
    const alreadyAnsweredImages = pool.slice(0, 20);
    const history = alreadyAnsweredImages.map((img) => ({
      sessionId: 's1',
      imageId: img.id,
      trueClass: img.trueClass,
      answer: img.trueClass,
      bucket: img.bucket,
    }));

    const result = selectNextTest(pool, history, {
      totalQuestions: 60,
      allowRepeats: false,
      seed: 55,
    });

    expect(result.imageIds).toHaveLength(60);
    const answeredIdsSet = new Set(alreadyAnsweredImages.map((i) => i.id));
    for (const selectedId of result.imageIds) {
      expect(answeredIdsSet.has(selectedId)).toBe(false);
    }
  });

  it('falls back to baseline allocation if history is empty', () => {
    const pool = createSyntheticPool(20);
    const result = selectNextTest(pool, [], {
      totalQuestions: 60,
      seed: 123,
    });

    expect(result.imageIds).toHaveLength(60);
    expect(result.plan.classCounts).toEqual({
      covid19: 20,
      pneumonia: 20,
      normal: 20,
    });
  });

  it('produces identical selections with identical seed and history', () => {
    const pool = createSyntheticPool(20);
    const history = [
      {
        sessionId: 's1',
        imageId: 'img_prev_1',
        trueClass: 'covid19',
        answer: 'pneumonia',
        bucket: 'hard',
      },
    ];

    const res1 = selectNextTest(pool, history, { totalQuestions: 60, seed: 77 });
    const res2 = selectNextTest(pool, history, { totalQuestions: 60, seed: 77 });

    expect(res1.imageIds).toEqual(res2.imageIds);
    expect(res1.plan).toEqual(res2.plan);
  });
});
