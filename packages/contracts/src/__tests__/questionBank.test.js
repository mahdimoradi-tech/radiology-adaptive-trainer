import { describe, it, expect } from 'vitest';
import {
  QUESTION_TYPES,
  QuestionTypeSchema,
  QUESTION_STATUSES,
  QuestionStatusSchema,
  QuestionOptionSchema,
  GeneratedQuestionSchema,
  GenerationOutputSchema,
  QuestionBankAdminSchema,
  QuestionBankStatsSchema,
  ApproveQuestionBodySchema,
  RejectQuestionBodySchema,
  EditQuestionBodySchema,
  QuestionBankQuerySchema,
  QuestionBankListResponseSchema,
  QuestionGenAttemptSchema,
} from '../questionBank.js';

describe('Question Bank Contracts', () => {
  it('validates question types and statuses', () => {
    expect(QUESTION_TYPES).toEqual(['finding', 'distribution', 'differential']);
    expect(QUESTION_STATUSES).toEqual(['pending_review', 'approved', 'rejected']);

    expect(QuestionTypeSchema.parse('finding')).toBe('finding');
    expect(QuestionTypeSchema.parse('distribution')).toBe('distribution');
    expect(QuestionTypeSchema.parse('differential')).toBe('differential');
    expect(() => QuestionTypeSchema.parse('unknown')).toThrow();

    expect(QuestionStatusSchema.parse('pending_review')).toBe('pending_review');
    expect(QuestionStatusSchema.parse('approved')).toBe('approved');
    expect(QuestionStatusSchema.parse('rejected')).toBe('rejected');
    expect(() => QuestionStatusSchema.parse('active')).toThrow();
  });

  it('validates QuestionOptionSchema', () => {
    const validWithKey = QuestionOptionSchema.parse({ text: 'کدورت ریوی', key: 'opacity' });
    expect(validWithKey.key).toBe('opacity');

    const validWithNullKey = QuestionOptionSchema.parse({ text: 'گزینه بدون کلید', key: null });
    expect(validWithNullKey.key).toBeNull();

    expect(() => QuestionOptionSchema.parse({ text: '', key: null })).toThrow();
  });

  it('validates GeneratedQuestionSchema with 4 options and rationale <= 300 chars', () => {
    const sample = {
      type: 'finding',
      stem: 'کدام الگوی پاتولوژیک در کلیشه زیر مشهود است؟',
      options: [
        { text: 'کدورت شیشه‌مات', key: 'ground_glass' },
        { text: 'هوابرونکوگرام', key: 'air_bronchograms' },
        { text: 'تراکم ریوی', key: 'consolidation' },
        { text: 'ریه شفاف طبیعی', key: 'clear_lungs' },
      ],
      correctIndex: 0,
      rationale: 'کدورت دوطرفه با الگوی گراند گلس مشخصه بارز کووید-۱۹ است.',
      kbRef: null,
      tags: ['covid19', 'ground_glass'],
    };

    const parsed = GeneratedQuestionSchema.parse(sample);
    expect(parsed.correctIndex).toBe(0);
    expect(parsed.options).toHaveLength(4);

    // Fails with 3 options
    expect(() =>
      GeneratedQuestionSchema.parse({
        ...sample,
        options: sample.options.slice(0, 3),
      }),
    ).toThrow();

    // Fails with invalid correctIndex
    expect(() =>
      GeneratedQuestionSchema.parse({
        ...sample,
        correctIndex: 4,
      }),
    ).toThrow();

    // Fails if rationale > 300 chars
    expect(() =>
      GeneratedQuestionSchema.parse({
        ...sample,
        rationale: 'a'.repeat(301),
      }),
    ).toThrow();
  });

  it('validates GenerationOutputSchema for batched output', () => {
    const output = {
      items: [
        {
          imageIndex: 0,
          questions: [
            {
              type: 'finding',
              stem: 'کدام الگو دیده می‌شود؟',
              options: [
                { text: 'الف', key: 'opacity' },
                { text: 'ب', key: 'consolidation' },
                { text: 'ج', key: 'interstitial' },
                { text: 'د', key: 'clear_lungs' },
              ],
              correctIndex: 1,
              rationale: 'تراکم بارز ریوی مشاهده می‌شود.',
              kbRef: null,
              tags: [],
            },
          ],
        },
      ],
    };

    const parsed = GenerationOutputSchema.parse(output);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].questions).toHaveLength(1);
  });

  it('validates QuestionBankAdminSchema with full details and history', () => {
    const item = {
      id: '507f1f77bcf86cd799439011',
      stableId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      imageId: 'covid_123',
      type: 'differential',
      pair: {
        trueClass: 'covid19',
        confusedWith: 'pneumonia',
      },
      bucket: 'hard',
      stem: 'کدام یافته به نفع کووید-۱۹ در برابر ذات‌الریه باکتریایی است؟',
      options: [
        { text: 'درگیری دوطرفه محیطی و تحتانی', key: null },
        { text: 'تراکم تک‌لوب همراه با افیوژن پلورال بارز', key: null },
        { text: 'کاویتاسیون سریع', key: null },
        { text: 'پنوموتوراکس خودبه‌خودی', key: null },
      ],
      correctIndex: 0,
      rationale: 'کووید-۱۹ بیشتر نمای شیشه‌مات دوطرفه و محیطی ایجاد می‌کند.',
      kbRef: 'covid-vs-pneumonia-distribution',
      tags: ['differential', 'kb'],
      status: 'pending_review',
      edited: false,
      source: {
        model: 'gemini-3.8-flash',
        promptVersion: 'v1',
        analysisIds: ['analysis_1', 'analysis_2'],
      },
      reviewedBy: null,
      reviewedAt: null,
      note: null,
      history: [
        {
          action: 'created',
          by: 'system',
          at: new Date().toISOString(),
          toStatus: 'pending_review',
        },
      ],
      imageUrl: '/api/images/opaque1234567890/file',
      analysisSummary: {
        consensus: {
          patterns: ['ground_glass'],
          distribution: 'peripheral',
          laterality: 'bilateral',
          zones: ['lower'],
        },
        certaintyA: 'high',
        certaintyB: 'medium',
      },
    };

    const parsed = QuestionBankAdminSchema.parse(item);
    expect(parsed.status).toBe('pending_review');
    expect(parsed.history).toHaveLength(1);
    expect(parsed.pair.trueClass).toBe('covid19');
    expect(parsed.analysisSummary?.certaintyA).toBe('high');
  });

  it('validates QuestionBankStatsSchema', () => {
    const stats = {
      countsByStatus: {
        pending_review: 12,
        approved: 8,
        rejected: 2,
        total: 22,
      },
      countsByType: {
        finding: 14,
        distribution: 5,
        differential: 3,
      },
      countsByPair: {
        'covid19:pneumonia': 10,
        'pneumonia:covid19': 8,
        'normal:pneumonia': 4,
      },
    };

    const parsed = QuestionBankStatsSchema.parse(stats);
    expect(parsed.countsByStatus.total).toBe(22);
    expect(parsed.countsByType.finding).toBe(14);
  });

  it('validates approve, reject, and edit action request bodies', () => {
    expect(ApproveQuestionBodySchema.parse({ note: 'تأیید شد' }).note).toBe('تأیید شد');
    expect(ApproveQuestionBodySchema.parse({}).note).toBeUndefined();

    expect(RejectQuestionBodySchema.parse({ note: 'کیفیت مناسب نیست' }).note).toBe(
      'کیفیت مناسب نیست',
    );

    const editBody = {
      stem: 'ساقه ویرایش شده؟',
      options: [
        { text: 'گزینه ۱ ویرایش شده' },
        { text: 'گزینه ۲' },
        { text: 'گزینه ۳' },
        { text: 'گزینه ۴' },
      ],
      correctIndex: 2,
      rationale: 'توضیحات اصلاح شد.',
      note: 'متن گزینه شفاف‌تر شد',
    };
    const parsedEdit = EditQuestionBodySchema.parse(editBody);
    expect(parsedEdit.correctIndex).toBe(2);
    expect(parsedEdit.options).toHaveLength(4);

    expect(() =>
      EditQuestionBodySchema.parse({
        ...editBody,
        options: editBody.options.slice(0, 3),
      }),
    ).toThrow();
  });

  it('validates QuestionBankQuerySchema with coercion and defaults', () => {
    const query = QuestionBankQuerySchema.parse({
      status: 'pending_review',
      type: 'finding',
      trueClass: 'covid19',
      page: '2',
      pageSize: '10',
    });
    expect(query.page).toBe(2);
    expect(query.pageSize).toBe(10);
    expect(query.status).toBe('pending_review');

    const defaultQuery = QuestionBankQuerySchema.parse({});
    expect(defaultQuery.page).toBe(1);
    expect(defaultQuery.pageSize).toBe(20);
  });

  it('validates QuestionBankListResponseSchema', () => {
    const response = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    };
    const parsed = QuestionBankListResponseSchema.parse(response);
    expect(parsed.total).toBe(0);
    expect(parsed.items).toEqual([]);
  });

  it('validates QuestionGenAttemptSchema for tracking rejections', () => {
    const attempt = {
      imageId: 'img_test_1',
      promptVersion: 'v1',
      type: 'finding',
      reasons: ['HAS_DIGIT', 'NOT_PERSIAN'],
      candidate: { stem: 'Contains 123 digit' },
    };
    const parsed = QuestionGenAttemptSchema.parse(attempt);
    expect(parsed.reasons).toEqual(['HAS_DIGIT', 'NOT_PERSIAN']);
  });
});
