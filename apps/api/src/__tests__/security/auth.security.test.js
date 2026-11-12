import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createApp } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { createLogger } from '../../lib/logger.js';
import { setupTestDb } from '../../../test/helpers/testDb.js';
import { UserModel } from '../../modules/auth/model.js';

describe('Auth Security Regression Tests (S01-S05)', () => {
  let app;
  let prodApp;
  let testDb;
  const JWT_SECRET = 'super-secret-jwt-key-with-minimum-32-chars-xyz';
  const PUBLIC_ID_SALT = 'salt-for-testing-purposes-16chars';

  beforeAll(async () => {
    testDb = await setupTestDb();

    // Default test app (COOKIE_SECURE=false)
    const testConfig = loadEnv({
      NODE_ENV: 'test',
      JWT_SECRET,
      PUBLIC_ID_SALT,
      RATE_LIMIT_ENABLED: 'false',
      COOKIE_SECURE: 'false',
    });
    const logger = createLogger({ NODE_ENV: 'test' });
    app = createApp({ config: testConfig, logger });

    // App with COOKIE_SECURE=true (simulating production cookie policy)
    const secureConfig = loadEnv({
      NODE_ENV: 'test',
      JWT_SECRET,
      PUBLIC_ID_SALT,
      RATE_LIMIT_ENABLED: 'false',
      COOKIE_SECURE: 'true',
    });
    prodApp = createApp({ config: secureConfig, logger });
  });

  afterAll(async () => {
    if (testDb) {
      await testDb.teardown();
    }
  });

  beforeEach(async () => {
    await testDb.clearCollections();
  });

  describe('S01 - Session Cookie Flags', () => {
    it('sets HttpOnly, Path=/, and SameSite=Lax on register and login cookies', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'resident.cookie@hospital.test',
        password: 'ValidPassword123!',
        displayName: 'Cookie Resident',
      });

      expect(res.status).toBe(201);
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = cookies[0];

      expect(cookieStr).toMatch(/^rt_session=/);
      expect(cookieStr).toMatch(/HttpOnly/i);
      expect(cookieStr).toMatch(/Path=\//i);
      expect(cookieStr).toMatch(/SameSite=Lax/i);
    });

    it('enforces Secure flag when COOKIE_SECURE is true', async () => {
      const res = await request(prodApp).post('/api/auth/register').send({
        email: 'resident.secure@hospital.test',
        password: 'ValidPassword123!',
        displayName: 'Secure Resident',
      });

      expect(res.status).toBe(201);
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = cookies[0];

      expect(cookieStr).toMatch(/Secure/i);
      expect(cookieStr).toMatch(/HttpOnly/i);
      expect(cookieStr).toMatch(/SameSite=Lax/i);
    });
  });

  describe('S02 - JWT Signature & Algorithm Integrity', () => {
    let validUserId;
    let validCookie;

    beforeEach(async () => {
      const user = await UserModel.create({
        email: 'resident.jwt@hospital.test',
        passwordHash: await bcrypt.hash('ValidPassword123!', 4),
        displayName: 'JWT Resident',
        role: 'resident',
      });
      validUserId = String(user._id);

      const validToken = jwt.sign({ sub: validUserId, role: 'resident' }, JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '1h',
      });
      validCookie = [`rt_session=${validToken}; Path=/; HttpOnly`];
    });

    it('accepts a valid signed JWT session', async () => {
      const res = await request(app).get('/api/me').set('Cookie', validCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('resident.jwt@hospital.test');
    });

    it('rejects an unsigned "alg: none" token with 401 UNAUTHENTICATED', async () => {
      // Craft an unverified token with algorithm none
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: validUserId, role: 'resident' })).toString(
        'base64url',
      );
      const noneToken = `${header}.${payload}.`;

      const res = await request(app)
        .get('/api/me')
        .set('Cookie', [`rt_session=${noneToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects a token signed with a wrong secret key with 401 UNAUTHENTICATED', async () => {
      const forgedToken = jwt.sign(
        { sub: validUserId, role: 'resident' },
        'wrong-attacker-secret',
        {
          algorithm: 'HS256',
        },
      );

      const res = await request(app)
        .get('/api/me')
        .set('Cookie', [`rt_session=${forgedToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects an expired JWT token with 401 UNAUTHENTICATED', async () => {
      const expiredToken = jwt.sign({ sub: validUserId, role: 'resident' }, JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '-10s', // already expired
      });

      const res = await request(app)
        .get('/api/me')
        .set('Cookie', [`rt_session=${expiredToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects a valid token if the referenced user no longer exists in DB', async () => {
      await UserModel.findByIdAndDelete(validUserId);

      const res = await request(app).get('/api/me').set('Cookie', validCookie);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('S03 - Dynamic Role Verification from Database', () => {
    it('reads the user role dynamically from the database document on each request', async () => {
      const user = await UserModel.create({
        email: 'promoted.user@hospital.test',
        passwordHash: 'dummy',
        displayName: 'Promoted User',
        role: 'resident',
      });

      // Token claims resident role
      const token = jwt.sign({ sub: String(user._id), role: 'resident' }, JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '1h',
      });
      const cookie = [`rt_session=${token}; Path=/; HttpOnly`];

      // Initial check confirms resident role
      const res1 = await request(app).get('/api/me').set('Cookie', cookie);
      expect(res1.status).toBe(200);
      expect(res1.body.data.user.role).toBe('resident');

      // Promote user in database to instructor
      await UserModel.findByIdAndUpdate(user._id, { role: 'instructor' });

      // Next request immediately reflects the instructor role using the exact same token
      const res2 = await request(app).get('/api/me').set('Cookie', cookie);
      expect(res2.status).toBe(200);
      expect(res2.body.data.user.role).toBe('instructor');
    });
  });

  describe('S04 - Password Security & Hash Secrecy', () => {
    it('rejects passwords shorter than 8 bytes with 400 VALIDATION_ERROR', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'short.pwd@hospital.test',
        password: '1234567', // 7 bytes
        displayName: 'Short Pwd',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects passwords longer than 72 bytes with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'long.pwd@hospital.test',
          password: 'a'.repeat(73), // 73 bytes
          displayName: 'Long Pwd',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('stores bcrypt hash in DB and never leaks password or passwordHash in API responses', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'secret.pwd@hospital.test',
        password: 'ValidSecretPassword123!',
        displayName: 'Secret Trainee',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.user.passwordHash).toBeUndefined();

      const userInDb = await UserModel.findOne({ email: 'secret.pwd@hospital.test' });
      expect(userInDb).toBeDefined();
      expect(userInDb.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(userInDb.passwordHash).not.toContain('ValidSecretPassword123!');

      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'secret.pwd@hospital.test',
        password: 'ValidSecretPassword123!',
      });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.user.password).toBeUndefined();
      expect(loginRes.body.data.user.passwordHash).toBeUndefined();
    });
  });

  describe('S05 - User Enumeration Mitigation', () => {
    beforeEach(async () => {
      await UserModel.create({
        email: 'existing.resident@hospital.test',
        passwordHash: await bcrypt.hash('CorrectPassword123!', 4),
        displayName: 'Existing Resident',
        role: 'resident',
      });
    });

    it('returns identical 401 INVALID_CREDENTIALS for unknown email and wrong password', async () => {
      // 1. Unknown email
      const resUnknown = await request(app).post('/api/auth/login').send({
        email: 'nonexistent.user@hospital.test',
        password: 'AnyPassword123!',
      });

      // 2. Existing email with wrong password
      const resWrongPwd = await request(app).post('/api/auth/login').send({
        email: 'existing.resident@hospital.test',
        password: 'WrongPassword123!',
      });

      expect(resUnknown.status).toBe(401);
      expect(resWrongPwd.status).toBe(401);

      expect(resUnknown.body).toEqual({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });

      expect(resWrongPwd.body).toEqual({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    });
  });
});
