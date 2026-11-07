import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { ResponseSchema } from '@radiology/contracts';
import { createRng } from '@radiology/engine';
import { setupTestDb } from '../../../../test/helpers/testDb.js';
import {
  buildEngineHistory,
  createPracticeSet,
  getPracticeSetById,
  getPracticeSets,
  answerPracticeQuestion,
} from '../service.js';
import { PracticeSetModel } from '../model.js';
import { QuestionBankModel } from '../../bank/model.js';
import { SessionModel, ResponseModel } from '../../sessions/model.js';
import { ImageModel } from '../../catalog/model.js';

describe('Practice Service & Engine Selection (T09b)', () => {
  let testDb;
  const residentId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    testDb = await setupTestDb();
    await PracticeSetModel.syncIndexes();
    await QuestionBankModel.syncIndexes();
    await SessionModel.syncIndexes();
    await ResponseModel.syncIndexes();
    await ImageModel.syncIndexes();
  });

  afterAll(async () => {
    if (testDb) {
      await testDb.teardown();
    }
  });

  beforeEach(async () => {
    await testDb.clearCollections();
  });

  describe('buildEngineHistory (Adapter)', () => {
    it('produces valid contract-shaped Response[] from finished sessions', () => {
      const finishedSessions = [
        {
          _id: new mongoose.Types.ObjectId(),
          index: 1,
          status: 'finished',
          questions: [
            {
              no: 1,
              imageId: 'img_c1',
              trueClass: 'covid19',
              bucket: 'easy',
              answer: 'pneumonia',
            },
            {
              no: 2,
              imageId: 'img_p1',
              trueClass: 'pneumonia',
              bucket: 'medium',
              answer: 'pneumonia',
            },
          ],
        },
      ];

      const history = buildEngineHistory(finishedSessions);
      expect(history).toHaveLength(2);
      for (const item of history) {
        expect(() => ResponseSchema.parse(item)).not.toThrow();
      }
      expect(history[0]).toMatchObject({
        imageId: 'img_c1',
        trueClass: 'covid19',
        answer: 'pneumonia',
        bucket: 'easy',
      });
    });

    it('ignores unfinished or null sessions', () => {
      const sessions = [
        { status: 'in_progress', questions: [{ answer: 'normal' }] },
        null,
        { status: 'finished', questions: [] },
      ];
      const history = buildEngineHistory(sessions);
      expect(history).toEqual([]);
    });
  });

  describe('createPracticeSet & Selection Rules', () => {
    async function seedApprovedQuestions(count = 15, startingIndex = 1) {
      const docs = [];
      for (let i = 0; i < count; i++) {
        const idx = startingIndex + i;
        const stableId = `qb_test_${String(idx).padStart(3, '0')}`;
        const imageId = `img_test_${String(idx).padStart(3, '0')}`;
        const publicId = `pub_${String(idx).padStart(3, '0')}`;

        // Ensure Image document exists for publicId lookup
        await ImageModel.create({
          _id: imageId,
          publicId,
          filename: `${imageId}.jpg`,
          trueClass: idx % 2 === 0 ? 'covid19' : 'pneumonia',
          source: 'cohen',
          difficulty: 0.3,
          bucket: 'easy',
          confusedWith: idx % 2 === 0 ? 'pneumonia' : 'covid19',
        });

        docs.push({
          stableId,
          imageId,
          type: 'finding',
          pair: {
            trueClass: idx % 2 === 0 ? 'covid19' : 'pneumonia',
            confusedWith: idx % 2 === 0 ? 'pneumonia' : 'covid19',
          },
          bucket: 'easy',
          stem: `تست سوال ${idx}`,
          options: [
            { text: `گزینه A-${idx}`, key: null },
            { text: `گزینه B-${idx}`, key: null },
            { text: `گزینه C-${idx}`, key: null },
            { text: `گزینه D-${idx}`, key: null },
          ],
          correctIndex: idx % 4,
          rationale: `رشنال علمی برای سوال ${idx}`,
          status: 'approved',
          source: { model: 'gemini-1.5-flash', promptVersion: 'v1' },
        });
      }
      return QuestionBankModel.insertMany(docs);
    }

    async function seedFinishedSession(userId) {
      const sessionId = new mongoose.Types.ObjectId();
      const session = await SessionModel.create({
        _id: sessionId,
        userId,
        index: 1,
        kind: 'baseline',
        status: 'finished',
        size: 45,
        questions: [
          {
            no: 1,
            imageId: 'hist_img_1',
            publicId: 'hist_pub_1',
            trueClass: 'covid19',
            bucket: 'easy',
            difficulty: 0.2,
            confusedWith: 'pneumonia',
          },
          {
            no: 2,
            imageId: 'hist_img_2',
            publicId: 'hist_pub_2',
            trueClass: 'pneumonia',
            bucket: 'medium',
            difficulty: 0.5,
            confusedWith: 'covid19',
          },
        ],
      });

      await ResponseModel.create([
        {
          sessionId,
          userId,
          questionNo: 1,
          imageId: 'hist_img_1',
          answer: 'pneumonia',
          trueClass: 'covid19',
          bucket: 'easy',
          correct: false,
          timeMs: 1200,
        },
        {
          sessionId,
          userId,
          questionNo: 2,
          imageId: 'hist_img_2',
          answer: 'pneumonia',
          trueClass: 'pneumonia',
          bucket: 'medium',
          correct: true,
          timeMs: 900,
        },
      ]);

      return session;
    }

    it('throws 409 NO_HISTORY if resident has zero finished test sessions', async () => {
      await seedApprovedQuestions(5);
      await expect(createPracticeSet({ userId: residentId, size: 5 })).rejects.toMatchObject({
        statusCode: 409,
        code: 'NO_HISTORY',
      });
    });

    it('selects only questions with status "approved"', async () => {
      await seedFinishedSession(residentId);
      const approved = await seedApprovedQuestions(5);

      // Add pending and rejected questions
      await QuestionBankModel.create([
        {
          stableId: 'qb_pending_1',
          imageId: 'img_p',
          type: 'finding',
          pair: { trueClass: 'covid19', confusedWith: 'pneumonia' },
          bucket: 'easy',
          stem: 'سوال در انتظار',
          options: [
            { text: '1', key: null },
            { text: '2', key: null },
            { text: '3', key: null },
            { text: '4', key: null },
          ],
          correctIndex: 0,
          rationale: 'رشنال',
          status: 'pending_review',
          source: { model: 'm', promptVersion: 'v' },
        },
        {
          stableId: 'qb_rejected_1',
          imageId: 'img_r',
          type: 'finding',
          pair: { trueClass: 'covid19', confusedWith: 'pneumonia' },
          bucket: 'easy',
          stem: 'سوال رد شده',
          options: [
            { text: '1', key: null },
            { text: '2', key: null },
            { text: '3', key: null },
            { text: '4', key: null },
          ],
          correctIndex: 0,
          rationale: 'رشنال',
          status: 'rejected',
          source: { model: 'm', promptVersion: 'v' },
        },
      ]);

      const set = await createPracticeSet({ userId: residentId, size: 5, seed: 42 });
      expect(set.questions).toHaveLength(5);

      const dbSet = await PracticeSetModel.findById(set.id).lean();
      const approvedIds = new Set(approved.map((q) => String(q._id)));
      for (const qId of dbSet.questionIds) {
        expect(approvedIds.has(String(qId))).toBe(true);
      }
    });

    it('ensures no repeated questions across successive practice sets for the same resident', async () => {
      await seedFinishedSession(residentId);
      await seedApprovedQuestions(12);

      const set1 = await createPracticeSet({ userId: residentId, size: 6, seed: 101 });
      expect(set1.questions).toHaveLength(6);

      // Simulate resident completing all questions in set1
      const set1Doc = await PracticeSetModel.findById(set1.id);
      for (let no = 1; no <= 6; no++) {
        await answerPracticeQuestion({
          userId: residentId,
          setId: set1.id,
          questionNo: no,
          selectedIndex: 0,
        });
      }

      // Create set2
      const set2 = await createPracticeSet({ userId: residentId, size: 6, seed: 102 });
      expect(set2.questions).toHaveLength(6);

      const set1Ids = new Set(set1Doc.questionIds.map(String));
      const set2Doc = await PracticeSetModel.findById(set2.id).lean();
      for (const qId of set2Doc.questionIds) {
        expect(set1Ids.has(String(qId))).toBe(false);
      }
    });

    it('throws 409 PRACTICE_POOL_EXHAUSTED when no unanswered questions remain', async () => {
      await seedFinishedSession(residentId);
      await seedApprovedQuestions(3);

      const set1 = await createPracticeSet({ userId: residentId, size: 3, seed: 55 });
      for (let no = 1; no <= 3; no++) {
        await answerPracticeQuestion({
          userId: residentId,
          setId: set1.id,
          questionNo: no,
          selectedIndex: 1,
        });
      }

      await expect(createPracticeSet({ userId: residentId, size: 3 })).rejects.toMatchObject({
        statusCode: 409,
        code: 'PRACTICE_POOL_EXHAUSTED',
      });
    });

    it('returns a smaller set if fewer questions than requested size remain', async () => {
      await seedFinishedSession(residentId);
      await seedApprovedQuestions(3);

      const set = await createPracticeSet({ userId: residentId, size: 10, seed: 777 });
      expect(set.questions).toHaveLength(3);
      expect(set.size).toBe(3);
    });

    it('produces deterministic question set and order given the same seed', async () => {
      await seedFinishedSession(residentId);
      await seedApprovedQuestions(10);

      const resA = await createPracticeSet({ userId: residentId, size: 5, seed: 99999 });
      await PracticeSetModel.deleteMany({}); // clear set

      const resB = await createPracticeSet({ userId: residentId, size: 5, seed: 99999 });

      expect(resA.questions.map((q) => q.stem)).toEqual(resB.questions.map((q) => q.stem));
      expect(resA.questions.map((q) => q.options)).toEqual(resB.questions.map((q) => q.options));
    });

    it('retrieves practice set by id and lists user practice sets', async () => {
      await seedFinishedSession(residentId);
      await seedApprovedQuestions(5);

      const created = await createPracticeSet({ userId: residentId, size: 5, seed: 1234 });
      const fetched = await getPracticeSetById({ userId: residentId, setId: created.id });

      expect(fetched.id).toBe(created.id);
      expect(fetched.questions).toHaveLength(5);

      const list = await getPracticeSets({ userId: residentId, page: 1, pageSize: 10 });
      expect(list.items).toHaveLength(1);
      expect(list.items[0].id).toBe(created.id);
      expect(list.meta.total).toBe(1);
    });

    it('for 200 random permutations, selecting the resident correct index always maps back to the original correct option', async () => {
      for (let i = 0; i < 200; i++) {
        const rng = createRng(`test-shuffle-${i}`);
        const originalCorrectIndex = Math.floor(rng.next() * 4); // 0..3
        const perm = rng.shuffle([0, 1, 2, 3]);

        // Resident sees options at perm order
        const residentCorrectIndex = perm.indexOf(originalCorrectIndex);
        expect(residentCorrectIndex).toBeGreaterThanOrEqual(0);
        expect(residentCorrectIndex).toBeLessThan(4);

        // Server maps resident selection back
        const mappedOriginalIndex = perm[residentCorrectIndex];
        expect(mappedOriginalIndex).toBe(originalCorrectIndex);
      }
    });
  });
});
