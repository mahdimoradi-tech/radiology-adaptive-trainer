import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { ProgressSchema } from '@radiology/contracts';
import { createApp } from '../../../app.js';
import { loadEnv } from '../../../config/env.js';
import { createLogger } from '../../../lib/logger.js';
import { setupTestDb } from '../../../../test/helpers/testDb.js';
import { seedFixtureImages, TEST_SALT } from '../../../../test/helpers/sessionFixture.js';
import { SessionModel } from '../model.js';

describe('Sessions API - Adaptive Next-Test Flow and Progress Tracking', () => {
  let app;
  let testDb;
  let residentCookie;

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
    // 25 images per bin = 225 images total (ensures ample pool for 2 full sessions of 60 without repeats)
    await seedFixtureImages(25);

    // Register a test resident
    const regRes = await request(app).post('/api/auth/register').send({
      email: 'dr.adaptive@hospital.test',
      password: 'StrongPassword123!',
      displayName: 'Dr. Adaptive Test',
    });
    residentCookie = regRes.headers['set-cookie'];
  });

  describe('Test 5: Adaptive behavior end to end', () => {
    it('adapts question distribution to resident specific weakness on subsequent session', async () => {
      // 1. Create baseline session of 60 questions
      const s1Res = await request(app)
        .post('/api/sessions')
        .set('Cookie', residentCookie)
        .send({ size: 60 });
      expect(s1Res.status).toBe(201);
      expect(s1Res.body.data.kind).toBe('baseline');
      const s1Id = s1Res.body.data.id;

      // 2. Query session from DB to know the trueClass of each question
      const s1Db = await SessionModel.findById(s1Id).lean();
      expect(s1Db.questions).toHaveLength(60);

      // 3. Resident answers every COVID-19 question with 'pneumonia' (100% wrong),
      // and answers pneumonia and normal questions correctly.
      for (const q of s1Db.questions) {
        const answer = q.trueClass === 'covid19' ? 'pneumonia' : q.trueClass;
        const ansRes = await request(app)
          .put(`/api/sessions/${s1Id}/questions/${q.no}/answer`)
          .set('Cookie', residentCookie)
          .send({ answer, timeMs: 2000 });
        expect(ansRes.status).toBe(200);
      }

      // 4. Finish session 1
      const finish1Res = await request(app)
        .post(`/api/sessions/${s1Id}/finish`)
        .set('Cookie', residentCookie)
        .send({});
      expect(finish1Res.status).toBe(200);
      expect(finish1Res.body.data.overall.accuracy).toBeCloseTo(40 / 60, 2);

      // 5. Create session 2 (adaptive)
      const s2Res = await request(app)
        .post('/api/sessions')
        .set('Cookie', residentCookie)
        .send({ size: 60 });
      expect(s2Res.status).toBe(201);
      const s2 = s2Res.body.data;
      expect(s2.kind).toBe('adaptive');
      expect(s2.index).toBe(2);

      const s2Db = await SessionModel.findById(s2.id).lean();
      const plan = s2Db.plan;
      const counts = plan.classCounts;
      const weights = plan.weights;

      // Verify hand-computed expectations:
      // covid19 error (~0.98), pneumonia error (~0.55), normal error (~0.07)
      // weights (~0.61 / 0.34 / 0.04)
      expect(weights.covid19).toBeGreaterThan(weights.pneumonia);
      expect(weights.pneumonia).toBeGreaterThan(weights.normal);

      // minClassShare = 0.20 -> minClass = 12
      const minClass = 12;
      expect(counts.covid19).toBeGreaterThan(counts.pneumonia);
      expect(counts.pneumonia).toBeGreaterThanOrEqual(counts.normal);
      expect(counts.covid19).toBeGreaterThanOrEqual(1.5 * minClass); // >= 18
      expect(counts.normal).toBeLessThanOrEqual(minClass + 3); // <= 15

      // Verify no image was repeated across session 1 and session 2
      const s1ImageIds = new Set(s1Db.questions.map((q) => q.imageId));
      for (const q2 of s2Db.questions) {
        expect(s1ImageIds.has(q2.imageId)).toBe(false);
      }
    });
  });

  describe('Test 8: Progress trajectory tracking across sessions', () => {
    it('aggregates finished sessions into progress history with top confusions', async () => {
      // Create and finish session 1
      const s1Res = await request(app)
        .post('/api/sessions')
        .set('Cookie', residentCookie)
        .send({ size: 60 });
      const s1Id = s1Res.body.data.id;
      const s1Db = await SessionModel.findById(s1Id).lean();

      for (const q of s1Db.questions) {
        const answer = q.trueClass === 'covid19' ? 'pneumonia' : q.trueClass;
        await request(app)
          .put(`/api/sessions/${s1Id}/questions/${q.no}/answer`)
          .set('Cookie', residentCookie)
          .send({ answer });
      }
      await request(app)
        .post(`/api/sessions/${s1Id}/finish`)
        .set('Cookie', residentCookie)
        .send({});

      // Create and finish session 2
      const s2Res = await request(app)
        .post('/api/sessions')
        .set('Cookie', residentCookie)
        .send({ size: 60 });
      const s2Id = s2Res.body.data.id;
      const s2Db = await SessionModel.findById(s2Id).lean();

      for (const q of s2Db.questions) {
        await request(app)
          .put(`/api/sessions/${s2Id}/questions/${q.no}/answer`)
          .set('Cookie', residentCookie)
          .send({ answer: q.trueClass }); // all correct in session 2
      }
      await request(app)
        .post(`/api/sessions/${s2Id}/finish`)
        .set('Cookie', residentCookie)
        .send({});

      // Fetch progress
      const progRes = await request(app).get('/api/progress').set('Cookie', residentCookie);

      expect(progRes.status).toBe(200);
      const progress = ProgressSchema.parse(progRes.body.data);

      expect(progress.totals.sessionsFinished).toBe(2);
      expect(progress.totals.answered).toBe(120);
      expect(progress.sessions).toHaveLength(2);

      expect(progress.sessions[0].index).toBe(1);
      expect(progress.sessions[0].overallAccuracy).toBeCloseTo(40 / 60, 2);

      expect(progress.sessions[1].index).toBe(2);
      expect(progress.sessions[1].overallAccuracy).toBe(1.0);

      // Top confusion should be covid19 -> pneumonia
      expect(progress.topConfusions[0]).toEqual({
        trueClass: 'covid19',
        predicted: 'pneumonia',
        count: 20,
      });
    });
  });
});
