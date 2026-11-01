import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import bcrypt from 'bcryptjs';
import {
  AdminResidentSummarySchema,
  ProgressSchema,
  SessionReportSchema,
} from '@radiology/contracts';
import { createApp } from '../../../app.js';
import { loadEnv } from '../../../config/env.js';
import { createLogger } from '../../../lib/logger.js';
import { setupTestDb } from '../../../../test/helpers/testDb.js';
import { seedFixtureImages, TEST_SALT } from '../../../../test/helpers/sessionFixture.js';
import { UserModel } from '../../auth/model.js';

const SAMPLE_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0x7f, 0x00, 0xff, 0xd9,
]);

describe('Sessions API - Admin Endpoints and Image Ownership Verification', () => {
  let app;
  let testDb;
  let resident1Cookie;
  let resident1Id;
  let resident2Cookie;
  let instructorCookie;
  let session1Id;
  let session1PublicId;
  const testImagesDir = resolve(process.cwd(), 'apps/api/test-admin-images');

  beforeAll(async () => {
    testDb = await setupTestDb();
    mkdirSync(testImagesDir, { recursive: true });

    const config = loadEnv({
      NODE_ENV: 'test',
      JWT_SECRET: 'session-secret-jwt-key-with-32-chars-minimum-xyz',
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
    const images = await seedFixtureImages(14);

    // Write JPEG files for all seeded fixture images so sendFile succeeds
    for (const img of images) {
      writeFileSync(resolve(testImagesDir, img.filename), SAMPLE_JPEG);
    }

    // Register Resident 1
    const r1 = await request(app).post('/api/auth/register').send({
      email: 'res1@hospital.test',
      password: 'StrongPassword123!',
      displayName: 'Resident One',
    });
    resident1Cookie = r1.headers['set-cookie'];
    resident1Id = r1.body.data.user.id;

    // Register Resident 2
    const r2 = await request(app).post('/api/auth/register').send({
      email: 'res2@hospital.test',
      password: 'StrongPassword123!',
      displayName: 'Resident Two',
    });
    resident2Cookie = r2.headers['set-cookie'];

    // Create Instructor in DB and login
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

    // Resident 1 creates a session
    const s1Res = await request(app)
      .post('/api/sessions')
      .set('Cookie', resident1Cookie)
      .send({ size: 60 });
    session1Id = s1Res.body.data.id;
    session1PublicId = s1Res.body.data.questions[0].imageUrl.split('/')[3]; // /api/images/:publicId/file
  });

  describe('Test 7: Role authorization and admin visibility', () => {
    it('rejects resident access to admin routes with 403 FORBIDDEN', async () => {
      const resUsers = await request(app).get('/api/admin/users').set('Cookie', resident1Cookie);
      expect(resUsers.status).toBe(403);
      expect(resUsers.body.error.code).toBe('FORBIDDEN');

      const resProg = await request(app)
        .get(`/api/admin/users/${resident1Id}/progress`)
        .set('Cookie', resident1Cookie);
      expect(resProg.status).toBe(403);
      expect(resProg.body.error.code).toBe('FORBIDDEN');

      const resRep = await request(app)
        .get(`/api/admin/sessions/${session1Id}/report`)
        .set('Cookie', resident1Cookie);
      expect(resRep.status).toBe(403);
      expect(resRep.body.error.code).toBe('FORBIDDEN');
    });

    it('allows instructor to list residents with session counts and metrics', async () => {
      // Finish resident 1's session so metrics are populated
      await request(app)
        .put(`/api/sessions/${session1Id}/questions/1/answer`)
        .set('Cookie', resident1Cookie)
        .send({ answer: 'normal' });
      await request(app)
        .post(`/api/sessions/${session1Id}/finish`)
        .set('Cookie', resident1Cookie)
        .send({});

      const res = await request(app).get('/api/admin/users').set('Cookie', instructorCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(2);

      for (const user of res.body.data) {
        expect(AdminResidentSummarySchema.safeParse(user).success).toBe(true);
      }

      const foundR1 = res.body.data.find((u) => u.id === resident1Id);
      expect(foundR1).toBeDefined();
      expect(foundR1.sessionsFinished).toBe(1);
    });

    it('allows instructor to view any user progress and any session report', async () => {
      // Finish resident 1's session
      await request(app)
        .post(`/api/sessions/${session1Id}/finish`)
        .set('Cookie', resident1Cookie)
        .send({});

      // Instructor fetches report
      const reportRes = await request(app)
        .get(`/api/admin/sessions/${session1Id}/report`)
        .set('Cookie', instructorCookie);
      expect(reportRes.status).toBe(200);
      expect(SessionReportSchema.safeParse(reportRes.body.data).success).toBe(true);

      // Instructor fetches resident 1's progress
      const progRes = await request(app)
        .get(`/api/admin/users/${resident1Id}/progress`)
        .set('Cookie', instructorCookie);
      expect(progRes.status).toBe(200);
      expect(ProgressSchema.safeParse(progRes.body.data).success).toBe(true);
      expect(progRes.body.data.totals.sessionsFinished).toBe(1);
    });

    it('enforces image ownership: resident can only fetch images in their own sessions', async () => {
      // Resident 1 has this image in session 1 -> 200 OK
      const r1ImgRes = await request(app)
        .get(`/api/images/${session1PublicId}/file`)
        .set('Cookie', resident1Cookie);
      expect(r1ImgRes.status).toBe(200);
      expect(r1ImgRes.headers['content-type']).toContain('image/jpeg');

      // Resident 2 has NO session with this image -> 404 NOT_FOUND
      const r2ImgRes = await request(app)
        .get(`/api/images/${session1PublicId}/file`)
        .set('Cookie', resident2Cookie);
      expect(r2ImgRes.status).toBe(404);
      expect(r2ImgRes.body.error.code).toBe('NOT_FOUND');

      // Instructor has global access -> 200 OK
      const instImgRes = await request(app)
        .get(`/api/images/${session1PublicId}/file`)
        .set('Cookie', instructorCookie);
      expect(instImgRes.status).toBe(200);
    });
  });
});
