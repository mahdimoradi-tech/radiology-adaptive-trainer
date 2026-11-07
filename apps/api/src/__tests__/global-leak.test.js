import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { loadEnv } from '../config/env.js';
import { createLogger } from '../lib/logger.js';
import { setupTestDb } from '../../test/helpers/testDb.js';
import { seedFixtureImages, TEST_SALT } from '../../test/helpers/sessionFixture.js';
import { QuestionBankModel } from '../modules/bank/model.js';
import { ImageModel } from '../modules/catalog/model.js';
import { SessionModel } from '../modules/sessions/model.js';
import { PracticeSetModel } from '../modules/practice/model.js';

/**
 * Diagnostic keys strictly prohibited on resident-facing interfaces before session evaluation
 * per ADR 0008, ADR 0014, and Task T09b/T11.
 */
export const FORBIDDEN_RESIDENT_KEYS = new Set([
  'trueClass',
  'confusedWith',
  'bucket',
  'difficulty',
  'source',
  'catalogId',
  'imageId',
  'filename',
  'passwordHash',
  'questionIds',
  'optionOrder',
  'plan',
  'consensus',
  'analysis',
  'promptVersion',
]);

/**
 * Dataset names whose presence in any ID or string leaks the ground-truth disease class
 */
export const FORBIDDEN_DATASET_SUBSTRINGS = ['cohen', 'kermany', 'figure1'];

/**
 * Deep recursive scanner verifying that a response payload contains zero diagnostic leakage
 * @param {any} rootObj
 * @param {object} [options]
 * @param {Set<string>} [options.forbiddenKeys=FORBIDDEN_RESIDENT_KEYS]
 * @param {string[]} [options.allowedKeys=[]]
 */
export function assertZeroLabelLeakage(rootObj, options = {}) {
  const forbidden = options.forbiddenKeys || FORBIDDEN_RESIDENT_KEYS;
  const allowed = new Set(options.allowedKeys || []);

  const serialized = JSON.stringify(rootObj);
  for (const sub of FORBIDDEN_DATASET_SUBSTRINGS) {
    if (serialized && serialized.toLowerCase().includes(sub)) {
      throw new Error(`Forbidden dataset substring "${sub}" detected in serialized payload`);
    }
  }

  function walk(val, path = '$') {
    if (!val || typeof val !== 'object') return;

    if (Array.isArray(val)) {
      val.forEach((item, idx) => walk(item, `${path}[${idx}]`));
      return;
    }

    for (const [key, propVal] of Object.entries(val)) {
      if (forbidden.has(key) && !allowed.has(key)) {
        throw new Error(`Forbidden key "${key}" detected at path "${path}.${key}"`);
      }
      walk(propVal, `${path}.${key}`);
    }
  }

  walk(rootObj);
}

describe('Global Label Leakage Prevention & Response Deep-Scan (Step 2 - Hardening)', () => {
  let app;
  let testDb;
  let residentCookie;

  beforeAll(async () => {
    testDb = await setupTestDb();
    await ImageModel.syncIndexes();
    await QuestionBankModel.syncIndexes();
    await SessionModel.syncIndexes();
    await PracticeSetModel.syncIndexes();

    const config = loadEnv({
      NODE_ENV: 'test',
      JWT_SECRET: 'jwt-leak-scanner-super-secret-key-32chars',
      PUBLIC_ID_SALT: TEST_SALT,
      ALLOW_REPEATS: 'true',
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
    await seedFixtureImages(6, TEST_SALT);

    // Register a test resident
    const regRes = await request(app).post('/api/auth/register').send({
      email: 'leak.check.resident@hospital.test',
      password: 'SecurePassword123!',
      displayName: 'Dr. Leak Check',
    });
    expect(regRes.status).toBe(201);
    residentCookie = regRes.headers['set-cookie'];
  });

  describe('Scanner Self-Verification (Fails on Violations)', () => {
    it('throws error when a forbidden key is present in an object', () => {
      expect(() => {
        assertZeroLabelLeakage({ imageId: 'cohen_100', publicId: 'abc12345678901234567' });
      }).toThrow(/Forbidden dataset substring "cohen"|Forbidden key "imageId"/);
    });

    it('throws error when trueClass is present in a nested structure', () => {
      expect(() => {
        assertZeroLabelLeakage({
          data: {
            questions: [{ publicId: 'abc', details: { trueClass: 'covid19' } }],
          },
        });
      }).toThrow(/Forbidden key "trueClass"/);
    });

    it('throws error when difficulty or bucket is present', () => {
      expect(() => {
        assertZeroLabelLeakage({
          data: { bucket: 'easy', difficulty: 0.2 },
        });
      }).toThrow(/Forbidden key "bucket"/);
    });

    it('throws error when a dataset substring appears in a harmlessly named property', () => {
      expect(() => {
        assertZeroLabelLeakage({
          description: 'This radiograph comes from kermany dataset',
        });
      }).toThrow(/Forbidden dataset substring "kermany"/);
    });

    it('passes cleanly when only public identifiers and non-clinical data are present', () => {
      expect(() => {
        assertZeroLabelLeakage({
          id: '507f1f77bcf86cd799439011',
          publicId: 'a1b2c3d4e5f607182930',
          imageUrl: '/api/images/a1b2c3d4e5f607182930/file',
          options: ['covid19', 'pneumonia', 'normal'],
        });
      }).not.toThrow();
    });
  });

  describe('Resident Endpoints Deep Leak Scan', () => {
    it('guarantees zero diagnostic leakage on GET /api/me', async () => {
      const res = await request(app).get('/api/me').set('Cookie', residentCookie);

      expect(res.status).toBe(200);
      assertZeroLabelLeakage(res.body);
    });

    it('guarantees zero diagnostic leakage during active training session lifecycle', async () => {
      // 1. POST /api/sessions (Create session)
      const createRes = await request(app)
        .post('/api/sessions')
        .set('Cookie', residentCookie)
        .set('Content-Type', 'application/json')
        .send({ size: 45 });

      expect(createRes.status).toBe(201);
      assertZeroLabelLeakage(createRes.body);

      const sessionId = createRes.body.data.id;
      const firstQuestion = createRes.body.data.questions[0];
      expect(firstQuestion.imageUrl).toBeDefined();
      expect(firstQuestion.no).toBe(1);

      // 2. GET /api/sessions (List sessions in-progress)
      const listRes = await request(app).get('/api/sessions').set('Cookie', residentCookie);

      expect(listRes.status).toBe(200);
      assertZeroLabelLeakage(listRes.body);

      // 3. GET /api/sessions/:id (In-progress session detail)
      const detailRes = await request(app)
        .get(`/api/sessions/${sessionId}`)
        .set('Cookie', residentCookie);

      expect(detailRes.status).toBe(200);
      assertZeroLabelLeakage(detailRes.body);

      // 4. PUT /api/sessions/:id/questions/1/answer (Submit answer before session finish)
      const answerRes = await request(app)
        .put(`/api/sessions/${sessionId}/questions/1/answer`)
        .set('Cookie', residentCookie)
        .set('Content-Type', 'application/json')
        .send({
          answer: 'covid19',
          timeMs: 2500,
        });

      expect(answerRes.status).toBe(200);
      assertZeroLabelLeakage(answerRes.body);

      // 5. Answer remaining questions to prepare for finish
      for (let i = 2; i <= 45; i++) {
        await request(app)
          .put(`/api/sessions/${sessionId}/questions/${i}/answer`)
          .set('Cookie', residentCookie)
          .set('Content-Type', 'application/json')
          .send({
            answer: 'covid19',
            timeMs: 1200,
          });
      }

      // 6. POST /api/sessions/:id/finish
      const finishRes = await request(app)
        .post(`/api/sessions/${sessionId}/finish`)
        .set('Cookie', residentCookie)
        .set('Content-Type', 'application/json')
        .send({});

      expect(finishRes.status).toBe(200);
      // In finished session report, verify zero internal IDs, zero filenames, zero dataset substrings
      assertZeroLabelLeakage(finishRes.body, {
        allowedKeys: ['trueClass', 'bucket', 'confusedWith', 'difficulty', 'plan'],
      });

      // 7. GET /api/sessions/:id/report (Session evaluation report)
      const reportRes = await request(app)
        .get(`/api/sessions/${sessionId}/report`)
        .set('Cookie', residentCookie);

      expect(reportRes.status).toBe(200);
      assertZeroLabelLeakage(reportRes.body, {
        allowedKeys: ['trueClass', 'bucket', 'confusedWith', 'difficulty', 'plan'],
      });

      // 8. GET /api/progress (Progress trajectory)
      const progressRes = await request(app).get('/api/progress').set('Cookie', residentCookie);

      expect(progressRes.status).toBe(200);
      assertZeroLabelLeakage(progressRes.body, {
        allowedKeys: ['trueClass', 'bucket', 'confusedWith'],
      });
    });

    it('guarantees zero diagnostic leakage on targeted practice lifecycle', async () => {
      // 1. Seed finished session to provide practice history
      const createRes = await request(app)
        .post('/api/sessions')
        .set('Cookie', residentCookie)
        .set('Content-Type', 'application/json')
        .send({ size: 45 });
      const sessionId = createRes.body.data.id;

      for (let i = 1; i <= 45; i++) {
        await request(app)
          .put(`/api/sessions/${sessionId}/questions/${i}/answer`)
          .set('Cookie', residentCookie)
          .set('Content-Type', 'application/json')
          .send({
            answer: 'covid19',
            timeMs: 1000,
          });
      }
      await request(app)
        .post(`/api/sessions/${sessionId}/finish`)
        .set('Cookie', residentCookie)
        .set('Content-Type', 'application/json')
        .send({});

      // 2. Seed approved question bank items
      const catalogImages = await ImageModel.find({}).limit(10);
      for (let i = 0; i < catalogImages.length; i++) {
        const img = catalogImages[i];
        await QuestionBankModel.create({
          stableId: `qb_leak_test_${String(i).padStart(3, '0')}`,
          imageId: img._id,
          type: 'finding',
          pair: { trueClass: 'covid19', confusedWith: 'pneumonia' },
          bucket: img.bucket,
          stem: `صورت سوال شماره ${i + 1}`,
          options: [
            { text: 'گزینه ۱', key: null },
            { text: 'گزینه ۲', key: null },
            { text: 'گزینه ۳', key: null },
            { text: 'گزینه ۴', key: null },
          ],
          correctIndex: 0,
          rationale: 'توضیحات آموزشی مجاز',
          status: 'approved',
          source: {
            model: 'gemini-3.8-flash',
            promptVersion: 'v1',
            analysisIds: [],
          },
        });
      }

      // 3. POST /api/practice (Create practice set)
      const createPracticeRes = await request(app)
        .post('/api/practice')
        .set('Cookie', residentCookie)
        .set('Content-Type', 'application/json')
        .send({ size: 5 });

      expect(createPracticeRes.status).toBe(201);
      assertZeroLabelLeakage(createPracticeRes.body);

      const practiceId = createPracticeRes.body.data.id;

      // 4. GET /api/practice (List practice sets)
      const listPracticeRes = await request(app).get('/api/practice').set('Cookie', residentCookie);

      expect(listPracticeRes.status).toBe(200);
      assertZeroLabelLeakage(listPracticeRes.body);

      // 5. GET /api/practice/:id (Practice set detail)
      const getPracticeRes = await request(app)
        .get(`/api/practice/${practiceId}`)
        .set('Cookie', residentCookie);

      expect(getPracticeRes.status).toBe(200);
      assertZeroLabelLeakage(getPracticeRes.body);

      // 6. PUT /api/practice/:id/questions/1/answer (Submit practice answer)
      const answerPracticeRes = await request(app)
        .put(`/api/practice/${practiceId}/questions/1/answer`)
        .set('Cookie', residentCookie)
        .set('Content-Type', 'application/json')
        .send({ selectedIndex: 0 });

      expect(answerPracticeRes.status).toBe(200);
      assertZeroLabelLeakage(answerPracticeRes.body);
    });
  });
});
