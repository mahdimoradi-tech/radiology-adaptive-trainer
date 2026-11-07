import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../../app.js';
import { loadEnv } from '../../../config/env.js';
import { createLogger } from '../../../lib/logger.js';
import { setupTestDb } from '../../../../test/helpers/testDb.js';
import { TEST_SALT } from '../../../../test/helpers/sessionFixture.js';
import { PracticeSetModel } from '../model.js';
import { QuestionBankModel } from '../../bank/model.js';
import { SessionModel, ResponseModel } from '../../sessions/model.js';
import { ImageModel } from '../../catalog/model.js';
import { UserModel } from '../../auth/model.js';

describe('Practice Endpoints API (T09b - Targeted Practice)', () => {
  let app;
  let testDb;
  let config;
  let residentCookie;
  let residentUser;
  let otherResidentCookie;
  let instructorCookie;

  const FORBIDDEN_KEYS = new Set([
    'trueClass',
    'confusedWith',
    'bucket',
    'difficulty',
    'source',
    'note',
    'consensus',
    'analysis',
    'catalogId',
    'imageId',
    'filename',
    'generatedBy',
    'reviewedBy',
    'reviewedAt',
    'history',
    'plan',
    'optionOrder',
    'questionIds',
  ]);

  const FORBIDDEN_SUBSTRINGS = ['kermany', 'cohen', 'figure1'];

  function assertNoForbiddenKeys(obj, { allowRationaleAndCorrect = false } = {}) {
    const serialized = JSON.stringify(obj);
    for (const sub of FORBIDDEN_SUBSTRINGS) {
      expect(
        serialized.toLowerCase().includes(sub),
        `Found forbidden dataset substring "${sub}" in payload: ${serialized}`,
      ).toBe(false);
    }

    function walk(val, path = '$') {
      if (!val || typeof val !== 'object') return;

      if (Array.isArray(val)) {
        val.forEach((item, idx) => walk(item, `${path}[${idx}]`));
        return;
      }

      for (const [key, value] of Object.entries(val)) {
        if (FORBIDDEN_KEYS.has(key)) {
          throw new Error(`Forbidden key "${key}" leaked at ${path}.${key}`);
        }
        // Questions inside a practice set must never leak review status
        if (path.includes('questions[') && key === 'status') {
          throw new Error(`Review status leaked inside question at ${path}.${key}`);
        }
        if (!allowRationaleAndCorrect && (key === 'correctIndex' || key === 'rationale')) {
          throw new Error(`Premature leakage of "${key}" at ${path}.${key}`);
        }
        walk(value, `${path}.${key}`);
      }
    }

    walk(obj);
  }

  beforeAll(async () => {
    testDb = await setupTestDb();
    await PracticeSetModel.syncIndexes();
    await QuestionBankModel.syncIndexes();
    await SessionModel.syncIndexes();
    await ResponseModel.syncIndexes();
    await ImageModel.syncIndexes();
    await UserModel.syncIndexes();

    config = loadEnv({
      NODE_ENV: 'test',
      JWT_SECRET: 'jwt-super-secret-practice-test-key-32-chars-xyz',
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

  async function seedApprovedBank(count = 10) {
    const docs = [];
    for (let i = 1; i <= count; i++) {
      const stableId = `qb_test_${String(i).padStart(3, '0')}`;
      const imageId = `img_test_${String(i).padStart(3, '0')}`;
      const publicId = `pub_${String(i).padStart(3, '0')}`;

      await ImageModel.create({
        _id: imageId,
        publicId,
        filename: `${imageId}.jpg`,
        trueClass: i % 2 === 0 ? 'covid19' : 'pneumonia',
        source: 'cohen',
        difficulty: 0.25,
        bucket: 'easy',
        confusedWith: i % 2 === 0 ? 'pneumonia' : 'covid19',
      });

      docs.push({
        stableId,
        imageId,
        type: 'finding',
        pair: {
          trueClass: i % 2 === 0 ? 'covid19' : 'pneumonia',
          confusedWith: i % 2 === 0 ? 'pneumonia' : 'covid19',
        },
        bucket: 'easy',
        stem: `صورت سوال آزمایشی شماره ${i}`,
        options: [
          { text: `گزینه ۱-${i}`, key: null },
          { text: `گزینه ۲-${i}`, key: null },
          { text: `گزینه ۳-${i}`, key: null },
          { text: `گزینه ۴-${i}`, key: null },
        ],
        correctIndex: i % 4,
        rationale: `توضیحات آموزشی مصوب برای سوال ${i}`,
        status: 'approved',
        source: { model: 'gemini-1.5-flash', promptVersion: 'v1' },
      });
    }
    return QuestionBankModel.insertMany(docs);
  }

  async function seedFinishedSession(userId) {
    const sessionId = new mongoose.Types.ObjectId();
    await SessionModel.create({
      _id: sessionId,
      userId,
      index: 1,
      kind: 'baseline',
      status: 'finished',
      size: 45,
      questions: [
        {
          no: 1,
          imageId: 'img_test_001',
          publicId: 'pub_001',
          trueClass: 'covid19',
          bucket: 'easy',
          difficulty: 0.2,
          confusedWith: 'pneumonia',
        },
      ],
    });

    await ResponseModel.create({
      sessionId,
      userId,
      questionNo: 1,
      imageId: 'img_test_001',
      trueClass: 'covid19',
      answer: 'pneumonia',
      bucket: 'easy',
      correct: false,
      timeMs: 1200,
    });
  }

  beforeEach(async () => {
    await testDb.clearCollections();

    // 1. Register Resident 1
    const regRes = await request(app).post('/api/auth/register').send({
      email: 'resident.one@hospital.test',
      password: 'StrongPassword123!',
      displayName: 'Resident One',
    });
    expect(regRes.status).toBe(201);
    residentCookie = regRes.headers['set-cookie'];
    residentUser = regRes.body.data.user;

    // 2. Register Resident 2 (other resident)
    const regRes2 = await request(app).post('/api/auth/register').send({
      email: 'resident.two@hospital.test',
      password: 'StrongPassword123!',
      displayName: 'Resident Two',
    });
    expect(regRes2.status).toBe(201);
    otherResidentCookie = regRes2.headers['set-cookie'];

    // 3. Register Instructor
    const instructorUser = await UserModel.create({
      email: 'instructor@hospital.test',
      passwordHash: 'hashed-dummy',
      displayName: 'Dr. Instructor',
      role: 'instructor',
    });

    // Set JWT cookie for instructor directly:
    const token = (await import('jsonwebtoken')).default.sign(
      { sub: String(instructorUser._id), email: instructorUser.email, role: 'instructor' },
      config.JWT_SECRET,
    );
    instructorCookie = [`rt_session=${token}; Path=/; HttpOnly`];
  });

  describe('Authorization and Access Control', () => {
    it('returns 401 Unauthenticated when no auth cookie is provided', async () => {
      const res = await request(app).post('/api/practice').send({});
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 403 Forbidden when instructor attempts to access practice', async () => {
      const resPost = await request(app)
        .post('/api/practice')
        .set('Cookie', instructorCookie)
        .send({});
      expect(resPost.status).toBe(403);
      expect(resPost.body.error.code).toBe('FORBIDDEN');

      const resGet = await request(app).get('/api/practice').set('Cookie', instructorCookie);
      expect(resGet.status).toBe(403);
    });

    it('returns 404 NotFound when attempting to access another resident practice set', async () => {
      await seedApprovedBank(5);
      await seedFinishedSession(residentUser.id);

      const createRes = await request(app)
        .post('/api/practice')
        .set('Cookie', residentCookie)
        .send({ size: 5 });
      expect(createRes.status).toBe(201);
      const setId = createRes.body.data.id;

      // Other resident tries to access
      const getRes = await request(app)
        .get(`/api/practice/${setId}`)
        .set('Cookie', otherResidentCookie);
      expect(getRes.status).toBe(404);
      expect(getRes.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Practice Set Creation & Zero Leakage (POST /api/practice)', () => {
    it('returns 409 NO_HISTORY if resident has no finished test session', async () => {
      await seedApprovedBank(5);
      const res = await request(app)
        .post('/api/practice')
        .set('Cookie', residentCookie)
        .send({ size: 5 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('NO_HISTORY');
    });

    it('creates practice set, returns resident shape, and passes LEAK SCAN', async () => {
      await seedApprovedBank(10);
      await seedFinishedSession(residentUser.id);

      const res = await request(app)
        .post('/api/practice')
        .set('Cookie', residentCookie)
        .send({ size: 6 });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.size).toBe(6);
      expect(res.body.data.questions).toHaveLength(6);

      // Verify leak scan on create response
      assertNoForbiddenKeys(res.body, { allowRationaleAndCorrect: false });

      for (const q of res.body.data.questions) {
        expect(q.answered).toBe(false);
        expect(q.answer).toBeUndefined();
        expect(q.imageUrl).toMatch(/^\/api\/images\/pub_\d+\/file$/);
        expect(q.options).toHaveLength(4);
      }
    });
  });

  describe('Retrieval & History (GET /api/practice & GET /api/practice/:id)', () => {
    it('lists own practice sets with pagination and passes LEAK SCAN', async () => {
      await seedApprovedBank(10);
      await seedFinishedSession(residentUser.id);

      await request(app).post('/api/practice').set('Cookie', residentCookie).send({ size: 5 });

      const res = await request(app).get('/api/practice').set('Cookie', residentCookie);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);

      assertNoForbiddenKeys(res.body, { allowRationaleAndCorrect: false });
    });

    it('retrieves detailed set by id and passes LEAK SCAN', async () => {
      await seedApprovedBank(10);
      await seedFinishedSession(residentUser.id);

      const createRes = await request(app)
        .post('/api/practice')
        .set('Cookie', residentCookie)
        .send({ size: 5 });
      const setId = createRes.body.data.id;

      const res = await request(app).get(`/api/practice/${setId}`).set('Cookie', residentCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(setId);
      assertNoForbiddenKeys(res.body, { allowRationaleAndCorrect: false });
    });
  });

  describe('Answering Questions (PUT /api/practice/:id/questions/:no/answer)', () => {
    it('validates question number and selectedIndex bounds', async () => {
      await seedApprovedBank(5);
      await seedFinishedSession(residentUser.id);

      const createRes = await request(app)
        .post('/api/practice')
        .set('Cookie', residentCookie)
        .send({ size: 5 });
      const setId = createRes.body.data.id;

      // Invalid question number
      const resInvalidNo = await request(app)
        .put(`/api/practice/${setId}/questions/99/answer`)
        .set('Cookie', residentCookie)
        .send({ selectedIndex: 0 });
      expect(resInvalidNo.status).toBe(404);

      // Out of range selectedIndex
      const resBadIndex = await request(app)
        .put(`/api/practice/${setId}/questions/1/answer`)
        .set('Cookie', residentCookie)
        .send({ selectedIndex: 5 });
      expect(resBadIndex.status).toBe(400);
    });

    it('records answer, provides rationale, flags ALREADY_ANSWERED on second attempt, and marks completed on last', async () => {
      await seedApprovedBank(5);
      await seedFinishedSession(residentUser.id);

      const createRes = await request(app)
        .post('/api/practice')
        .set('Cookie', residentCookie)
        .send({ size: 5 });
      const setId = createRes.body.data.id;

      // 1. Answer question 1
      const ans1 = await request(app)
        .put(`/api/practice/${setId}/questions/1/answer`)
        .set('Cookie', residentCookie)
        .send({ selectedIndex: 0, timeMs: 1500 });

      expect(ans1.status).toBe(200);
      expect(ans1.body.data).toMatchObject({
        correct: expect.any(Boolean),
        correctIndex: expect.any(Number),
        rationale: expect.any(String),
        completed: false,
      });

      // Verify leak scan on answer response (rationale and correctIndex allowed)
      assertNoForbiddenKeys(ans1.body, { allowRationaleAndCorrect: true });

      // 2. Second attempt on question 1 -> 409 ALREADY_ANSWERED
      const dup = await request(app)
        .put(`/api/practice/${setId}/questions/1/answer`)
        .set('Cookie', residentCookie)
        .send({ selectedIndex: 1 });
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe('ALREADY_ANSWERED');

      // Answer questions 2, 3, 4
      for (let no = 2; no <= 4; no++) {
        const midAns = await request(app)
          .put(`/api/practice/${setId}/questions/${no}/answer`)
          .set('Cookie', residentCookie)
          .send({ selectedIndex: 1 });
        expect(midAns.status).toBe(200);
        expect(midAns.body.data.completed).toBe(false);
      }

      // 3. Answer question 5 (last question in set of size 5)
      const ans5 = await request(app)
        .put(`/api/practice/${setId}/questions/5/answer`)
        .set('Cookie', residentCookie)
        .send({ selectedIndex: 2 });

      expect(ans5.status).toBe(200);
      expect(ans5.body.data.completed).toBe(true);

      // 4. Retrieve completed set: answered questions now contain rationale and answer details
      const getSet = await request(app).get(`/api/practice/${setId}`).set('Cookie', residentCookie);

      expect(getSet.status).toBe(200);
      expect(getSet.body.data.status).toBe('completed');
      expect(getSet.body.data.answeredCount).toBe(5);

      for (const q of getSet.body.data.questions) {
        expect(q.answered).toBe(true);
        expect(q.answer).toBeDefined();
        expect(q.answer.rationale).toBeDefined();
      }

      // Check leak scan on completed set (rationale/correctIndex inside answer is allowed)
      assertNoForbiddenKeys(getSet.body, { allowRationaleAndCorrect: true });
    });
  });
});
