import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../../../app.js';
import { loadEnv } from '../../../config/env.js';
import { createLogger } from '../../../lib/logger.js';
import { setupTestDb } from '../../../../test/helpers/testDb.js';
import { createOrPromoteInstructor } from '../../auth/service.js';
import { seedCatalog } from '../seed.js';
import { CatalogStatsSchema, CatalogImageAdminSchema } from '@radiology/contracts';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Catalog endpoints, Image serving, and Leak tests', () => {
  let app;
  let testDb;
  let config;
  let residentCookie;
  let instructorCookie;
  let samplePublicId;

  const testImagesDir = resolve(__dirname, 'test-images');
  const fixturePath = resolve(__dirname, 'test-catalog.json');

  const testEntries = [
    {
      id: 'kermany_001',
      imageId: 'kermany_001',
      filename: 'kermany_001.jpg',
      trueClass: 'normal',
      source: 'kermany',
      difficulty: 0.15,
      bucket: 'easy',
      confusedWith: 'pneumonia',
    },
    {
      id: 'cohen_002',
      imageId: 'cohen_002',
      filename: 'cohen_002.jpeg',
      trueClass: 'covid19',
      source: 'cohen',
      difficulty: 0.75,
      bucket: 'hard',
      confusedWith: 'pneumonia',
    },
    {
      id: 'kermany_003',
      imageId: 'kermany_003',
      filename: 'kermany_003.jpg',
      trueClass: 'pneumonia',
      source: 'kermany',
      difficulty: 0.55,
      bucket: 'medium',
      confusedWith: 'normal',
    },
  ];

  beforeAll(async () => {
    testDb = await setupTestDb();

    // Create test image directory and sample files
    mkdirSync(testImagesDir, { recursive: true });
    // Minimal valid 1x1 JPEG bytes
    const sampleJpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00,
      0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08,
      0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01,
      0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08,
      0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7f, 0x00, 0xff, 0xd9,
    ]);
    writeFileSync(resolve(testImagesDir, 'kermany_001.jpg'), sampleJpeg);
    writeFileSync(resolve(testImagesDir, 'cohen_002.jpeg'), sampleJpeg);
    writeFileSync(resolve(testImagesDir, 'kermany_003.jpg'), sampleJpeg);

    writeFileSync(fixturePath, JSON.stringify(testEntries, null, 2), 'utf8');

    config = loadEnv({
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-at-least-32-characters-long-12345',
      PUBLIC_ID_SALT: 'test-salt-at-least-16-chars',
      CATALOG_IMAGE_DIR: testImagesDir,
      RATE_LIMIT_ENABLED: 'false',
    });

    const logger = createLogger({ NODE_ENV: 'test' });
    app = createApp({ config, logger });

    // Seed test catalog
    await seedCatalog({
      filePath: fixturePath,
      imagesDir: testImagesDir,
      salt: config.PUBLIC_ID_SALT,
    });

    // Register a resident user and get cookie
    const residentReg = await request(app).post('/api/auth/register').send({
      email: 'resident.tester@hospital.org',
      password: 'password123',
      displayName: 'Dr. Resident',
    });
    residentCookie = residentReg.headers['set-cookie'];

    // Create an instructor user and login to get cookie
    await createOrPromoteInstructor(
      {
        email: 'instructor.tester@hospital.org',
        password: 'instructorPassword123',
        displayName: 'Prof. Tester',
      },
      config,
    );

    const instructorLogin = await request(app).post('/api/auth/login').send({
      email: 'instructor.tester@hospital.org',
      password: 'instructorPassword123',
    });
    instructorCookie = instructorLogin.headers['set-cookie'];
  });

  afterAll(async () => {
    try {
      rmSync(testImagesDir, { recursive: true, force: true });
      rmSync(fixturePath, { force: true });
    } catch {
      // Ignore cleanup error
    }
    if (testDb) {
      await testDb.teardown();
    }
  });

  describe('GET /api/catalog/stats', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/catalog/stats');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects resident requests with 403 FORBIDDEN', async () => {
      const res = await request(app).get('/api/catalog/stats').set('Cookie', residentCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows instructor and returns stats conforming to CatalogStatsSchema', async () => {
      const res = await request(app).get('/api/catalog/stats').set('Cookie', instructorCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();

      const validation = CatalogStatsSchema.safeParse(res.body.data);
      expect(validation.success).toBe(true);

      expect(res.body.data.total).toBe(3);
      expect(res.body.data.byClass.covid19).toBe(1);
      expect(res.body.data.byClass.pneumonia).toBe(1);
      expect(res.body.data.byClass.normal).toBe(1);
      expect(res.body.data.bySource.cohen).toBe(1);
      expect(res.body.data.bySource.kermany).toBe(2);
    });
  });

  describe('GET /api/catalog/images', () => {
    it('rejects resident requests with 403 FORBIDDEN', async () => {
      const res = await request(app).get('/api/catalog/images').set('Cookie', residentCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns paginated image list for instructor conforming to CatalogImageAdminSchema', async () => {
      const res = await request(app)
        .get('/api/catalog/images?page=1&pageSize=10')
        .set('Cookie', instructorCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.meta).toEqual({
        total: 3,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      });

      for (const item of res.body.data) {
        expect(CatalogImageAdminSchema.safeParse(item).success).toBe(true);
        expect(item.url).toMatch(/^\/api\/images\/[0-9a-f]{20}\/file$/);
      }

      // Save a sample publicId for image serving tests
      samplePublicId = res.body.data[0].publicId;
    });

    it('filters images by class, bucket, and source correctly', async () => {
      const res = await request(app)
        .get('/api/catalog/images?trueClass=covid19&bucket=hard')
        .set('Cookie', instructorCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe('cohen_002');
      expect(res.body.data[0].source).toBe('cohen');
    });
  });

  describe('GET /api/images/:publicId/file', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get(`/api/images/${samplePublicId}/file`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('serves image bytes with private cache-control to authenticated resident', async () => {
      const res = await request(app)
        .get(`/api/images/${samplePublicId}/file`)
        .set('Cookie', residentCookie);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/jpeg');
      expect(res.headers['cache-control']).toBe('private, max-age=86400');
      // Verify no filename in headers
      expect(res.headers['content-disposition']).toBeUndefined();
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('returns 404 NOT_FOUND for unknown publicId', async () => {
      const res = await request(app)
        .get('/api/images/00000000000000000000/file')
        .set('Cookie', residentCookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('STRICT LEAK TESTS (Resident visibility boundaries)', () => {
    it('ensures resident user responses never reveal passwordHash', async () => {
      const meRes = await request(app).get('/api/me').set('Cookie', residentCookie);

      expect(meRes.status).toBe(200);
      expect(JSON.stringify(meRes.body)).not.toContain('passwordHash');
    });

    it('ensures image serving headers never reveal dataset source or filenames', async () => {
      const res = await request(app)
        .get(`/api/images/${samplePublicId}/file`)
        .set('Cookie', residentCookie);

      expect(res.status).toBe(200);

      // Inspect all response header values for dataset leakages
      for (const [headerName, headerVal] of Object.entries(res.headers)) {
        const valStr = String(headerVal).toLowerCase();
        expect(valStr, `Header ${headerName} leaked dataset source`).not.toContain('kermany');
        expect(valStr, `Header ${headerName} leaked dataset source`).not.toContain('cohen');
        expect(valStr, `Header ${headerName} leaked dataset source`).not.toContain('figure1');
        expect(valStr, `Header ${headerName} leaked class name`).not.toContain('covid');
        expect(valStr, `Header ${headerName} leaked class name`).not.toContain('pneumonia');
      }
    });
  });
});
