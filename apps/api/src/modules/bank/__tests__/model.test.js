import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { QuestionBankModel, QuestionGenAttemptModel } from '../model.js';
import { setupTestDb } from '../../../../test/helpers/testDb.js';

describe('QuestionBank and QuestionGenAttempt Models', () => {
  let testDb;

  beforeAll(async () => {
    testDb = await setupTestDb();
    await QuestionBankModel.syncIndexes();
    await QuestionGenAttemptModel.syncIndexes();
  });

  afterAll(async () => {
    if (testDb) {
      await testDb.teardown();
    }
  });

  beforeEach(async () => {
    await testDb.clearCollections();
  });

  const baseQuestionData = {
    stableId: '1111222233334444555566667777888899990000',
    imageId: 'cohen_100',
    type: 'finding',
    pair: {
      trueClass: 'covid19',
      confusedWith: 'pneumonia',
    },
    bucket: 'medium',
    stem: 'کدام یافته پاتولوژیک در کلیشه مشهود است؟',
    options: [
      { text: 'کدورت شیشه‌مات', key: 'ground_glass' },
      { text: 'تراکم ریوی', key: 'consolidation' },
      { text: 'هوابرونکوگرام', key: 'air_bronchograms' },
      { text: 'ریه شفاف طبیعی', key: 'clear_lungs' },
    ],
    correctIndex: 0,
    rationale: 'کدورت شیشه‌مات دوطرفه مشاهده می‌شود.',
    kbRef: null,
    tags: ['finding'],
    status: 'pending_review',
    edited: false,
    source: {
      model: 'gemini-3.8-flash',
      promptVersion: 'v1',
      analysisIds: ['an_1', 'an_2'],
    },
    history: [
      {
        action: 'created',
        by: 'system',
        at: new Date(),
        toStatus: 'pending_review',
      },
    ],
  };

  it('creates and retrieves a valid question bank document with pending_review status', async () => {
    const doc = await QuestionBankModel.create(baseQuestionData);
    expect(doc._id).toBeDefined();
    expect(doc.status).toBe('pending_review');
    expect(doc.edited).toBe(false);
    expect(doc.options).toHaveLength(4);
    expect(doc.history).toHaveLength(1);
    expect(doc.history[0].action).toBe('created');
  });

  it('enforces unique stableId index', async () => {
    await QuestionBankModel.create(baseQuestionData);
    await expect(QuestionBankModel.create(baseQuestionData)).rejects.toThrow();
  });

  it('approves a question from pending_review or rejected', async () => {
    const doc = await QuestionBankModel.create(baseQuestionData);
    expect(doc.status).toBe('pending_review');

    doc.approve({ by: 'instructor_1', note: 'تأیید شد' });
    await doc.save();

    const updated = await QuestionBankModel.findById(doc._id);
    expect(updated.status).toBe('approved');
    expect(updated.reviewedBy).toBe('instructor_1');
    expect(updated.reviewedAt).toBeDefined();
    expect(updated.note).toBe('تأیید شد');
    expect(updated.history).toHaveLength(2);
    expect(updated.history[1].action).toBe('approved');
    expect(updated.history[1].fromStatus).toBe('pending_review');
    expect(updated.history[1].toStatus).toBe('approved');
  });

  it('rejects a question from pending_review or approved', async () => {
    const doc = await QuestionBankModel.create(baseQuestionData);
    doc.reject({ by: 'instructor_1', note: 'کیفیت مناسب نیست' });
    await doc.save();

    const updated = await QuestionBankModel.findById(doc._id);
    expect(updated.status).toBe('rejected');
    expect(updated.reviewedBy).toBe('instructor_1');
    expect(updated.note).toBe('کیفیت مناسب نیست');
    expect(updated.history[1].action).toBe('rejected');
    expect(updated.history[1].toStatus).toBe('rejected');
  });

  it('edits a question, sets edited = true, resets status to pending_review, and records diff', async () => {
    const doc = await QuestionBankModel.create({
      ...baseQuestionData,
      status: 'approved',
    });

    const newStem = 'صورت جدید سؤال با جزئیات بیشتر؟';
    const newOptions = [
      { text: 'گزینه یک بازنویسی شده' },
      { text: 'گزینه دو' },
      { text: 'گزینه سه' },
      { text: 'گزینه چهار' },
    ];

    doc.edit({
      by: 'instructor_1',
      stem: newStem,
      options: newOptions,
      correctIndex: 0,
      rationale: 'توضیحات اصلاح شد.',
      note: 'متن شفاف‌تر شد',
    });
    await doc.save();

    const updated = await QuestionBankModel.findById(doc._id);
    expect(updated.status).toBe('pending_review'); // Reset to pending_review!
    expect(updated.edited).toBe(true);
    expect(updated.stem).toBe(newStem);
    expect(updated.options[0].text).toBe('گزینه یک بازنویسی شده');
    expect(updated.options[0].key).toBe('ground_glass'); // Preserves key!
    expect(updated.history).toHaveLength(2);

    const editHistory = updated.history[1];
    expect(editHistory.action).toBe('edited');
    expect(editHistory.fromStatus).toBe('approved');
    expect(editHistory.toStatus).toBe('pending_review');
    expect(editHistory.changes.stem.before).toBe(baseQuestionData.stem);
    expect(editHistory.changes.stem.after).toBe(newStem);
  });

  it('creates and retrieves QuestionGenAttempt documents', async () => {
    const attempt = await QuestionGenAttemptModel.create({
      imageId: 'cohen_100',
      promptVersion: 'v1',
      type: 'finding',
      candidate: { stem: 'Contains 123' },
      reasons: ['HAS_DIGIT'],
    });

    expect(attempt._id).toBeDefined();
    expect(attempt.reasons).toEqual(['HAS_DIGIT']);

    const found = await QuestionGenAttemptModel.findOne({ imageId: 'cohen_100' });
    expect(found.promptVersion).toBe('v1');
  });
});
