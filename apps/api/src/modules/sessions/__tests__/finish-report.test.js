import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { SessionReportSchema } from '@radiology/contracts';
import { createApp } from '../../../app.js';
import { loadEnv } from '../../../config/env.js';
import { createLogger } from '../../../lib/logger.js';
import { setupTestDb } from '../../../../test/helpers/testDb.js';
import { seedFixtureImages, TEST_SALT } from '../../../../test/helpers/sessionFixture.js';
import { SessionModel } from '../model.js';

describe('Sessions API - Finish and Report Endpoints', () => {
  let app;
  let testDb;
  let residentCookie;
  let otherResidentCookie;
  let sessionId;

  beforeAll(async () => {
    testDb = await setupTestDb();
    const config = loadEnv({
      NODE_ENV: 'test',
      JWT_SECRET: 'session-secret-jwt-key-with-32-chars-minimum-xyz',
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
    await seedFixtureImages(14);

    // Register primary resident
    const regRes = await request(app).post('/api/auth/register').send({
      email: 'dr.finish@hospital.test',
      password: 'StrongPassword123!',
      displayName: 'Dr. Finish Test',
    });
    residentCookie = regRes.headers['set-cookie'];

    // Register secondary resident (for boundary isolation checks)
    const otherRegRes = await request(app).post('/api/auth/register').send({
      email: 'other.resident@hospital.test',
      password: 'StrongPassword123!',
      displayName: 'Dr. Other Resident',
    });
    otherResidentCookie = otherRegRes.headers['set-cookie'];

    // Create session of size 60
    const sessRes = await request(app)
      .post('/api/sessions')
      .set('Cookie', residentCookie)
      .send({ size: 60 });
    sessionId = sessRes.body.data.id;
  });

  describe('Test 4: Finish with partial answers and report generation', () => {
    it('returns 409 SESSION_NOT_FINISHED when requesting report before finish', async () => {
      const res = await request(app)
        .get(`/api/sessions/${sessionId}/report`)
        .set('Cookie', residentCookie);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SESSION_NOT_FINISHED');
    });

    it('finishes with unanswered questions: counts and metrics computed strictly from answered questions', async () => {
      // Fetch session questions from DB to simulate targeted answers
      const dbSession = await SessionModel.findById(sessionId).lean();

      // Answer only first 10 questions
      for (let i = 1; i <= 10; i++) {
        const q = dbSession.questions.find((item) => item.no === i);
        // Answer 8 correctly, 2 incorrectly
        const chosenAnswer = i <= 8 ? q.trueClass : q.confusedWith;
        const ansRes = await request(app)
          .put(`/api/sessions/${sessionId}/questions/${i}/answer`)
          .set('Cookie', residentCookie)
          .send({ answer: chosenAnswer, timeMs: 2500 });
        expect(ansRes.status).toBe(200);
      }

      // Finish session
      const finishRes = await request(app)
        .post(`/api/sessions/${sessionId}/finish`)
        .set('Cookie', residentCookie)
        .send({});

      expect(finishRes.status).toBe(200);
      const report = finishRes.body.data;

      // Validate report contract
      const parsedReport = SessionReportSchema.parse(report);
      expect(parsedReport.sessionId).toBe(sessionId);
      expect(parsedReport.size).toBe(60);
      expect(parsedReport.answeredCount).toBe(10);
      expect(parsedReport.unansweredCount).toBe(50);
      expect(parsedReport.overall.total).toBe(10);
      expect(parsedReport.overall.correct).toBe(8);
      expect(parsedReport.overall.accuracy).toBe(0.8);

      // Review contains all 60 items
      expect(parsedReport.review).toHaveLength(60);

      // Answered question review checks
      const answeredItem1 = parsedReport.review.find((r) => r.no === 1);
      expect(answeredItem1.answer).not.toBeNull();
      expect(answeredItem1.correct).toBe(true);
      expect(answeredItem1.difficulty).toBeDefined();

      // Unanswered question review checks
      const unansweredItem11 = parsedReport.review.find((r) => r.no === 11);
      expect(unansweredItem11.answer).toBeNull();
      expect(unansweredItem11.correct).toBeNull();
      expect(unansweredItem11.trueClass).toBeDefined();

      // Ensure session is marked finished in DB
      const finishedDb = await SessionModel.findById(sessionId).lean();
      expect(finishedDb.status).toBe('finished');
      expect(finishedDb.finishedAt).not.toBeNull();
      expect(finishedDb.metrics).toBeDefined();

      // Subsequent GET /api/sessions/:id/report returns the same report
      const getReportRes = await request(app)
        .get(`/api/sessions/${sessionId}/report`)
        .set('Cookie', residentCookie);
      expect(getReportRes.status).toBe(200);
      expect(getReportRes.body.data.overall.accuracy).toBe(0.8);
      expect(getReportRes.body.data.answeredCount).toBe(10);
    });

    it('returns 409 SESSION_ALREADY_FINISHED when finish is called a second time', async () => {
      // First finish
      const f1 = await request(app)
        .post(`/api/sessions/${sessionId}/finish`)
        .set('Cookie', residentCookie)
        .send({});
      expect(f1.status).toBe(200);

      // Second finish
      const f2 = await request(app)
        .post(`/api/sessions/${sessionId}/finish`)
        .set('Cookie', residentCookie)
        .send({});
      expect(f2.status).toBe(409);
      expect(f2.body.error.code).toBe('SESSION_ALREADY_FINISHED');
    });

    it('returns 404 when another resident attempts to finish or fetch report', async () => {
      // Finish by other resident
      const fRes = await request(app)
        .post(`/api/sessions/${sessionId}/finish`)
        .set('Cookie', otherResidentCookie)
        .send({});
      expect(fRes.status).toBe(404);

      // Finish by owner
      await request(app)
        .post(`/api/sessions/${sessionId}/finish`)
        .set('Cookie', residentCookie)
        .send({});

      // Report by other resident
      const repRes = await request(app)
        .get(`/api/sessions/${sessionId}/report`)
        .set('Cookie', otherResidentCookie);
      expect(repRes.status).toBe(404);
    });
  });
});
