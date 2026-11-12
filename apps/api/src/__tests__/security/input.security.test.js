import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { createLogger } from '../../lib/logger.js';
import { setupTestDb } from '../../../test/helpers/testDb.js';
import { UserModel } from '../../modules/auth/model.js';

describe('Input Validation & Injection Resistance Regression Tests (S07, S15, S16, S17)', () => {
  let app;
  let testDb;
  let residentCookie;
  let instructorCookie;
  const JWT_SECRET = 'input-security-jwt-secret-key-32chars-min';

  beforeAll(async () => {
    testDb = await setupTestDb();
    const config = loadEnv({
      NODE_ENV: 'test',
      JWT_SECRET,
      PUBLIC_ID_SALT: 'salt-for-testing-purposes-16chars',
      RATE_LIMIT_ENABLED: 'false',
    });
    const logger = createLogger({ NODE_ENV: 'test' });
    app = createApp({ config, logger });

    // Seed resident
    const resUser = await UserModel.create({
      email: 'res.input@hospital.test',
      passwordHash: 'dummy',
      displayName: 'Input Trainee',
      role: 'resident',
    });
    const resToken = jwt.sign(
      { sub: String(resUser._id), email: resUser.email, role: 'resident' },
      JWT_SECRET,
    );
    residentCookie = [`rt_session=${resToken}; Path=/; HttpOnly`];

    // Seed instructor
    const instUser = await UserModel.create({
      email: 'inst.input@hospital.test',
      passwordHash: 'dummy',
      displayName: 'Input Instructor',
      role: 'instructor',
    });
    const instToken = jwt.sign(
      { sub: String(instUser._id), email: instUser.email, role: 'instructor' },
      JWT_SECRET,
    );
    instructorCookie = [`rt_session=${instToken}; Path=/; HttpOnly`];
  });

  afterAll(async () => {
    if (testDb) {
      await testDb.teardown();
    }
  });

  describe('S07 - CSRF & Content-Type Restriction (jsonOnly)', () => {
    it('rejects POST with application/x-www-form-urlencoded with 415 UNSUPPORTED_MEDIA_TYPE', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('email=test%40hospital.test&password=Password123%21');

      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('rejects POST with text/plain with 415 UNSUPPORTED_MEDIA_TYPE', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'text/plain')
        .send('email=test@hospital.test');

      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('rejects PUT with multipart/form-data with 415 UNSUPPORTED_MEDIA_TYPE', async () => {
      const res = await request(app)
        .put('/api/sessions/507f1f77bcf86cd799439011/questions/1/answer')
        .set('Cookie', residentCookie)
        .set('Content-Type', 'multipart/form-data')
        .send(
          '--boundary\r\nContent-Disposition: form-data; name="answer"\r\n\r\ncovid19\r\n--boundary--',
        );

      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });
  });

  describe('S15 - NoSQL Injection Mitigation', () => {
    it('rejects MongoDB query operator object in email with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send({
          email: { $ne: null },
          password: 'Password123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects MongoDB query operator object in password with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send({
          email: 'valid.resident@hospital.test',
          password: { $gt: '' },
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid query parameter types on paginated routes with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get('/api/catalog/images?page=invalid_page')
        .set('Cookie', instructorCookie);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('S16 - Payload Syntax & Size Limits', () => {
    it('returns 400 VALIDATION_ERROR for malformed JSON syntax in request body', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{ "email": "broken-json", '); // broken syntax

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Malformed JSON');
    });

    it('returns 413 VALIDATION_ERROR for oversized payloads exceeding 100kb limit', async () => {
      const largePayload = {
        email: 'test@hospital.test',
        password: 'ValidPassword123!',
        displayName: 'A'.repeat(120 * 1024), // 120kb payload
      };

      const res = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send(largePayload);

      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Payload too large');
    });

    it('returns 404 NOT_FOUND instead of 500 when requesting a resource with a malformed ObjectId', async () => {
      const res = await request(app)
        .get('/api/sessions/invalid-not-an-objectid')
        .set('Cookie', residentCookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('S17 - Mass Assignment Protection', () => {
    it('prevents privilege escalation: registration with role: instructor forces role to resident', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send({
          email: 'attacker@hospital.test',
          password: 'ValidPassword123!',
          displayName: 'Privilege Escalation Attempt',
          role: 'instructor',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('resident');

      const userInDb = await UserModel.findOne({ email: 'attacker@hospital.test' });
      expect(userInDb).toBeDefined();
      expect(userInDb.role).toBe('resident');
    });

    it('strips arbitrary unknown fields during registration so they never persist in DB', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send({
          email: 'admin.escalate@hospital.test',
          password: 'ValidPassword123!',
          displayName: 'Admin Escalation Attempt',
          isAdmin: true,
          permissions: ['ALL'],
        });

      expect(res.status).toBe(201);
      const userInDb = await UserModel.findOne({ email: 'admin.escalate@hospital.test' }).lean();
      expect(userInDb.isAdmin).toBeUndefined();
      expect(userInDb.permissions).toBeUndefined();
    });
  });
});
