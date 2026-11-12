import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { createLogger } from '../../lib/logger.js';
import { setupTestDb } from '../../../test/helpers/testDb.js';
import { seedFixtureImages, TEST_SALT } from '../../../test/helpers/sessionFixture.js';
import { UserModel } from '../../modules/auth/model.js';
import { SessionModel, ResponseModel } from '../../modules/sessions/model.js';
import { QuestionBankModel } from '../../modules/bank/model.js';

describe('Session Lifecycle & Question Bank Security Regression Tests (S12, S14)', () => {
  let app;
  let testDb;
  let residentUser;
  let residentCookie;
  const JWT_SECRET = 'lifecycle-security-jwt-key-32chars-min-xyz';

  beforeAll(async () => {
    testDb = await setupTestDb();
    const config = loadEnv({
      NODE_ENV: 'test',
      JWT_SECRET,
      PUBLIC_ID_SALT: TEST_SALT,
      RATE_LIMIT_ENABLED: 'false',
    });
    const logger = createLogger({ NODE_ENV: 'test' });
    app = createApp({ config, logger });
  });

  afterAll(async () => {
    if (testDb) {
      await testDb.teardown();
    }
  });

  beforeEach(async () => {
    await testDb.clearCollections();
    await seedFixtureImages(14); // 126 images for session creation

    residentUser = await UserModel.create({
      email: 'res.lifecycle@hospital.test',
      passwordHash: 'dummy',
      displayName: 'Lifecycle Trainee',
      role: 'resident',
    });
    const token = jwt.sign(
      { sub: String(residentUser._id), email: residentUser.email, role: 'resident' },
      JWT_SECRET,
    );
    residentCookie = [`rt_session=${token}; Path=/; HttpOnly`];
  });

  describe('S12 - Session Lifecycle Invariants', () => {
    it('forces baseline mode on first session for new resident', async () => {
      const res = await request(app)
        .post('/api/sessions')
        .set('Cookie', residentCookie)
        .send({ size: 45 });

      expect(res.status).toBe(201);
      expect(res.body.data.kind).toBe('baseline');
      expect(res.body.data.index).toBe(1);
    });

    it('rejects answering a question once session is marked finished with 409', async () => {
      const sessRes = await request(app)
        .post('/api/sessions')
        .set('Cookie', residentCookie)
        .send({ size: 45 });
      const sessionId = sessRes.body.data.id;

      // Mark finished
      await SessionModel.findByIdAndUpdate(sessionId, { status: 'finished' });

      const ansRes = await request(app)
        .put(`/api/sessions/${sessionId}/questions/1/answer`)
        .set('Cookie', residentCookie)
        .send({ answer: 'covid19' });

      expect(ansRes.status).toBe(409);
      expect(ansRes.body.error.code).toBe('SESSION_NOT_IN_PROGRESS');
    });

    it('rejects finishing an already finished session with 409', async () => {
      const sessRes = await request(app)
        .post('/api/sessions')
        .set('Cookie', residentCookie)
        .send({ size: 45 });
      const sessionId = sessRes.body.data.id;

      // Finish once
      const fin1 = await request(app)
        .post(`/api/sessions/${sessionId}/finish`)
        .set('Cookie', residentCookie)
        .send({});
      expect(fin1.status).toBe(200);

      // Finish twice
      const fin2 = await request(app)
        .post(`/api/sessions/${sessionId}/finish`)
        .set('Cookie', residentCookie)
        .send({});
      expect(fin2.status).toBe(409);
      expect(fin2.body.error.code).toBe('SESSION_ALREADY_FINISHED');
    });

    it('rejects question number out of bounds with 404 QUESTION_NOT_FOUND', async () => {
      const sessRes = await request(app)
        .post('/api/sessions')
        .set('Cookie', residentCookie)
        .send({ size: 45 });
      const sessionId = sessRes.body.data.id;

      // Question 0
      const res0 = await request(app)
        .put(`/api/sessions/${sessionId}/questions/0/answer`)
        .set('Cookie', residentCookie)
        .send({ answer: 'normal' });
      expect(res0.status).toBe(404);
      expect(res0.body.error.code).toBe('QUESTION_NOT_FOUND');

      // Question 46 (beyond size 45)
      const res46 = await request(app)
        .put(`/api/sessions/${sessionId}/questions/46/answer`)
        .set('Cookie', residentCookie)
        .send({ answer: 'normal' });
      expect(res46.status).toBe(404);
      expect(res46.body.error.code).toBe('QUESTION_NOT_FOUND');
    });

    it('enforces idempotency when answering same question multiple times', async () => {
      const sessRes = await request(app)
        .post('/api/sessions')
        .set('Cookie', residentCookie)
        .send({ size: 45 });
      const sessionId = sessRes.body.data.id;

      // Answer 1
      await request(app)
        .put(`/api/sessions/${sessionId}/questions/1/answer`)
        .set('Cookie', residentCookie)
        .send({ answer: 'covid19', timeMs: 1200 });

      // Answer 2 (updated choice)
      const res2 = await request(app)
        .put(`/api/sessions/${sessionId}/questions/1/answer`)
        .set('Cookie', residentCookie)
        .send({ answer: 'pneumonia', timeMs: 2500 });

      expect(res2.status).toBe(200);

      const count = await ResponseModel.countDocuments({ sessionId, questionNo: 1 });
      expect(count).toBe(1);

      const doc = await ResponseModel.findOne({ sessionId, questionNo: 1 });
      expect(doc.answer).toBe('pneumonia');
      expect(doc.timeMs).toBe(2500);
    });
  });

  describe('S14 - Question Bank Approval & Rationale Secrecy', () => {
    beforeEach(async () => {
      // Create a finished session for resident so targeted practice is allowed
      const session = await SessionModel.create({
        userId: residentUser._id,
        index: 1,
        kind: 'baseline',
        status: 'finished',
        size: 45,
        startedAt: new Date(),
        completedAt: new Date(),
        questions: [
          {
            no: 1,
            imageId: 'cohen_1',
            publicId: 'abc123def45678901234',
            trueClass: 'covid19',
            bucket: 'easy',
            difficulty: 0.25,
            confusedWith: 'normal',
          },
        ],
      });

      // Seed mistake response
      await ResponseModel.create({
        sessionId: session._id,
        userId: residentUser._id,
        questionNo: 1,
        imageId: 'cohen_1',
        trueClass: 'covid19',
        answer: 'normal',
        correct: false,
        bucket: 'easy',
        timeMs: 2000,
      });

      // Seed 3 questions in bank: 1 approved, 1 pending, 1 rejected
      await QuestionBankModel.create([
        {
          stableId: 'qb_appr_1',
          imageId: 'cohen_1',
          type: 'finding',
          pair: { trueClass: 'covid19', confusedWith: 'normal' },
          bucket: 'easy',
          stem: 'Approved question stem',
          options: [
            { text: 'گزینه ۱', key: 'opt_1' },
            { text: 'گزینه ۲', key: 'opt_2' },
            { text: 'گزینه ۳', key: 'opt_3' },
            { text: 'گزینه ۴', key: 'opt_4' },
          ],
          correctIndex: 0,
          rationale: 'Secret pedagogical rationale',
          status: 'approved',
          source: { model: 'gemini-3.8-flash', promptVersion: 'v1', analysisIds: [] },
        },
        {
          stableId: 'qb_pend_1',
          imageId: 'cohen_1',
          type: 'finding',
          pair: { trueClass: 'covid19', confusedWith: 'normal' },
          bucket: 'easy',
          stem: 'Pending question stem',
          options: [
            { text: 'گزینه ۱', key: 'opt_1' },
            { text: 'گزینه ۲', key: 'opt_2' },
            { text: 'گزینه ۳', key: 'opt_3' },
            { text: 'گزینه ۴', key: 'opt_4' },
          ],
          correctIndex: 1,
          rationale: 'Pending rationale',
          status: 'pending_review',
          source: { model: 'gemini-3.8-flash', promptVersion: 'v1', analysisIds: [] },
        },
        {
          stableId: 'qb_rej_1',
          imageId: 'cohen_1',
          type: 'finding',
          pair: { trueClass: 'covid19', confusedWith: 'normal' },
          bucket: 'easy',
          stem: 'Rejected question stem',
          options: [
            { text: 'گزینه ۱', key: 'opt_1' },
            { text: 'گزینه ۲', key: 'opt_2' },
            { text: 'گزینه ۳', key: 'opt_3' },
            { text: 'گزینه ۴', key: 'opt_4' },
          ],
          correctIndex: 2,
          rationale: 'Rejected rationale',
          status: 'rejected',
          source: { model: 'gemini-3.8-flash', promptVersion: 'v1', analysisIds: [] },
        },
      ]);
    });

    it('strictly loads only approved questions into practice sets and redacts rationale before answering', async () => {
      const res = await request(app)
        .post('/api/practice')
        .set('Cookie', residentCookie)
        .send({ size: 5 });

      expect(res.status).toBe(201);
      const practiceSet = res.body.data;

      // Only the 1 approved question must be included
      expect(practiceSet.questions).toHaveLength(1);
      const q = practiceSet.questions[0];
      expect(q.stem).toBe('Approved question stem');

      // Rationale and correctIndex must be completely absent prior to answer submission
      expect(q.answered).toBe(false);
      expect(q.feedback).toBeUndefined();
      expect(q.rationale).toBeUndefined();
      expect(q.correctIndex).toBeUndefined();
    });
  });
});
