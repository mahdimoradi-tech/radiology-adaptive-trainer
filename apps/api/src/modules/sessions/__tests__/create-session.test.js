import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { loadEnv } from '../../../config/env.js';
import { createLogger } from '../../../lib/logger.js';
import { setupTestDb } from '../../../../test/helpers/testDb.js';
import {
  seedFixtureImages,
  scanLeaks,
  TEST_SALT,
} from '../../../../test/helpers/sessionFixture.js';
import { SessionModel } from '../model.js';
import { ImageModel } from '../../catalog/model.js';

describe('Sessions API - Creation and Retrieval', () => {
  let app;
  let testDb;
  let config;
  let residentCookie;

  beforeAll(async () => {
    testDb = await setupTestDb();
    config = loadEnv({
      NODE_ENV: 'test',
      JWT_SECRET: 'session-secret-jwt-key-with-32-chars-minimum-xyz',
      PUBLIC_ID_SALT: TEST_SALT,
      RATE_LIMIT_ENABLED: 'false',
      ALLOW_REPEATS: 'false',
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
    await seedFixtureImages(14); // 126 images total

    // Register a test resident
    const regRes = await request(app).post('/api/auth/register').send({
      email: 'dr.trainee@hospital.test',
      password: 'StrongPassword123!',
      displayName: 'Dr. Trainee',
    });
    expect(regRes.status).toBe(201);
    residentCookie = regRes.headers['set-cookie'];
  });

  describe('Test 1: Create baseline session with balanced allocation', () => {
    it('creates baseline test with 60 questions, balanced classes and 40/30/30 buckets', async () => {
      const res = await request(app)
        .post('/api/sessions')
        .set('Cookie', residentCookie)
        .send({ size: 60 });

      expect(res.status).toBe(201);
      const session = res.body.data;

      expect(session.id).toBeDefined();
      expect(session.index).toBe(1);
      expect(session.kind).toBe('baseline');
      expect(session.status).toBe('in_progress');
      expect(session.size).toBe(60);
      expect(session.questions).toHaveLength(60);
      expect(session.answeredCount).toBe(0);

      // Verify question public shape
      for (const q of session.questions) {
        expect(q.no).toBeGreaterThanOrEqual(1);
        expect(q.no).toBeLessThanOrEqual(60);
        expect(q.imageUrl).toMatch(/^\/api\/images\/[a-f0-9]{20}\/file$/);
        expect(q.answered).toBe(false);
        expect(q.answer).toBeNull();
      }

      // Check DB stored allocation
      const dbSession = await SessionModel.findById(session.id).lean();
      expect(dbSession.plan.classCounts.covid19).toBe(20);
      expect(dbSession.plan.classCounts.pneumonia).toBe(20);
      expect(dbSession.plan.classCounts.normal).toBe(20);

      // Bucket shares: 40% easy (8), 30% medium (6), 30% hard (6) per class
      for (const c of ['covid19', 'pneumonia', 'normal']) {
        expect(dbSession.plan.bucketCounts[c].easy).toBe(8);
        expect(dbSession.plan.bucketCounts[c].medium).toBe(6);
        expect(dbSession.plan.bucketCounts[c].hard).toBe(6);
      }
    });
  });

  describe('Test 2: Leak test across resident-facing JSON endpoints', () => {
    it('strictly redacts all internal IDs, true labels, buckets, sources and hashes', async () => {
      // 1. Create session
      const createRes = await request(app)
        .post('/api/sessions')
        .set('Cookie', residentCookie)
        .send({ size: 60 });
      expect(createRes.status).toBe(201);
      expect(scanLeaks(createRes.body)).toEqual([]);

      const sessionId = createRes.body.data.id;

      // 2. GET /api/sessions/:id
      const getRes = await request(app)
        .get(`/api/sessions/${sessionId}`)
        .set('Cookie', residentCookie);
      expect(getRes.status).toBe(200);
      expect(scanLeaks(getRes.body)).toEqual([]);

      // 3. GET /api/sessions (list)
      const listRes = await request(app).get('/api/sessions').set('Cookie', residentCookie);
      expect(listRes.status).toBe(200);
      expect(scanLeaks(listRes.body)).toEqual([]);
    });
  });

  describe('Test 6: Active session constraints and pool exhaustion', () => {
    it('returns 409 SESSION_IN_PROGRESS if user already has an active session', async () => {
      const firstRes = await request(app)
        .post('/api/sessions')
        .set('Cookie', residentCookie)
        .send({ size: 60 });
      expect(firstRes.status).toBe(201);
      const firstSessionId = firstRes.body.data.id;

      const secondRes = await request(app)
        .post('/api/sessions')
        .set('Cookie', residentCookie)
        .send({ size: 60 });

      expect(secondRes.status).toBe(409);
      expect(secondRes.body.error.code).toBe('SESSION_IN_PROGRESS');
      expect(secondRes.body.error.details.sessionId).toBe(firstSessionId);
    });

    it('rejects concurrent double-click creation cleanly', async () => {
      const promises = [
        request(app).post('/api/sessions').set('Cookie', residentCookie).send({ size: 60 }),
        request(app).post('/api/sessions').set('Cookie', residentCookie).send({ size: 60 }),
      ];

      const results = await Promise.all(promises);
      const statuses = results.map((r) => r.status).sort();

      // One must succeed (201) and the other must fail (409)
      expect(statuses).toEqual([201, 409]);
    });

    it('returns 409 POOL_EXHAUSTED when catalog is too small and allowRepeats is false', async () => {
      // Clear pool and insert only 9 images (less than min session size 45)
      await ImageModel.deleteMany({});
      await seedFixtureImages(1); // 3 classes x 3 buckets x 1 = 9 images total

      const res = await request(app)
        .post('/api/sessions')
        .set('Cookie', residentCookie)
        .send({ size: 45 }); // request minimum 45

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('POOL_EXHAUSTED');
      expect(res.body.error.details.requested).toBe(45);
      expect(res.body.error.details.available).toBe(9);
    });

    it('succeeds with repeated images across sessions when ALLOW_REPEATS is true', async () => {
      // Seed exactly 5 images per bin = 45 images
      await ImageModel.deleteMany({});
      await seedFixtureImages(5);

      // 1. Create first session with default app (size 45)
      const s1Res = await request(app)
        .post('/api/sessions')
        .set('Cookie', residentCookie)
        .send({ size: 45 });
      expect(s1Res.status).toBe(201);
      const s1Id = s1Res.body.data.id;

      // 2. Answer all questions and finish session 1 so they enter history
      for (let i = 1; i <= 45; i++) {
        await request(app)
          .put(`/api/sessions/${s1Id}/questions/${i}/answer`)
          .set('Cookie', residentCookie)
          .send({ answer: 'normal' });
      }
      const finishRes = await request(app)
        .post(`/api/sessions/${s1Id}/finish`)
        .set('Cookie', residentCookie)
        .send({});
      expect(finishRes.status).toBe(200);

      // 3. Attempting to create session 2 with default app (ALLOW_REPEATS=false) must fail with POOL_EXHAUSTED
      const s2FailRes = await request(app)
        .post('/api/sessions')
        .set('Cookie', residentCookie)
        .send({ size: 45 });
      expect(s2FailRes.status).toBe(409);
      expect(s2FailRes.body.error.code).toBe('POOL_EXHAUSTED');

      // 4. App with ALLOW_REPEATS=true succeeds
      const repeatConfig = loadEnv({
        ...config,
        ALLOW_REPEATS: 'true',
      });
      const repeatApp = createApp({
        config: repeatConfig,
        logger: createLogger({ NODE_ENV: 'test' }),
      });

      const s2SuccessRes = await request(repeatApp)
        .post('/api/sessions')
        .set('Cookie', residentCookie)
        .send({ size: 45 });

      expect(s2SuccessRes.status).toBe(201);
      expect(s2SuccessRes.body.data.questions).toHaveLength(45);
      expect(s2SuccessRes.body.data.kind).toBe('adaptive');
    });
  });
});
