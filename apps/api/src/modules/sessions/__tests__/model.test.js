import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { SessionModel, ResponseModel } from '../model.js';
import { setupTestDb } from '../../../../test/helpers/testDb.js';

describe('Session and Response Mongoose Models', () => {
  let testDb;

  beforeAll(async () => {
    testDb = await setupTestDb();
    await SessionModel.syncIndexes();
    await ResponseModel.syncIndexes();
  });

  afterAll(async () => {
    if (testDb) {
      await testDb.teardown();
    }
  });

  beforeEach(async () => {
    await testDb.clearCollections();
  });

  describe('SessionModel', () => {
    it('creates and retrieves a valid session with questions', async () => {
      const userId = new mongoose.Types.ObjectId();
      const session = await SessionModel.create({
        userId,
        index: 1,
        kind: 'baseline',
        status: 'in_progress',
        size: 60,
        questions: [
          {
            no: 1,
            imageId: 'cohen_1',
            publicId: 'pub_1234567890abcdef',
            trueClass: 'covid19',
            bucket: 'easy',
            difficulty: 0.15,
            confusedWith: 'pneumonia',
          },
        ],
      });

      expect(session._id).toBeDefined();
      expect(session.index).toBe(1);
      expect(session.kind).toBe('baseline');
      expect(session.status).toBe('in_progress');
      expect(session.questions).toHaveLength(1);
      expect(session.questions[0].publicId).toBe('pub_1234567890abcdef');
    });

    it('enforces compound unique index on { userId, index }', async () => {
      const userId = new mongoose.Types.ObjectId();
      await SessionModel.create({
        userId,
        index: 1,
        kind: 'baseline',
        size: 60,
      });

      await expect(
        SessionModel.create({
          userId,
          index: 1,
          kind: 'adaptive',
          size: 60,
        }),
      ).rejects.toThrow();
    });

    it('allows same index for different users', async () => {
      const user1 = new mongoose.Types.ObjectId();
      const user2 = new mongoose.Types.ObjectId();

      const s1 = await SessionModel.create({ userId: user1, index: 1, kind: 'baseline', size: 60 });
      const s2 = await SessionModel.create({ userId: user2, index: 1, kind: 'baseline', size: 60 });

      expect(s1.index).toBe(1);
      expect(s2.index).toBe(1);
    });

    it('queries sessions containing publicId efficiently via multikey index', async () => {
      const userId = new mongoose.Types.ObjectId();
      await SessionModel.create({
        userId,
        index: 1,
        kind: 'baseline',
        size: 60,
        questions: [
          {
            no: 1,
            imageId: 'img_1',
            publicId: 'target_public_id',
            trueClass: 'normal',
            bucket: 'easy',
            difficulty: 0.2,
            confusedWith: 'pneumonia',
          },
        ],
      });

      const found = await SessionModel.findOne({
        userId,
        'questions.publicId': 'target_public_id',
      });
      expect(found).not.toBeNull();

      const notFound = await SessionModel.findOne({
        userId,
        'questions.publicId': 'non_existent_public_id',
      });
      expect(notFound).toBeNull();
    });
  });

  describe('ResponseModel', () => {
    it('creates and retrieves a valid response document', async () => {
      const sessionId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      const resp = await ResponseModel.create({
        sessionId,
        userId,
        questionNo: 1,
        imageId: 'cohen_1',
        trueClass: 'covid19',
        answer: 'covid19',
        bucket: 'easy',
        correct: true,
        timeMs: 2500,
      });

      expect(resp._id).toBeDefined();
      expect(resp.questionNo).toBe(1);
      expect(resp.correct).toBe(true);
      expect(resp.timeMs).toBe(2500);
    });

    it('enforces compound unique index on { sessionId, questionNo }', async () => {
      const sessionId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      await ResponseModel.create({
        sessionId,
        userId,
        questionNo: 1,
        imageId: 'img_1',
        trueClass: 'normal',
        answer: 'normal',
        bucket: 'easy',
        correct: true,
      });

      await expect(
        ResponseModel.create({
          sessionId,
          userId,
          questionNo: 1,
          imageId: 'img_1',
          trueClass: 'normal',
          answer: 'pneumonia',
          bucket: 'easy',
          correct: false,
        }),
      ).rejects.toThrow();
    });
  });
});
