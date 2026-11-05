import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../../../app.js';
import { loadEnv } from '../../../config/env.js';
import { createLogger } from '../../../lib/logger.js';
import { setupTestDb } from '../../../../test/helpers/testDb.js';
import { UserModel } from '../../auth/model.js';
import { SessionModel, ResponseModel } from '../../sessions/model.js';
import { setCachedResponse, LlmCache } from '../cache.js';
import { LlmUsage } from '../budget.js';
import { getFakeProvider } from '../llm.service.js';

describe('LLM Endpoints Integration', () => {
  let app;
  let testDb;
  let residentCookie;
  let otherResidentCookie;
  let instructorCookie;
  let residentUser;
  let _otherResidentUser;
  let config;

  beforeAll(async () => {
    testDb = await setupTestDb();
    config = loadEnv({
      NODE_ENV: 'test',
      JWT_SECRET: 'session-secret-jwt-key-with-32-chars-minimum-xyz',
      PUBLIC_ID_SALT: 'salt-for-testing-purposes-16c',
      RATE_LIMIT_ENABLED: 'false',
      LLM_MODE: 'fake',
      LLM_DAILY_REQUEST_BUDGET: '16',
      LLM_MIN_INTERVAL_MS: '0',
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
    await LlmCache.syncIndexes();
    await LlmUsage.syncIndexes();
    getFakeProvider().reset();

    // Register Resident 1
    const r1 = await request(app).post('/api/auth/register').send({
      email: 'res.llm1@hospital.test',
      password: 'StrongPassword123!',
      displayName: 'Dr. LLM Trainee',
    });
    residentCookie = r1.headers['set-cookie'];
    residentUser = r1.body.data.user;

    // Register Resident 2 (for boundary checks)
    const r2 = await request(app).post('/api/auth/register').send({
      email: 'res.llm2@hospital.test',
      password: 'StrongPassword123!',
      displayName: 'Dr. Other Trainee',
    });
    otherResidentCookie = r2.headers['set-cookie'];
    _otherResidentUser = r2.body.data.user;

    // Create Instructor
    const hash = await bcrypt.hash('InstructorPassword123!', 4);
    await UserModel.create({
      email: 'chief.instructor@hospital.test',
      passwordHash: hash,
      displayName: 'Chief Instructor',
      role: 'instructor',
    });

    const instLogin = await request(app).post('/api/auth/login').send({
      email: 'chief.instructor@hospital.test',
      password: 'InstructorPassword123!',
    });
    instructorCookie = instLogin.headers['set-cookie'];
  });

  describe('POST /api/sessions/:id/explanations', () => {
    it('requires authentication (401)', async () => {
      const res = await request(app)
        .post('/api/sessions/507f191e810c19729de860ea/explanations')
        .send({ lang: 'fa' });
      expect(res.status).toBe(401);
    });

    it('returns 404 for session belonging to another resident', async () => {
      // Create session for resident 1
      const session = await SessionModel.create({
        userId: residentUser.id,
        index: 1,
        kind: 'baseline',
        status: 'finished',
        size: 45,
        questions: [],
      });

      // Attempt to access with resident 2 cookie
      const res = await request(app)
        .post(`/api/sessions/${session._id}/explanations`)
        .set('Cookie', otherResidentCookie)
        .send({ lang: 'fa' });

      expect(res.status).toBe(404);
    });

    it('returns 409 SESSION_NOT_FINISHED for an unfinished session', async () => {
      const session = await SessionModel.create({
        userId: residentUser.id,
        index: 1,
        kind: 'baseline',
        status: 'in_progress',
        size: 45,
        questions: [],
      });

      const res = await request(app)
        .post(`/api/sessions/${session._id}/explanations`)
        .set('Cookie', residentCookie)
        .send({ lang: 'fa' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SESSION_NOT_FINISHED');
    });

    it('returns fallback explanations first, and cache explanations after cache is populated', async () => {
      const session = await SessionModel.create({
        userId: residentUser.id,
        index: 1,
        kind: 'baseline',
        status: 'finished',
        size: 45,
        questions: [],
      });

      // Question 1 answered incorrectly (covid19 answered as pneumonia)
      await ResponseModel.create({
        sessionId: session._id,
        userId: residentUser.id,
        questionNo: 1,
        imageId: 'img1',
        trueClass: 'covid19',
        answer: 'pneumonia',
        bucket: 'easy',
        correct: false,
      });

      // Question 2 answered correctly (pneumonia answered as pneumonia)
      await ResponseModel.create({
        sessionId: session._id,
        userId: residentUser.id,
        questionNo: 2,
        imageId: 'img2',
        trueClass: 'pneumonia',
        answer: 'pneumonia',
        bucket: 'medium',
        correct: true,
      });

      // 1. Initial call -> fallback
      const res1 = await request(app)
        .post(`/api/sessions/${session._id}/explanations`)
        .set('Cookie', residentCookie)
        .send({ lang: 'fa' });

      expect(res1.status).toBe(200);
      expect(res1.body.source).toBe('fallback');
      expect(res1.body.items).toHaveLength(1);
      expect(res1.body.items[0].no).toBe(1);
      expect(res1.body.items[0].trueClass).toBe('covid19');
      expect(res1.body.items[0].userAnswer).toBe('pneumonia');

      // 2. Populate cache for (covid19, pneumonia)
      await setCachedResponse({
        promptId: 'explain-pairs',
        version: 'v1',
        input: { lang: 'fa', trueClass: 'covid19', userAnswer: 'pneumonia' },
        response: {
          whatToLookFor: ['یافته کش‌شده'],
          whyConfused: 'دلیل کش‌شده',
          tip: 'نکته کش‌شده',
        },
        portable: true,
        lang: 'fa',
      });

      // 3. Second call -> cache
      const res2 = await request(app)
        .post(`/api/sessions/${session._id}/explanations`)
        .set('Cookie', residentCookie)
        .send({ lang: 'fa' });

      expect(res2.status).toBe(200);
      expect(res2.body.source).toBe('cache');
      expect(res2.body.items).toHaveLength(1);
      expect(res2.body.items[0].whatToLookFor).toEqual(['یافته کش‌شده']);
    });
  });

  describe('POST /api/sessions/:id/report-narrative', () => {
    it('returns 409 for unfinished session', async () => {
      const session = await SessionModel.create({
        userId: residentUser.id,
        index: 1,
        kind: 'baseline',
        status: 'in_progress',
        size: 45,
        questions: [],
      });

      const res = await request(app)
        .post(`/api/sessions/${session._id}/report-narrative`)
        .set('Cookie', residentCookie)
        .send({ lang: 'fa' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SESSION_NOT_FINISHED');
    });

    it('generates narrative via provider, consumes 1 budget, and subsequent call hits cache', async () => {
      const session = await SessionModel.create({
        userId: residentUser.id,
        index: 1,
        kind: 'baseline',
        status: 'finished',
        size: 45,
        report: {
          summary: { total: 45, correct: 36, accuracy: 0.8 },
          classMetrics: [
            { classId: 'covid19', support: 15, accuracyPercent: 80 },
            { classId: 'pneumonia', support: 15, accuracyPercent: 73 },
            { classId: 'normal', support: 15, accuracyPercent: 87 },
          ],
          topConfusions: [{ trueClass: 'covid19', userAnswer: 'pneumonia', count: 3 }],
        },
        questions: [],
      });

      // First call -> calls fake provider -> source 'llm'
      const res1 = await request(app)
        .post(`/api/sessions/${session._id}/report-narrative`)
        .set('Cookie', residentCookie)
        .send({ lang: 'fa' });

      expect(res1.status).toBe(200);
      expect(res1.body.source).toBe('llm');
      expect(res1.body.reviewed).toBe(false);
      expect(res1.body.narrative.recommendations).toHaveLength(3);
      expect(getFakeProvider().calls).toHaveLength(1);

      // Verify 1 budget was consumed in Mongo
      const usageDoc = await LlmUsage.findOne().lean();
      expect(usageDoc.count).toBe(1);

      // Second call -> hits cache -> source 'cache'
      const res2 = await request(app)
        .post(`/api/sessions/${session._id}/report-narrative`)
        .set('Cookie', residentCookie)
        .send({ lang: 'fa' });

      expect(res2.status).toBe(200);
      expect(res2.body.source).toBe('cache');
      // No additional provider calls made
      expect(getFakeProvider().calls).toHaveLength(1);
      // Usage remains 1
      const usageDocAfter = await LlmUsage.findOne().lean();
      expect(usageDocAfter.count).toBe(1);
    });
  });

  describe('Rate Limiting on Narrative Endpoint', () => {
    it('returns 429 RATE_LIMITED when per-user rate limit is exceeded', async () => {
      const rateLimitedConfig = loadEnv({
        NODE_ENV: 'test',
        JWT_SECRET: 'session-secret-jwt-key-with-32-chars-minimum-xyz',
        PUBLIC_ID_SALT: 'salt-for-testing-purposes-16c',
        RATE_LIMIT_ENABLED: 'true',
        LLM_RATE_LIMIT_PER_USER_PER_HOUR: '2',
        LLM_MIN_INTERVAL_MS: '0',
        LLM_MODE: 'fake',
      });
      const testApp = createApp({ config: rateLimitedConfig });

      const session = await SessionModel.create({
        userId: residentUser.id,
        index: 1,
        kind: 'baseline',
        status: 'finished',
        size: 45,
        report: { summary: { total: 45, correct: 35, accuracy: 0.77 } },
        questions: [],
      });

      // Request 1
      const r1 = await request(testApp)
        .post(`/api/sessions/${session._id}/report-narrative`)
        .set('Cookie', residentCookie)
        .send({ lang: 'fa' });
      expect(r1.status).toBe(200);

      // Request 2
      const r2 = await request(testApp)
        .post(`/api/sessions/${session._id}/report-narrative`)
        .set('Cookie', residentCookie)
        .send({ lang: 'fa' });
      expect(r2.status).toBe(200);

      // Request 3 exceeds limit of 2 -> 429 RATE_LIMITED
      const r3 = await request(testApp)
        .post(`/api/sessions/${session._id}/report-narrative`)
        .set('Cookie', residentCookie)
        .send({ lang: 'fa' });
      expect(r3.status).toBe(429);
      expect(r3.body.error.code).toBe('RATE_LIMITED');
    });
  });

  describe('GET /api/admin/llm/status', () => {
    it('forbids resident trainees (403)', async () => {
      const res = await request(app).get('/api/admin/llm/status').set('Cookie', residentCookie);
      expect(res.status).toBe(403);
    });

    it('returns status for instructor (200)', async () => {
      const res = await request(app).get('/api/admin/llm/status').set('Cookie', instructorCookie);

      expect(res.status).toBe(200);
      expect(res.body.mode).toBe('fake');
      expect(res.body.model).toBe('gemini-3.8-flash');
      expect(res.body.today).toBeDefined();
      expect(res.body.today.budget).toBe(16);
      expect(res.body.cache).toBeDefined();
    });
  });
});
