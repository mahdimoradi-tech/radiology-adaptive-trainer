import { describe, it, expect } from 'vitest';
import {
  API_ERROR_CODES,
  ApiErrorCodeSchema,
  CreateSessionBodySchema,
  AnswerBodySchema,
  QuestionPublicSchema,
  SessionPublicSchema,
  SessionSummarySchema,
  ClassMetricsSchema,
  ReportItemSchema,
  SessionReportSchema,
  ProgressSchema,
  AdminResidentSummarySchema,
} from '../index.js';

describe('API_ERROR_CODES session additions', () => {
  it('includes all session-related error codes', () => {
    const requiredCodes = [
      'SESSION_IN_PROGRESS',
      'SESSION_NOT_IN_PROGRESS',
      'SESSION_NOT_FINISHED',
      'SESSION_ALREADY_FINISHED',
      'POOL_EXHAUSTED',
      'QUESTION_NOT_FOUND',
    ];
    for (const code of requiredCodes) {
      expect(API_ERROR_CODES).toContain(code);
      expect(ApiErrorCodeSchema.safeParse(code).success).toBe(true);
    }
  });
});

describe('CreateSessionBodySchema', () => {
  it('defaults size to 60 when empty', () => {
    const parsed = CreateSessionBodySchema.parse({});
    expect(parsed.size).toBe(60);
  });

  it('accepts valid size between 45 and 120', () => {
    expect(CreateSessionBodySchema.parse({ size: 45 }).size).toBe(45);
    expect(CreateSessionBodySchema.parse({ size: 90 }).size).toBe(90);
    expect(CreateSessionBodySchema.parse({ size: 120 }).size).toBe(120);
  });

  it('rejects size < 45 or > 120 or non-integer', () => {
    expect(CreateSessionBodySchema.safeParse({ size: 44 }).success).toBe(false);
    expect(CreateSessionBodySchema.safeParse({ size: 121 }).success).toBe(false);
    expect(CreateSessionBodySchema.safeParse({ size: 50.5 }).success).toBe(false);
  });
});

describe('AnswerBodySchema', () => {
  it('accepts valid class answers without timeMs', () => {
    const parsed = AnswerBodySchema.parse({ answer: 'covid19' });
    expect(parsed.answer).toBe('covid19');
    expect(parsed.timeMs).toBeUndefined();
  });

  it('accepts valid class answers with optional timeMs', () => {
    const parsed = AnswerBodySchema.parse({ answer: 'pneumonia', timeMs: 4500 });
    expect(parsed.answer).toBe('pneumonia');
    expect(parsed.timeMs).toBe(4500);
  });

  it('rejects invalid answers or out-of-range timeMs', () => {
    expect(AnswerBodySchema.safeParse({ answer: 'cancer' }).success).toBe(false);
    expect(AnswerBodySchema.safeParse({ answer: 'normal', timeMs: -1 }).success).toBe(false);
    expect(AnswerBodySchema.safeParse({ answer: 'normal', timeMs: 600001 }).success).toBe(false);
  });
});

describe('QuestionPublicSchema & SessionPublicSchema', () => {
  const sampleQuestion = {
    no: 1,
    imageUrl: '/api/images/pub123/file',
    answered: false,
    answer: null,
  };

  it('validates public question item', () => {
    const parsed = QuestionPublicSchema.parse(sampleQuestion);
    expect(parsed.no).toBe(1);
    expect(parsed.answered).toBe(false);
    expect(parsed.answer).toBeNull();
  });

  it('validates answered question item', () => {
    const parsed = QuestionPublicSchema.parse({
      ...sampleQuestion,
      answered: true,
      answer: 'normal',
    });
    expect(parsed.answered).toBe(true);
    expect(parsed.answer).toBe('normal');
  });

  it('validates full public session structure', () => {
    const session = {
      id: 'sess123',
      index: 1,
      kind: 'baseline',
      status: 'in_progress',
      size: 60,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      answeredCount: 1,
      questions: [sampleQuestion],
    };
    const parsed = SessionPublicSchema.parse(session);
    expect(parsed.id).toBe('sess123');
    expect(parsed.questions).toHaveLength(1);
  });

  it('validates session summary', () => {
    const summary = {
      id: 'sess123',
      index: 1,
      kind: 'baseline',
      status: 'finished',
      size: 60,
      startedAt: '2026-11-01T20:00:00.000Z',
      finishedAt: '2026-11-01T20:30:00.000Z',
      answeredCount: 60,
      overallAccuracy: 0.85,
    };
    const parsed = SessionSummarySchema.parse(summary);
    expect(parsed.overallAccuracy).toBe(0.85);
  });
});

describe('ClassMetricsSchema & SessionReportSchema', () => {
  it('validates single report review item', () => {
    const item = {
      no: 1,
      imageUrl: '/api/images/pub_123/file',
      trueClass: 'covid19',
      answer: 'pneumonia',
      correct: false,
      bucket: 'hard',
      difficulty: 0.75,
    };
    const parsed = ReportItemSchema.parse(item);
    expect(parsed.correct).toBe(false);
    expect(parsed.difficulty).toBe(0.75);
  });

  const dummyMetrics = {
    tp: 18,
    fp: 2,
    fn: 2,
    tn: 38,
    accuracy: 0.9,
    precision: 0.9,
    recall: 0.9,
    f1: 0.9,
    fpr: 0.05,
    fnr: 0.1,
  };

  it('validates raw class metrics', () => {
    const parsed = ClassMetricsSchema.parse(dummyMetrics);
    expect(parsed.tp).toBe(18);
    expect(parsed.f1).toBe(0.9);
  });

  it('rejects negative or out-of-bounds metrics', () => {
    expect(ClassMetricsSchema.safeParse({ ...dummyMetrics, tp: -1 }).success).toBe(false);
    expect(ClassMetricsSchema.safeParse({ ...dummyMetrics, accuracy: 1.1 }).success).toBe(false);
  });

  it('validates complete session report schema', () => {
    const report = {
      sessionId: 'sess_1',
      index: 1,
      kind: 'baseline',
      size: 60,
      answeredCount: 60,
      unansweredCount: 0,
      overall: { correct: 54, total: 60, accuracy: 0.9 },
      confusion: {
        covid19: { covid19: 18, pneumonia: 1, normal: 1 },
        pneumonia: { covid19: 0, pneumonia: 19, normal: 1 },
        normal: { covid19: 1, pneumonia: 1, normal: 18 },
      },
      perClass: {
        covid19: dummyMetrics,
        pneumonia: dummyMetrics,
        normal: dummyMetrics,
      },
      byClassBucket: {
        covid19: {
          easy: { correct: 8, incorrect: 0 },
          medium: { correct: 5, incorrect: 1 },
          hard: { correct: 5, incorrect: 1 },
        },
        pneumonia: {
          easy: { correct: 8, incorrect: 0 },
          medium: { correct: 6, incorrect: 0 },
          hard: { correct: 5, incorrect: 1 },
        },
        normal: {
          easy: { correct: 8, incorrect: 0 },
          medium: { correct: 5, incorrect: 1 },
          hard: { correct: 5, incorrect: 1 },
        },
      },
      mastered: true,
      perClassMastered: {
        covid19: true,
        pneumonia: true,
        normal: true,
      },
      plan: {
        classCounts: { covid19: 20, pneumonia: 20, normal: 20 },
        bucketCounts: {
          covid19: { easy: 8, medium: 6, hard: 6 },
          pneumonia: { easy: 8, medium: 6, hard: 6 },
          normal: { easy: 8, medium: 6, hard: 6 },
        },
        weights: { covid19: 0.333, pneumonia: 0.333, normal: 0.334 },
        errors: null,
        shortfalls: [],
        deficit: 0,
      },
      review: [
        {
          no: 1,
          imageUrl: '/api/images/pub1/file',
          trueClass: 'covid19',
          answer: 'covid19',
          correct: true,
          bucket: 'easy',
          difficulty: 0.12,
        },
      ],
    };

    const parsed = SessionReportSchema.parse(report);
    expect(parsed.mastered).toBe(true);
    expect(parsed.review[0].difficulty).toBe(0.12);
  });
});

describe('ProgressSchema & AdminResidentSummarySchema', () => {
  it('validates progress schema', () => {
    const progress = {
      sessions: [
        {
          id: 'sess_1',
          index: 1,
          kind: 'baseline',
          finishedAt: new Date().toISOString(),
          overallAccuracy: 0.85,
          perClass: {
            covid19: { accuracy: 0.8, fpr: 0.05, fnr: 0.2 },
            pneumonia: { accuracy: 0.9, fpr: 0.1, fnr: 0.1 },
            normal: { accuracy: 0.85, fpr: 0.05, fnr: 0.15 },
          },
          mastered: true,
        },
      ],
      currentWeights: { covid19: 0.4, pneumonia: 0.3, normal: 0.3 },
      currentErrors: null,
      topConfusions: [{ trueClass: 'covid19', predicted: 'pneumonia', count: 4 }],
      totals: { sessionsFinished: 1, answered: 60 },
    };

    const parsed = ProgressSchema.parse(progress);
    expect(parsed.sessions).toHaveLength(1);
    expect(parsed.topConfusions[0].trueClass).toBe('covid19');
  });

  it('validates admin resident summary', () => {
    const adminUser = {
      id: 'user_1',
      email: 'resident@example.com',
      displayName: 'Dr. Resident',
      sessionsFinished: 2,
      lastAccuracy: 0.88,
      lastActiveAt: '2026-11-01T20:00:00.000Z',
      createdAt: '2026-10-25T10:00:00.000Z',
    };
    const parsed = AdminResidentSummarySchema.parse(adminUser);
    expect(parsed.sessionsFinished).toBe(2);
    expect(parsed.lastAccuracy).toBe(0.88);
  });
});
