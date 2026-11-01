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
import { ResponseModel, SessionModel } from '../model.js';

describe('Sessions API - Answer Question Endpoint', () => {
  let app;
  let testDb;
  let residentCookie;
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

    // Register a resident
    const regRes = await request(app).post('/api/auth/register').send({
      email: 'resident.answer@hospital.test',
      password: 'StrongPassword123!',
      displayName: 'Dr. Answer Test',
    });
    residentCookie = regRes.headers['set-cookie'];

    // Create session of size 60
    const sessRes = await request(app)
      .post('/api/sessions')
      .set('Cookie', residentCookie)
      .send({ size: 60 });
    sessionId = sessRes.body.data.id;
  });

  describe('Test 3: Answer idempotency, validation, and feedback timing', () => {
    it('records an answer successfully and strictly hides correctness from resident', async () => {
      const res = await request(app)
        .put(`/api/sessions/${sessionId}/questions/1/answer`)
        .set('Cookie', residentCookie)
        .send({ answer: 'covid19', timeMs: 3400 });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ no: 1, answered: true });

      // Ensure no leak of correctness or ground truth
      expect(scanLeaks(res.body)).toEqual([]);
      expect(res.body.data.correct).toBeUndefined();
      expect(res.body.data.trueClass).toBeUndefined();

      // Check DB Response document
      const respDoc = await ResponseModel.findOne({ sessionId, questionNo: 1 }).lean();
      expect(respDoc).not.toBeNull();
      expect(respDoc.answer).toBe('covid19');
      expect(respDoc.timeMs).toBe(3400);
      expect(typeof respDoc.correct).toBe('boolean');
    });

    it('ensures idempotency when answering same question twice; later answer wins', async () => {
      // First answer
      await request(app)
        .put(`/api/sessions/${sessionId}/questions/1/answer`)
        .set('Cookie', residentCookie)
        .send({ answer: 'covid19', timeMs: 2000 });

      // Second answer updates the same question
      const res2 = await request(app)
        .put(`/api/sessions/${sessionId}/questions/1/answer`)
        .set('Cookie', residentCookie)
        .send({ answer: 'normal', timeMs: 4500 });

      expect(res2.status).toBe(200);
      expect(res2.body.data).toEqual({ no: 1, answered: true });

      // Must only be ONE document for this (sessionId, questionNo)
      const count = await ResponseModel.countDocuments({ sessionId, questionNo: 1 });
      expect(count).toBe(1);

      const updated = await ResponseModel.findOne({ sessionId, questionNo: 1 }).lean();
      expect(updated.answer).toBe('normal');
      expect(updated.timeMs).toBe(4500);
    });

    it('rejects invalid answer class with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .put(`/api/sessions/${sessionId}/questions/1/answer`)
        .set('Cookie', residentCookie)
        .send({ answer: 'invalid_disease' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 QUESTION_NOT_FOUND when question number is out of bounds', async () => {
      // Question 0 is invalid
      const res0 = await request(app)
        .put(`/api/sessions/${sessionId}/questions/0/answer`)
        .set('Cookie', residentCookie)
        .send({ answer: 'normal' });
      expect(res0.status).toBe(404);
      expect(res0.body.error.code).toBe('QUESTION_NOT_FOUND');

      // Question 61 is out of range (session size is 60)
      const res61 = await request(app)
        .put(`/api/sessions/${sessionId}/questions/61/answer`)
        .set('Cookie', residentCookie)
        .send({ answer: 'normal' });
      expect(res61.status).toBe(404);
      expect(res61.body.error.code).toBe('QUESTION_NOT_FOUND');
    });

    it('returns 409 SESSION_NOT_IN_PROGRESS when attempting to answer a finished session', async () => {
      // Mark session finished in DB
      await SessionModel.findByIdAndUpdate(sessionId, { status: 'finished' });

      const res = await request(app)
        .put(`/api/sessions/${sessionId}/questions/1/answer`)
        .set('Cookie', residentCookie)
        .send({ answer: 'normal' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SESSION_NOT_IN_PROGRESS');
    });
  });
});
