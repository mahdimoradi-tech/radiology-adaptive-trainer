import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createApp } from '../../../app.js';
import { loadEnv } from '../../../config/env.js';
import { createLogger } from '../../../lib/logger.js';
import { setupTestDb } from '../../../../test/helpers/testDb.js';
import { TEST_SALT } from '../../../../test/helpers/sessionFixture.js';
import { ImageModel } from '../../catalog/model.js';
import { PracticeSetModel } from '../../practice/model.js';
import { QuestionBankModel } from '../../bank/model.js';
import { UserModel } from '../../auth/model.js';

describe('Image Access Authorization for Targeted Practice (T09b)', () => {
  let app;
  let testDb;
  let config;
  let residentACookie;
  let residentAId;
  let residentBCookie;
  let residentBId;
  let instructorCookie;
  let tempImageDir;

  const imageIdA = 'img_practice_res_a';
  const publicIdA = 'pub_res_a_12345';

  const imageIdB = 'img_practice_res_b';
  const publicIdB = 'pub_res_b_67890';

  const unassignedImageId = 'img_unassigned';
  const unassignedPublicId = 'pub_unassigned_99999';

  beforeAll(async () => {
    testDb = await setupTestDb();
    await ImageModel.syncIndexes();
    await PracticeSetModel.syncIndexes();
    await QuestionBankModel.syncIndexes();
    await UserModel.syncIndexes();

    tempImageDir = path.join(process.cwd(), 'tmp-test-images-practice');
    await fs.mkdir(tempImageDir, { recursive: true });
    // Write fake test jpg files
    await fs.writeFile(path.join(tempImageDir, `${imageIdA}.jpg`), 'fake-jpeg-data-a');
    await fs.writeFile(path.join(tempImageDir, `${imageIdB}.jpg`), 'fake-jpeg-data-b');
    await fs.writeFile(path.join(tempImageDir, `${unassignedImageId}.jpg`), 'fake-jpeg-unassigned');

    config = loadEnv({
      NODE_ENV: 'test',
      JWT_SECRET: 'jwt-practice-img-access-secret-32-chars-xyz',
      PUBLIC_ID_SALT: TEST_SALT,
      CATALOG_IMAGE_DIR: tempImageDir,
      RATE_LIMIT_ENABLED: 'false',
    });
    const logger = createLogger({ NODE_ENV: 'test' });
    app = createApp({ config, logger });
  });

  afterAll(async () => {
    if (testDb) {
      await testDb.teardown();
    }
    await fs.rm(tempImageDir, { recursive: true, force: true }).catch(() => {});
  });

  beforeEach(async () => {
    await testDb.clearCollections();

    // Seed test image records
    await ImageModel.create([
      {
        _id: imageIdA,
        publicId: publicIdA,
        filename: `${imageIdA}.jpg`,
        trueClass: 'covid19',
        source: 'cohen',
        difficulty: 0.2,
        bucket: 'easy',
        confusedWith: 'pneumonia',
      },
      {
        _id: imageIdB,
        publicId: publicIdB,
        filename: `${imageIdB}.jpg`,
        trueClass: 'pneumonia',
        source: 'kermany',
        difficulty: 0.4,
        bucket: 'medium',
        confusedWith: 'covid19',
      },
      {
        _id: unassignedImageId,
        publicId: unassignedPublicId,
        filename: `${unassignedImageId}.jpg`,
        trueClass: 'normal',
        source: 'kermany',
        difficulty: 0.1,
        bucket: 'easy',
        confusedWith: 'pneumonia',
      },
    ]);

    // Register Resident A
    const regA = await request(app).post('/api/auth/register').send({
      email: 'resident.a@hospital.test',
      password: 'StrongPassword123!',
      displayName: 'Resident A',
    });
    residentACookie = regA.headers['set-cookie'];
    residentAId = regA.body.data.user.id;

    // Register Resident B
    const regB = await request(app).post('/api/auth/register').send({
      email: 'resident.b@hospital.test',
      password: 'StrongPassword123!',
      displayName: 'Resident B',
    });
    residentBCookie = regB.headers['set-cookie'];
    residentBId = regB.body.data.user.id;

    // Register Instructor
    const instructor = await UserModel.create({
      email: 'prof.instructor@hospital.test',
      passwordHash: 'dummy',
      displayName: 'Prof Instructor',
      role: 'instructor',
    });
    const token = (await import('jsonwebtoken')).default.sign(
      { sub: String(instructor._id), email: instructor.email, role: 'instructor' },
      config.JWT_SECRET,
    );
    instructorCookie = [`rt_session=${token}; Path=/; HttpOnly`];

    // Create dummy QuestionBank items
    const qA = await QuestionBankModel.create({
      stableId: 'qb_for_a',
      imageId: imageIdA,
      type: 'finding',
      pair: { trueClass: 'covid19', confusedWith: 'pneumonia' },
      bucket: 'easy',
      stem: 'Stem A',
      options: [
        { text: '1', key: null },
        { text: '2', key: null },
        { text: '3', key: null },
        { text: '4', key: null },
      ],
      correctIndex: 0,
      rationale: 'Rationale A',
      status: 'approved',
      source: { model: 'm', promptVersion: 'v' },
    });

    const qB = await QuestionBankModel.create({
      stableId: 'qb_for_b',
      imageId: imageIdB,
      type: 'finding',
      pair: { trueClass: 'pneumonia', confusedWith: 'covid19' },
      bucket: 'medium',
      stem: 'Stem B',
      options: [
        { text: '1', key: null },
        { text: '2', key: null },
        { text: '3', key: null },
        { text: '4', key: null },
      ],
      correctIndex: 1,
      rationale: 'Rationale B',
      status: 'approved',
      source: { model: 'm', promptVersion: 'v' },
    });

    // Create PracticeSet for Resident A (with publicIdA)
    await PracticeSetModel.create({
      userId: residentAId,
      status: 'in_progress',
      size: 1,
      questionIds: [qA._id],
      publicIds: [publicIdA],
      optionOrder: [[0, 1, 2, 3]],
      plan: {},
      answers: [],
    });

    // Create PracticeSet for Resident B (with publicIdB)
    await PracticeSetModel.create({
      userId: residentBId,
      status: 'in_progress',
      size: 1,
      questionIds: [qB._id],
      publicIds: [publicIdB],
      optionOrder: [[0, 1, 2, 3]],
      plan: {},
      answers: [],
    });
  });

  describe('Negative Authorization Tests', () => {
    it('returns 404 when resident requests an image not in any of their sessions or practice sets', async () => {
      const res = await request(app)
        .get(`/api/images/${unassignedPublicId}/file`)
        .set('Cookie', residentACookie);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 when Resident A attempts to fetch an image served only to Resident B', async () => {
      const res = await request(app)
        .get(`/api/images/${publicIdB}/file`)
        .set('Cookie', residentACookie);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Positive Authorization Tests', () => {
    it('allows resident to fetch an image belonging to their own practice set', async () => {
      const resA = await request(app)
        .get(`/api/images/${publicIdA}/file`)
        .set('Cookie', residentACookie);
      expect(resA.status).toBe(200);
      expect(resA.headers['content-type']).toMatch(/image\/jpeg/);
      expect(resA.body.toString('utf8')).toBe('fake-jpeg-data-a');

      const resB = await request(app)
        .get(`/api/images/${publicIdB}/file`)
        .set('Cookie', residentBCookie);
      expect(resB.status).toBe(200);
      expect(resB.body.toString('utf8')).toBe('fake-jpeg-data-b');
    });

    it('allows instructor global access to any image', async () => {
      const res = await request(app)
        .get(`/api/images/${unassignedPublicId}/file`)
        .set('Cookie', instructorCookie);
      expect(res.status).toBe(200);
      expect(res.body.toString('utf8')).toBe('fake-jpeg-unassigned');
    });
  });
});
