import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { createLogger } from '../../lib/logger.js';
import { setupTestDb } from '../../../test/helpers/testDb.js';
import { TEST_SALT } from '../../../test/helpers/sessionFixture.js';
import { UserModel } from '../../modules/auth/model.js';
import { SessionModel } from '../../modules/sessions/model.js';
import { PracticeSetModel } from '../../modules/practice/model.js';
import { QuestionBankModel } from '../../modules/bank/model.js';
import { ImageModel } from '../../modules/catalog/model.js';

describe('Authorization & Resource Isolation Regression Tests (S08, S10, S11)', () => {
  let app;
  let testDb;
  let resident1User;
  let resident1Cookie;
  let resident2User;
  let resident2Cookie;
  let instructorCookie;

  const testImagesDir = resolve(process.cwd(), 'apps/api/test-authz-security-images');
  const JWT_SECRET = 'authz-security-super-jwt-secret-key-32chars';

  beforeAll(async () => {
    testDb = await setupTestDb();
    mkdirSync(testImagesDir, { recursive: true });

    // Mock radiograph image
    const sampleJpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00,
      0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
    ]);
    writeFileSync(resolve(testImagesDir, 'sample_authz.jpg'), sampleJpeg);

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

    // 1. Resident 1
    resident1User = await UserModel.create({
      email: 'res1.authz@hospital.test',
      passwordHash: 'dummy',
      displayName: 'Resident One',
      role: 'resident',
    });
    const token1 = jwt.sign(
      { sub: String(resident1User._id), email: resident1User.email, role: 'resident' },
      JWT_SECRET,
    );
    resident1Cookie = [`rt_session=${token1}; Path=/; HttpOnly`];

    // 2. Resident 2
    resident2User = await UserModel.create({
      email: 'res2.authz@hospital.test',
      passwordHash: 'dummy',
      displayName: 'Resident Two',
      role: 'resident',
    });
    const token2 = jwt.sign(
      { sub: String(resident2User._id), email: resident2User.email, role: 'resident' },
      JWT_SECRET,
    );
    resident2Cookie = [`rt_session=${token2}; Path=/; HttpOnly`];

    // 3. Instructor
    const instructorUser = await UserModel.create({
      email: 'inst.authz@hospital.test',
      passwordHash: 'dummy',
      displayName: 'Dr. Authz Instructor',
      role: 'instructor',
    });
    const tokenInst = jwt.sign(
      { sub: String(instructorUser._id), email: instructorUser.email, role: 'instructor' },
      JWT_SECRET,
    );
    instructorCookie = [`rt_session=${tokenInst}; Path=/; HttpOnly`];
  });

  describe('S08 - Logout & Cookie Clearance', () => {
    it('clears session cookie on logout (expired / max-age=0)', async () => {
      const res = await request(app).post('/api/auth/logout').send({});

      expect(res.status).toBe(204);
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();

      const clearCookie = cookies.find((c) => c.startsWith('rt_session='));
      expect(clearCookie).toBeDefined();
      // Verifies cookie is expired immediately
      expect(clearCookie).toMatch(/(Expires=Thu, 01 Jan 1970|Max-Age=0)/i);
    });

    it('rejects subsequent requests without cookie as 401 UNAUTHENTICATED', async () => {
      const res = await request(app).get('/api/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('S10 - IDOR Strict Resident Isolation', () => {
    let sessionRes1;
    let practiceRes1;

    beforeEach(async () => {
      sessionRes1 = await SessionModel.create({
        userId: resident1User._id,
        index: 1,
        kind: 'baseline',
        status: 'in_progress',
        size: 45,
        questions: [
          {
            no: 1,
            imageId: 'cohen_1',
            publicId: 'abc123def45678901234',
            trueClass: 'covid19',
            bucket: 'easy',
            difficulty: 0.25,
            confusedWith: 'normal',
          },
        ],
      });

      const questionDoc = await QuestionBankModel.create({
        stableId: 'qb_authz_q1',
        imageId: 'img_authz_q1',
        type: 'finding',
        pair: { trueClass: 'covid19', confusedWith: 'normal' },
        difficulty: 0.3,
        bucket: 'easy',
        stem: 'سؤال تستی تمرین',
        options: [
          { text: 'گزینه ۱', key: 'opt_1' },
          { text: 'گزینه ۲', key: 'opt_2' },
          { text: 'گزینه ۳', key: 'opt_3' },
          { text: 'گزینه ۴', key: 'opt_4' },
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

      practiceRes1 = await PracticeSetModel.create({
        userId: resident1User._id,
        status: 'in_progress',
        size: 1,
        questionIds: [questionDoc._id],
        publicIds: ['abc123def45678901234'],
        optionOrder: [[0, 1, 2, 3]],
        answers: [],
      });
    });

    it('isolates session list: Resident 2 sees 0 sessions when Resident 1 has a session', async () => {
      const res = await request(app).get('/api/sessions').set('Cookie', resident2Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it('denies Resident 2 access to Resident 1 session details (404)', async () => {
      const res = await request(app)
        .get(`/api/sessions/${sessionRes1._id}`)
        .set('Cookie', resident2Cookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('isolates practice set list: Resident 2 sees 0 practice sets', async () => {
      const res = await request(app).get('/api/practice').set('Cookie', resident2Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it('denies Resident 2 access to Resident 1 practice set details (404)', async () => {
      const res = await request(app)
        .get(`/api/practice/${practiceRes1._id}`)
        .set('Cookie', resident2Cookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('denies Resident 2 answering questions in Resident 1 practice set (404)', async () => {
      const res = await request(app)
        .put(`/api/practice/${practiceRes1._id}/questions/1/answer`)
        .set('Cookie', resident2Cookie)
        .set('Content-Type', 'application/json')
        .send({ selectedIndex: 0 });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('S11 - Image Access Control & Traversal Resistance', () => {
    let authorizedPublicId;

    beforeEach(async () => {
      const imgDoc = await ImageModel.create({
        _id: 'sample_authz',
        catalogId: 'sample_authz',
        publicId: 'a1b2c3d4e5f607182930',
        filename: 'sample_authz.jpg',
        trueClass: 'covid19',
        source: 'cohen',
        bucket: 'easy',
        difficulty: 0.25,
        confusedWith: 'normal',
        split: 'train',
      });
      authorizedPublicId = imgDoc.publicId;

      // Associate with Resident 1 session
      await SessionModel.create({
        userId: resident1User._id,
        index: 1,
        kind: 'baseline',
        status: 'in_progress',
        size: 45,
        questions: [
          {
            no: 1,
            imageId: 'sample_authz',
            publicId: authorizedPublicId,
            trueClass: 'covid19',
            bucket: 'easy',
            difficulty: 0.25,
            confusedWith: 'normal',
          },
        ],
      });
    });

    it('allows resident to fetch image linked to their active session', async () => {
      const res = await request(app)
        .get(`/api/images/${authorizedPublicId}/file`)
        .set('Cookie', resident1Cookie);

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('private, max-age=86400');
      // Must not leak internal filename in headers
      expect(res.headers['content-disposition']).toBeUndefined();
    });

    it('denies resident access to image not in their session or practice (404)', async () => {
      const res = await request(app)
        .get(`/api/images/${authorizedPublicId}/file`)
        .set('Cookie', resident2Cookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('allows instructor to view any catalog image', async () => {
      const res = await request(app)
        .get(`/api/images/${authorizedPublicId}/file`)
        .set('Cookie', instructorCookie);

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('private, max-age=86400');
    });

    it('rejects path traversal attempts with 404 NOT_FOUND', async () => {
      const traversalAttempts = [
        '..%2f..%2fetc%2fpasswd',
        '..%2f..%2f.env',
        '....//....//config/env.js',
        'nonexistent-opaque-id',
      ];

      for (const attempt of traversalAttempts) {
        const res = await request(app)
          .get(`/api/images/${encodeURIComponent(attempt)}/file`)
          .set('Cookie', resident1Cookie);

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('NOT_FOUND');
      }
    });
  });
});
