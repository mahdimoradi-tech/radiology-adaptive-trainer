import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { loadEnv } from '../../../config/env.js';
import { createLogger } from '../../../lib/logger.js';
import { setupTestDb } from '../../../../test/helpers/testDb.js';

describe('Auth module', () => {
  let app;
  let testDb;
  let config;

  beforeAll(async () => {
    testDb = await setupTestDb();
    config = loadEnv({
      NODE_ENV: 'test',
      JWT_SECRET: 'super-secret-jwt-key-with-at-least-32-characters-12345',
      PUBLIC_ID_SALT: 'salt-with-at-least-16-chars',
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

  describe('POST /api/auth/register', () => {
    it('registers a resident user, sets session cookie, and returns public user', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'Resident1@Hospital.org',
        password: 'password123',
        displayName: 'Dr. Sarah Smith',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('resident1@hospital.org'); // trimmed & lowercased
      expect(res.body.data.user.displayName).toBe('Dr. Sarah Smith');
      expect(res.body.data.user.role).toBe('resident');
      expect(res.body.data.user.language).toBe('fa');

      // Leak test: ensure passwordHash is never returned
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');

      // Cookie assertions
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const sessionCookie = cookies.find((c) => c.startsWith('rt_session='));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('SameSite=Lax');
    });

    it('rejects duplicate email registration with 409 EMAIL_TAKEN', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'resident1@hospital.org',
        password: 'password999',
        displayName: 'Another Name',
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_TAKEN');
      expect(res.body.error.message).toContain('already registered');
    });

    it('rejects password equal to email with 400 VALIDATION_ERROR', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'same@example.com',
        password: 'same@example.com',
        displayName: 'Same Person',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects password longer than 72 bytes', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'toolong@example.com',
          password: 'a'.repeat(73),
          displayName: 'Long Pass',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    it('authenticates valid credentials, sets cookie, and returns public user', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'resident1@hospital.org',
        password: 'password123',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('resident1@hospital.org');
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');

      const cookies = res.headers['set-cookie'];
      expect(cookies.some((c) => c.startsWith('rt_session='))).toBe(true);
    });

    it('returns identical 401 INVALID_CREDENTIALS for unknown email and wrong password', async () => {
      const unknownEmailRes = await request(app).post('/api/auth/login').send({
        email: 'nobody@hospital.org',
        password: 'password123',
      });

      const wrongPasswordRes = await request(app).post('/api/auth/login').send({
        email: 'resident1@hospital.org',
        password: 'wrongpassword',
      });

      expect(unknownEmailRes.status).toBe(401);
      expect(wrongPasswordRes.status).toBe(401);

      expect(unknownEmailRes.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(wrongPasswordRes.body.error.code).toBe('INVALID_CREDENTIALS');

      // Exact same message to avoid timing / enumeration attacks
      expect(unknownEmailRes.body.error.message).toBe(wrongPasswordRes.body.error.message);
    });
  });

  describe('GET /api/me', () => {
    it('returns 200 with current user profile when session cookie is provided', async () => {
      // First login to get cookie
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'resident1@hospital.org',
        password: 'password123',
      });

      const cookie = loginRes.headers['set-cookie'];

      const meRes = await request(app).get('/api/me').set('Cookie', cookie);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.user.email).toBe('resident1@hospital.org');
      expect(meRes.body.data.user.role).toBe('resident');
      expect(JSON.stringify(meRes.body)).not.toContain('passwordHash');
    });

    it('returns 401 UNAUTHENTICATED when no cookie is provided', async () => {
      const res = await request(app).get('/api/me');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 401 UNAUTHENTICATED when invalid token is provided', async () => {
      const res = await request(app)
        .get('/api/me')
        .set('Cookie', ['rt_session=invalid.token.structure']);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears session cookie with 204 status', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(204);
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const sessionCookie = cookies.find((c) => c.startsWith('rt_session='));
      // Cookie is expired/cleared
      expect(sessionCookie).toMatch(/rt_session=;/);
    });
  });
});
