import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from '../app.js';
import { loadEnv } from '../config/env.js';
import { createLogger } from '../lib/logger.js';
import { setupTestDb } from '../../test/helpers/testDb.js';
import { seedFixtureImages, TEST_SALT } from '../../test/helpers/sessionFixture.js';
import { UserModel } from '../modules/auth/model.js';
import { SessionModel } from '../modules/sessions/model.js';
import { PracticeSetModel } from '../modules/practice/model.js';
import { QuestionBankModel } from '../modules/bank/model.js';
import { ImageModel } from '../modules/catalog/model.js';

/**
 * Access control matrix of every registered endpoint in the API
 * Roles: 'public' | 'resident' | 'instructor'
 */
export const ENDPOINT_ACCESS_MATRIX = [
  // Public endpoints (no authentication required)
  { method: 'GET', path: '/api/health', roles: ['public'] },
  { method: 'POST', path: '/api/auth/register', roles: ['public'] },
  { method: 'POST', path: '/api/auth/login', roles: ['public'] },
  { method: 'POST', path: '/api/auth/logout', roles: ['public'] },

  // Shared authenticated endpoints
  { method: 'GET', path: '/api/me', roles: ['resident', 'instructor'] },
  { method: 'GET', path: '/api/images/:publicId/file', roles: ['resident', 'instructor'] },

  // Resident-only endpoints
  { method: 'POST', path: '/api/sessions', roles: ['resident'] },
  { method: 'GET', path: '/api/sessions', roles: ['resident'] },
  { method: 'GET', path: '/api/sessions/:id', roles: ['resident'] },
  { method: 'PUT', path: '/api/sessions/:id/questions/:no/answer', roles: ['resident'] },
  { method: 'POST', path: '/api/sessions/:id/finish', roles: ['resident'] },
  { method: 'GET', path: '/api/sessions/:id/report', roles: ['resident'] },
  { method: 'GET', path: '/api/progress', roles: ['resident'] },
  { method: 'POST', path: '/api/sessions/:id/explanations', roles: ['resident'] },
  { method: 'POST', path: '/api/sessions/:id/report-narrative', roles: ['resident'] },
  { method: 'POST', path: '/api/practice', roles: ['resident'] },
  { method: 'GET', path: '/api/practice', roles: ['resident'] },
  { method: 'GET', path: '/api/practice/:id', roles: ['resident'] },
  { method: 'PUT', path: '/api/practice/:id/questions/:no/answer', roles: ['resident'] },

  // Instructor-only endpoints
  { method: 'GET', path: '/api/catalog/stats', roles: ['instructor'] },
  { method: 'GET', path: '/api/catalog/images', roles: ['instructor'] },
  { method: 'GET', path: '/api/admin/users', roles: ['instructor'] },
  { method: 'GET', path: '/api/admin/users/:userId/progress', roles: ['instructor'] },
  { method: 'GET', path: '/api/admin/sessions/:id/report', roles: ['instructor'] },
  { method: 'GET', path: '/api/admin/questions', roles: ['instructor'] },
  { method: 'GET', path: '/api/admin/questions/stats', roles: ['instructor'] },
  { method: 'GET', path: '/api/admin/questions/:id', roles: ['instructor'] },
  { method: 'POST', path: '/api/admin/questions/:id/approve', roles: ['instructor'] },
  { method: 'POST', path: '/api/admin/questions/:id/reject', roles: ['instructor'] },
  { method: 'PUT', path: '/api/admin/questions/:id', roles: ['instructor'] },
  { method: 'GET', path: '/api/admin/llm/status', roles: ['instructor'] },
];

/**
 * Extracts all registered routes recursively from an Express 5 application
 * @param {import('express').Express} appInstance
 * @returns {Array<{ method: string, path: string }>}
 */
export function extractRegisteredRoutes(appInstance) {
  const routes = [];

  function walk(stack, prefix = '') {
    for (const layer of stack) {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
        for (const method of methods) {
          routes.push({ method, path: prefix + layer.route.path });
        }
      } else if (layer.name === 'router' && layer.handle?.stack) {
        const p = layer.path || (prefix === '' ? '/api' : '');
        walk(layer.handle.stack, prefix + p);
      }
    }
  }

  walk(appInstance.router.stack);
  return routes;
}

/**
 * Replaces route parameters with valid mock placeholders
 * @param {string} routePath
 * @returns {string}
 */
function resolveMockPath(routePath) {
  return routePath
    .replace(':id', '507f1f77bcf86cd799439011')
    .replace(':userId', '507f1f77bcf86cd799439012')
    .replace(':publicId', '0123456789abcdef0123')
    .replace(':no', '1');
}

describe('Access Control Matrix & Route Authorization (Step 1 - Hardening)', () => {
  let app;
  let testDb;
  let resident1Cookie;
  let resident1User;
  let resident2Cookie;
  let resident2User;
  let instructorCookie;
  let instructorUser;

  const testImagesDir = resolve(process.cwd(), 'apps/api/test-access-matrix-images');
  const JWT_SECRET = 'access-matrix-super-secret-jwt-key-32chars';

  beforeAll(async () => {
    testDb = await setupTestDb();
    mkdirSync(testImagesDir, { recursive: true });

    // Create a mock sample image
    const sampleJpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00,
      0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
    ]);
    writeFileSync(resolve(testImagesDir, 'sample_xray.jpg'), sampleJpeg);

    const config = loadEnv({
      NODE_ENV: 'test',
      JWT_SECRET,
      PUBLIC_ID_SALT: TEST_SALT,
      CATALOG_IMAGE_DIR: testImagesDir,
      RATE_LIMIT_ENABLED: 'false',
    });
    const logger = createLogger({ NODE_ENV: 'test' });
    app = createApp({ config, logger });
  });

  afterAll(async () => {
    try {
      rmSync(testImagesDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
    if (testDb) {
      await testDb.teardown();
    }
  });

  beforeEach(async () => {
    await testDb.clearCollections();

    // 1. Create Resident 1
    resident1User = await UserModel.create({
      email: 'resident1@hospital.test',
      passwordHash: 'dummy-hash',
      displayName: 'Resident One',
      role: 'resident',
    });
    const token1 = jwt.sign(
      { sub: String(resident1User._id), email: resident1User.email, role: 'resident' },
      JWT_SECRET,
    );
    resident1Cookie = [`rt_session=${token1}; Path=/; HttpOnly`];

    // 2. Create Resident 2
    resident2User = await UserModel.create({
      email: 'resident2@hospital.test',
      passwordHash: 'dummy-hash',
      displayName: 'Resident Two',
      role: 'resident',
    });
    const token2 = jwt.sign(
      { sub: String(resident2User._id), email: resident2User.email, role: 'resident' },
      JWT_SECRET,
    );
    resident2Cookie = [`rt_session=${token2}; Path=/; HttpOnly`];

    // 3. Create Instructor
    instructorUser = await UserModel.create({
      email: 'instructor@hospital.test',
      passwordHash: 'dummy-hash',
      displayName: 'Dr. Instructor',
      role: 'instructor',
    });
    const tokenInst = jwt.sign(
      { sub: String(instructorUser._id), email: instructorUser.email, role: 'instructor' },
      JWT_SECRET,
    );
    instructorCookie = [`rt_session=${tokenInst}; Path=/; HttpOnly`];
  });

  it('verifies that every route in the Express router is registered in ENDPOINT_ACCESS_MATRIX', () => {
    const liveRoutes = extractRegisteredRoutes(app);
    const matrixRoutes = ENDPOINT_ACCESS_MATRIX.map((e) => ({
      method: e.method,
      path: e.path,
    }));

    // Check count parity
    expect(liveRoutes.length).toBe(matrixRoutes.length);

    // Format sets for exact comparison
    const liveKeySet = new Set(liveRoutes.map((r) => `${r.method} ${r.path}`));
    const matrixKeySet = new Set(matrixRoutes.map((r) => `${r.method} ${r.path}`));

    for (const key of liveKeySet) {
      expect(
        matrixKeySet.has(key),
        `Route "${key}" exists in Express router stack but is missing from ENDPOINT_ACCESS_MATRIX`,
      ).toBe(true);
    }

    for (const key of matrixKeySet) {
      expect(
        liveKeySet.has(key),
        `Route "${key}" exists in ENDPOINT_ACCESS_MATRIX but is NOT registered in Express router`,
      ).toBe(true);
    }
  });

  describe('Unauthenticated access (401 UNAUTHENTICATED)', () => {
    const protectedEndpoints = ENDPOINT_ACCESS_MATRIX.filter((e) => !e.roles.includes('public'));

    for (const endpoint of protectedEndpoints) {
      it(`rejects unauthenticated request to ${endpoint.method} ${endpoint.path} with 401`, async () => {
        const url = resolveMockPath(endpoint.path);
        const req = request(app)[endpoint.method.toLowerCase()](url);

        if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
          req.set('Content-Type', 'application/json').send({});
        }

        const res = await req;
        expect(res.status).toBe(401);
        expect(res.body?.error?.code).toBe('UNAUTHENTICATED');
      });
    }

    const publicEndpoints = ENDPOINT_ACCESS_MATRIX.filter((e) => e.roles.includes('public'));

    for (const endpoint of publicEndpoints) {
      it(`permits unauthenticated request to public endpoint ${endpoint.method} ${endpoint.path} without 401`, async () => {
        const url = resolveMockPath(endpoint.path);
        const req = request(app)[endpoint.method.toLowerCase()](url);

        if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
          req.set('Content-Type', 'application/json').send({});
        }

        const res = await req;
        expect(res.status).not.toBe(401);
      });
    }
  });

  describe('Resident access to instructor-only routes (403 FORBIDDEN)', () => {
    const instructorOnlyEndpoints = ENDPOINT_ACCESS_MATRIX.filter(
      (e) => e.roles.includes('instructor') && !e.roles.includes('resident'),
    );

    for (const endpoint of instructorOnlyEndpoints) {
      it(`forbids resident access to ${endpoint.method} ${endpoint.path} with 403`, async () => {
        const url = resolveMockPath(endpoint.path);
        const req = request(app)[endpoint.method.toLowerCase()](url).set('Cookie', resident1Cookie);

        if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
          req.set('Content-Type', 'application/json').send({});
        }

        const res = await req;
        expect(res.status).toBe(403);
        expect(res.body?.error?.code).toBe('FORBIDDEN');
      });
    }
  });

  describe('Instructor access to resident-only routes (403 FORBIDDEN)', () => {
    const residentOnlyEndpoints = ENDPOINT_ACCESS_MATRIX.filter(
      (e) => e.roles.includes('resident') && !e.roles.includes('instructor'),
    );

    for (const endpoint of residentOnlyEndpoints) {
      it(`forbids instructor access to resident-only route ${endpoint.method} ${endpoint.path} with 403`, async () => {
        const url = resolveMockPath(endpoint.path);
        const req = request(app)
          [endpoint.method.toLowerCase()](url)
          .set('Cookie', instructorCookie);

        if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
          req.set('Content-Type', 'application/json').send({});
        }

        const res = await req;
        expect(res.status).toBe(403);
        expect(res.body?.error?.code).toBe('FORBIDDEN');
      });
    }
  });

  describe('Foreign resource isolation (cross-resident data access denied)', () => {
    let sessionRes1;
    let practiceSetRes1;
    let imageRes1;

    beforeEach(async () => {
      // Seed catalog images
      await seedFixtureImages(2, TEST_SALT);

      // Create an image owned by session 1
      imageRes1 = await ImageModel.create({
        _id: 'cohen_exclusive_001',
        publicId: 'pub_res1_exclusive01',
        filename: 'sample_xray.jpg',
        trueClass: 'covid19',
        source: 'cohen',
        difficulty: 0.3,
        bucket: 'medium',
        confusedWith: 'pneumonia',
      });

      // Resident 1 creates a session
      sessionRes1 = await SessionModel.create({
        userId: resident1User._id,
        index: 1,
        kind: 'baseline',
        status: 'in_progress',
        size: 45,
        questions: [
          {
            no: 1,
            imageId: imageRes1._id,
            publicId: imageRes1.publicId,
            trueClass: 'covid19',
            bucket: 'medium',
            difficulty: 0.3,
            confusedWith: 'pneumonia',
          },
        ],
      });

      // Create a mock question in bank
      const questionDoc = await QuestionBankModel.create({
        stableId: 'qb_foreign_test',
        imageId: imageRes1._id,
        type: 'finding',
        pair: { trueClass: 'covid19', confusedWith: 'pneumonia' },
        bucket: 'medium',
        stem: 'سوال تستی',
        options: [
          { text: 'گزینه ۱', key: null },
          { text: 'گزینه ۲', key: null },
          { text: 'گزینه ۳', key: null },
          { text: 'گزینه ۴', key: null },
        ],
        correctIndex: 0,
        rationale: 'توضیحات پاسخ صحیح',
        status: 'approved',
        source: {
          model: 'gemini-3.8-flash',
          promptVersion: 'v1',
          analysisIds: [],
        },
      });

      // Resident 1 creates a practice set
      practiceSetRes1 = await PracticeSetModel.create({
        userId: resident1User._id,
        status: 'in_progress',
        size: 1,
        questionIds: [questionDoc._id],
        publicIds: [imageRes1.publicId],
        optionOrder: [[0, 1, 2, 3]],
        answers: [],
      });
    });

    it('denies Resident 2 access to Resident 1 session details (404)', async () => {
      const res = await request(app)
        .get(`/api/sessions/${sessionRes1._id}`)
        .set('Cookie', resident2Cookie);

      expect(res.status).toBe(404);
      expect(res.body?.error?.code).toBe('NOT_FOUND');
    });

    it('denies Resident 2 answering questions in Resident 1 session (404)', async () => {
      const res = await request(app)
        .put(`/api/sessions/${sessionRes1._id}/questions/1/answer`)
        .set('Cookie', resident2Cookie)
        .set('Content-Type', 'application/json')
        .send({
          imageId: imageRes1.publicId,
          answer: 'covid19',
          timeMs: 1500,
        });

      expect(res.status).toBe(404);
      expect(res.body?.error?.code).toBe('NOT_FOUND');
    });

    it('denies Resident 2 finishing Resident 1 session (404)', async () => {
      const res = await request(app)
        .post(`/api/sessions/${sessionRes1._id}/finish`)
        .set('Cookie', resident2Cookie)
        .set('Content-Type', 'application/json')
        .send({});

      expect(res.status).toBe(404);
      expect(res.body?.error?.code).toBe('NOT_FOUND');
    });

    it('denies Resident 2 access to Resident 1 session report (404)', async () => {
      const res = await request(app)
        .get(`/api/sessions/${sessionRes1._id}/report`)
        .set('Cookie', resident2Cookie);

      expect(res.status).toBe(404);
      expect(res.body?.error?.code).toBe('NOT_FOUND');
    });

    it('denies Resident 2 access to Resident 1 session explanations (404)', async () => {
      const res = await request(app)
        .post(`/api/sessions/${sessionRes1._id}/explanations`)
        .set('Cookie', resident2Cookie)
        .set('Content-Type', 'application/json')
        .send({ lang: 'fa' });

      expect(res.status).toBe(404);
      expect(res.body?.error?.code).toBe('NOT_FOUND');
    });

    it('denies Resident 2 access to Resident 1 report narrative (404)', async () => {
      const res = await request(app)
        .post(`/api/sessions/${sessionRes1._id}/report-narrative`)
        .set('Cookie', resident2Cookie)
        .set('Content-Type', 'application/json')
        .send({ lang: 'fa' });

      expect(res.status).toBe(404);
      expect(res.body?.error?.code).toBe('NOT_FOUND');
    });

    it('denies Resident 2 access to Resident 1 practice set (404)', async () => {
      const res = await request(app)
        .get(`/api/practice/${practiceSetRes1._id}`)
        .set('Cookie', resident2Cookie);

      expect(res.status).toBe(404);
      expect(res.body?.error?.code).toBe('NOT_FOUND');
    });

    it('denies Resident 2 answering questions in Resident 1 practice set (404)', async () => {
      const res = await request(app)
        .put(`/api/practice/${practiceSetRes1._id}/questions/1/answer`)
        .set('Cookie', resident2Cookie)
        .set('Content-Type', 'application/json')
        .send({ selectedIndex: 0 });

      expect(res.status).toBe(404);
      expect(res.body?.error?.code).toBe('NOT_FOUND');
    });

    it('denies Resident 2 access to private image exclusively present in Resident 1 session (404)', async () => {
      // Resident 2 has no session or practice set with imageRes1
      const res = await request(app)
        .get(`/api/images/${imageRes1.publicId}/file`)
        .set('Cookie', resident2Cookie);

      expect(res.status).toBe(404);
      expect(res.body?.error?.code).toBe('NOT_FOUND');
    });

    it('permits Resident 1 access to private image present in own session (200)', async () => {
      const res = await request(app)
        .get(`/api/images/${imageRes1.publicId}/file`)
        .set('Cookie', resident1Cookie);

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('private, max-age=86400');
    });
  });
});
