import { describe, it, expect } from 'vitest';
import {
  PRACTICE_OPTION_COUNT,
  PracticeCreateRequestSchema,
  PracticeQuestionAnswerResidentSchema,
  PracticeQuestionResidentSchema,
  PracticeSetResidentSchema,
  PracticeAnswerRequestSchema,
  PracticeAnswerResponseSchema,
  PracticeSummarySchema,
} from '../practice.js';

describe('Practice Contracts (T09b - Targeted Practice)', () => {
  describe('Constants', () => {
    it('enforces 4 options per question', () => {
      expect(PRACTICE_OPTION_COUNT).toBe(4);
    });
  });

  describe('PracticeCreateRequestSchema', () => {
    it('accepts empty object and defaults size to 10', () => {
      const parsed = PracticeCreateRequestSchema.parse({});
      expect(parsed.size).toBe(10);
    });

    it('accepts valid size within 5..20', () => {
      expect(PracticeCreateRequestSchema.parse({ size: 5 }).size).toBe(5);
      expect(PracticeCreateRequestSchema.parse({ size: 15 }).size).toBe(15);
      expect(PracticeCreateRequestSchema.parse({ size: 20 }).size).toBe(20);
    });

    it('rejects size below 5 or above 20', () => {
      expect(() => PracticeCreateRequestSchema.parse({ size: 4 })).toThrow();
      expect(() => PracticeCreateRequestSchema.parse({ size: 21 })).toThrow();
    });

    it('strictly rejects forbidden / extra fields', () => {
      expect(() => PracticeCreateRequestSchema.parse({ size: 10, extra: 'forbidden' })).toThrow();
    });
  });

  describe('PracticeQuestionResidentSchema & Zero Leakage', () => {
    const validUnansweredQuestion = {
      no: 1,
      type: 'finding',
      stem: 'کدام یافته پاتولوژیک در قفسه سینه دیده می‌شود؟',
      options: [
        'تراکم آلوئولار منتشر',
        'کدورت شیشه‌مات دوطرفه',
        'افیوژن پلورال یک‌طرفه',
        'ریه با ترابکولاسیون نرمال',
      ],
      imageUrl: '/api/images/opaque-public-id-123/file',
      answered: false,
    };

    it('parses valid unanswered resident question', () => {
      const parsed = PracticeQuestionResidentSchema.parse(validUnansweredQuestion);
      expect(parsed.no).toBe(1);
      expect(parsed.type).toBe('finding');
      expect(parsed.options).toHaveLength(4);
      expect(parsed.answered).toBe(false);
      expect(parsed.answer).toBeUndefined();
    });

    it('parses valid answered resident question with rationale in answer object', () => {
      const answeredQuestion = {
        ...validUnansweredQuestion,
        answered: true,
        answer: {
          selectedIndex: 1,
          correct: true,
          correctIndex: 1,
          rationale: 'کدورت شیشه‌مات محیطی با درگیری دوطرفه نشانه شاخص کووید-۱۹ است.',
        },
      };
      const parsed = PracticeQuestionResidentSchema.parse(answeredQuestion);
      expect(parsed.answered).toBe(true);
      expect(parsed.answer?.correct).toBe(true);
      expect(parsed.answer?.correctIndex).toBe(1);
      expect(parsed.answer?.rationale).toContain('کدورت شیشه‌مات');
    });

    it('rejects questions with options length different from 4', () => {
      const badQuestion = {
        ...validUnansweredQuestion,
        options: ['گزینه ۱', 'گزینه ۲', 'گزینه ۳'],
      };
      expect(() => PracticeQuestionResidentSchema.parse(badQuestion)).toThrow();
    });

    it.each([
      'trueClass',
      'confusedWith',
      'bucket',
      'difficulty',
      'source',
      'status',
      'note',
      'consensus',
      'analysis',
      'catalogId',
      'imageId',
      'filename',
      'generatedBy',
      'correctIndex',
      'rationale',
    ])('strictly rejects forbidden key "%s" on the root question object', (forbiddenKey) => {
      const leakingQuestion = {
        ...validUnansweredQuestion,
        [forbiddenKey]: 'leak-value',
      };
      expect(() => PracticeQuestionResidentSchema.parse(leakingQuestion)).toThrow();
    });

    it('strictly rejects forbidden diagnostic metadata inside the answer object', () => {
      expect(() =>
        PracticeQuestionAnswerResidentSchema.parse({
          selectedIndex: 0,
          correct: false,
          correctIndex: 2,
          rationale: 'توضیحات مجاز',
          trueClass: 'covid19',
        }),
      ).toThrow();
    });
  });

  describe('PracticeSetResidentSchema', () => {
    const sampleSet = {
      id: 'set-sample-001',
      status: 'in_progress',
      size: 10,
      answeredCount: 0,
      correctCount: 0,
      createdAt: '2026-11-07T10:00:00.000Z',
      questions: [
        {
          no: 1,
          type: 'distribution',
          stem: 'توزیع درگیری ریوی کدام است؟',
          options: ['محیطی', 'مرکزی', 'قاعده‌ای', 'آپیکال'],
          imageUrl: '/api/images/opaque-public-id-001/file',
          answered: false,
        },
      ],
    };

    it('parses valid resident practice set', () => {
      const parsed = PracticeSetResidentSchema.parse(sampleSet);
      expect(parsed.id).toBe('set-sample-001');
      expect(parsed.status).toBe('in_progress');
      expect(parsed.questions).toHaveLength(1);
    });

    it.each(['userId', 'plan', 'optionOrder', 'questionIds', 'answers'])(
      'strictly rejects internal server state key "%s"',
      (serverKey) => {
        const leakingSet = {
          ...sampleSet,
          [serverKey]: 'internal-value',
        };
        expect(() => PracticeSetResidentSchema.parse(leakingSet)).toThrow();
      },
    );
  });

  describe('PracticeAnswerRequestSchema', () => {
    it('accepts valid selectedIndex 0..3 with optional timeMs', () => {
      expect(PracticeAnswerRequestSchema.parse({ selectedIndex: 0 })).toEqual({
        selectedIndex: 0,
      });
      expect(PracticeAnswerRequestSchema.parse({ selectedIndex: 3, timeMs: 4500 })).toEqual({
        selectedIndex: 3,
        timeMs: 4500,
      });
    });

    it('rejects selectedIndex outside 0..3', () => {
      expect(() => PracticeAnswerRequestSchema.parse({ selectedIndex: -1 })).toThrow();
      expect(() => PracticeAnswerRequestSchema.parse({ selectedIndex: 4 })).toThrow();
      expect(() => PracticeAnswerRequestSchema.parse({ selectedIndex: 1.5 })).toThrow();
    });

    it('strictly rejects unrecognized keys', () => {
      expect(() =>
        PracticeAnswerRequestSchema.parse({ selectedIndex: 2, answer: 'covid19' }),
      ).toThrow();
    });
  });

  describe('PracticeAnswerResponseSchema', () => {
    it('parses valid answer response', () => {
      const res = {
        correct: true,
        correctIndex: 2,
        rationale: 'درگیری شیشه‌مات محیطی ویژگی شاخص کووید است.',
        completed: false,
      };
      const parsed = PracticeAnswerResponseSchema.parse(res);
      expect(parsed.correct).toBe(true);
      expect(parsed.correctIndex).toBe(2);
      expect(parsed.completed).toBe(false);
    });

    it.each(['trueClass', 'confusedWith', 'bucket', 'difficulty', 'stem'])(
      'strictly rejects forbidden key "%s"',
      (forbiddenKey) => {
        const leaking = {
          correct: true,
          correctIndex: 0,
          rationale: 'توضیحات',
          completed: false,
          [forbiddenKey]: 'leak',
        };
        expect(() => PracticeAnswerResponseSchema.parse(leaking)).toThrow();
      },
    );
  });

  describe('PracticeSummarySchema', () => {
    it('parses valid practice summary', () => {
      const summary = {
        id: 'set-sum-1',
        status: 'completed',
        size: 10,
        answeredCount: 10,
        correctCount: 8,
        createdAt: '2026-11-07T10:00:00.000Z',
        completedAt: '2026-11-07T10:07:30.000Z',
      };
      const parsed = PracticeSummarySchema.parse(summary);
      expect(parsed.id).toBe('set-sum-1');
      expect(parsed.status).toBe('completed');
      expect(parsed.correctCount).toBe(8);
    });

    it('strictly rejects extraneous properties', () => {
      expect(() =>
        PracticeSummarySchema.parse({
          id: 'set-sum-1',
          status: 'in_progress',
          size: 10,
          answeredCount: 0,
          correctCount: 0,
          createdAt: '2026-11-07T10:00:00.000Z',
          extraProperty: 'disallowed',
        }),
      ).toThrow();
    });
  });
});
