import { describe, it, expect } from 'vitest';
import { isMastered, selectTargetedQuestions } from '../index.js';

describe('Adaptive Engine - Targeted Practice and Mastery', () => {
  describe('isMastered', () => {
    it('returns true when all 3 classes have accuracy >= threshold', () => {
      const responses = [
        // covid19: 4/5 = 80%
        { trueClass: 'covid19', answer: 'covid19' },
        { trueClass: 'covid19', answer: 'covid19' },
        { trueClass: 'covid19', answer: 'covid19' },
        { trueClass: 'covid19', answer: 'covid19' },
        { trueClass: 'covid19', answer: 'pneumonia' },
        // pneumonia: 5/5 = 100%
        { trueClass: 'pneumonia', answer: 'pneumonia' },
        { trueClass: 'pneumonia', answer: 'pneumonia' },
        { trueClass: 'pneumonia', answer: 'pneumonia' },
        { trueClass: 'pneumonia', answer: 'pneumonia' },
        { trueClass: 'pneumonia', answer: 'pneumonia' },
        // normal: 8/10 = 80%
        { trueClass: 'normal', answer: 'normal' },
        { trueClass: 'normal', answer: 'normal' },
        { trueClass: 'normal', answer: 'normal' },
        { trueClass: 'normal', answer: 'normal' },
        { trueClass: 'normal', answer: 'normal' },
        { trueClass: 'normal', answer: 'normal' },
        { trueClass: 'normal', answer: 'normal' },
        { trueClass: 'normal', answer: 'normal' },
        { trueClass: 'normal', answer: 'covid19' },
        { trueClass: 'normal', answer: 'pneumonia' },
      ];

      expect(isMastered(responses, 0.8)).toBe(true);
    });

    it('returns false when any class falls below threshold', () => {
      const responses = [
        // covid19: 3/5 = 60% (< 80%)
        { trueClass: 'covid19', answer: 'covid19' },
        { trueClass: 'covid19', answer: 'covid19' },
        { trueClass: 'covid19', answer: 'covid19' },
        { trueClass: 'covid19', answer: 'pneumonia' },
        { trueClass: 'covid19', answer: 'pneumonia' },
        // pneumonia: 100%
        { trueClass: 'pneumonia', answer: 'pneumonia' },
        // normal: 100%
        { trueClass: 'normal', answer: 'normal' },
      ];

      expect(isMastered(responses, 0.8)).toBe(false);
    });

    it('returns false when any class has zero questions in the session', () => {
      const responses = [
        { trueClass: 'covid19', answer: 'covid19' },
        { trueClass: 'pneumonia', answer: 'pneumonia' },
        // normal has 0 questions
      ];

      expect(isMastered(responses, 0.8)).toBe(false);
    });
  });

  describe('selectTargetedQuestions', () => {
    function createMockBank() {
      const bank = [];
      const pairs = [
        { trueClass: 'covid19', confusedWith: 'pneumonia' },
        { trueClass: 'covid19', confusedWith: 'normal' },
        { trueClass: 'pneumonia', confusedWith: 'covid19' },
        { trueClass: 'pneumonia', confusedWith: 'normal' },
        { trueClass: 'normal', confusedWith: 'covid19' },
        { trueClass: 'normal', confusedWith: 'pneumonia' },
      ];

      let id = 1;
      for (const pair of pairs) {
        for (let i = 0; i < 10; i++) {
          bank.push({
            id: `q_${id++}`,
            imageId: `img_${id}`,
            type: 'finding',
            pair,
            bucket: 'medium',
            status: 'approved',
          });
        }
      }

      // Add some pending/rejected items that must never be selected
      bank.push({
        id: 'q_pending',
        imageId: 'img_p',
        type: 'finding',
        pair: pairs[0],
        bucket: 'medium',
        status: 'pending_review',
      });
      bank.push({
        id: 'q_rejected',
        imageId: 'img_r',
        type: 'finding',
        pair: pairs[0],
        bucket: 'medium',
        status: 'rejected',
      });

      return bank;
    }

    it('selects approved questions targeting user confusion pairs and excludes answered ones', () => {
      const bank = createMockBank();

      // History where user repeatedly confuses covid19 for pneumonia
      const history = [
        {
          questionId: 'q_1',
          trueClass: 'covid19',
          answer: 'pneumonia',
          bucket: 'medium',
        },
        { trueClass: 'covid19', answer: 'pneumonia', bucket: 'medium' },
        { trueClass: 'covid19', answer: 'pneumonia', bucket: 'medium' },
      ];

      const config = { seed: 12345, alpha: 1 };
      const n = 10;

      const result = selectTargetedQuestions(bank, history, config, n);

      expect(result.questionIds).toHaveLength(10);
      // Must not include already answered question q_1
      expect(result.questionIds).not.toContain('q_1');
      // Must not include pending or rejected questions
      expect(result.questionIds).not.toContain('q_pending');
      expect(result.questionIds).not.toContain('q_rejected');

      // Check plan metadata
      expect(result.plan.counts['covid19->pneumonia']).toBeGreaterThan(
        result.plan.counts['normal->pneumonia'],
      );
    });

    it('records shortfalls and falls back to same trueClass when bank lacks pair questions', () => {
      const bank = [
        {
          id: 'q_cov_pneu',
          imageId: 'img_1',
          type: 'finding',
          pair: { trueClass: 'covid19', confusedWith: 'pneumonia' },
          bucket: 'easy',
          status: 'approved',
        },
        {
          id: 'q_cov_norm',
          imageId: 'img_2',
          type: 'finding',
          pair: { trueClass: 'covid19', confusedWith: 'normal' },
          bucket: 'easy',
          status: 'approved',
        },
      ];

      // Need 5 questions but bank only has 2
      const history = [{ trueClass: 'covid19', answer: 'pneumonia', bucket: 'easy' }];

      const result = selectTargetedQuestions(bank, history, { seed: 99, alpha: 1 }, 5);

      // Available approved questions are 2, so it selects all 2 and records shortfall
      expect(result.questionIds).toHaveLength(2);
      expect(result.plan.shortfalls.length).toBeGreaterThan(0);
    });
  });
});
