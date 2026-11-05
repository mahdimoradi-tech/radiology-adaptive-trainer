import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../../../app.js';
import { loadEnv } from '../../../config/env.js';
import { createLogger } from '../../../lib/logger.js';
import { setupTestDb } from '../../../../test/helpers/testDb.js';
import { UserModel } from '../../auth/model.js';
import { ImageModel } from '../../catalog/model.js';
import { AnalysisValidationModel } from '../../analysis/model.js';
import { QuestionBankModel } from '../model.js';
import { seedFixtureImages } from '../../../../test/helpers/sessionFixture.js';

describe('Admin Question Bank Endpoints', () => {
  let app;
  let testDb;
  let residentCookie;
  let instructorCookie;
  let sampleQuestion;

  beforeAll(async () => {
    testDb = await setupTestDb();
    const config = loadEnv({
      NODE_ENV: 'test',
      JWT_SECRET: 'bank-secret-jwt-key-with-32-chars-minimum-xyz',
      PUBLIC_ID_SALT: 'test-salt-salt-salt-16chars',
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

    // 1. Create resident user
    const rRes = await request(app).post('/api/auth/register').send({
      email: 'resident@hospital.test',
      password: 'ResidentPassword123!',
      displayName: 'Resident Trainee',
    });
    residentCookie = rRes.headers['set-cookie'];

    // 2. Create instructor user
    const instHash = await bcrypt.hash('InstructorPassword123!', 4);
    await UserModel.create({
      email: 'instructor@hospital.test',
      passwordHash: instHash,
      displayName: 'Dr. Instructor',
      role: 'instructor',
    });

    const iRes = await request(app).post('/api/auth/login').send({
      email: 'instructor@hospital.test',
      password: 'InstructorPassword123!',
    });
    instructorCookie = iRes.headers['set-cookie'];

    // 3. Seed an image and validation
    await ImageModel.create({
      _id: 'cohen_cov_10',
      publicId: 'pub_cohen_10_1234567890',
      filename: 'cohen_10.jpg',
      trueClass: 'covid19',
      confusedWith: 'pneumonia',
      difficulty: 0.6,
      bucket: 'medium',
      source: 'cohen',
    });

    await AnalysisValidationModel.create({
      imageId: 'cohen_cov_10',
      promptVersion: 'v1',
      status: 'auto_passed',
      datasetLabel: 'covid19',
      consensus: {
        patterns: ['ground_glass'],
        distribution: 'peripheral',
        laterality: 'bilateral',
        zones: ['lower'],
      },
    });

    // 4. Seed question in bank
    sampleQuestion = await QuestionBankModel.create({
      stableId: 'abcd1234abcd1234abcd1234abcd1234abcd1234',
      imageId: 'cohen_cov_10',
      type: 'finding',
      pair: {
        trueClass: 'covid19',
        confusedWith: 'pneumonia',
      },
      bucket: 'medium',
      stem: 'کدام یافته پاتولوژیک اولیه در نمای رادیوگرافی مشهود است؟',
      options: [
        { text: 'کدورت شیشه‌مات', key: 'ground_glass' },
        { text: 'تراکم ریوی', key: 'consolidation' },
        { text: 'هوابرونکوگرام', key: 'air_bronchograms' },
        { text: 'ریه شفاف طبیعی', key: 'clear_lungs' },
      ],
      correctIndex: 0,
      rationale: 'کدورت شیشه‌مات دوطرفه مشاهده می‌شود.',
      kbRef: null,
      tags: ['finding'],
      status: 'pending_review',
      edited: false,
      source: {
        model: 'gemini-3.8-flash',
        promptVersion: 'v1',
        analysisIds: [],
      },
      history: [
        {
          action: 'created',
          by: 'system',
          at: new Date(),
          toStatus: 'pending_review',
        },
      ],
      analysisSummary: {
        consensus: {
          patterns: ['ground_glass'],
          distribution: 'peripheral',
          laterality: 'bilateral',
          zones: ['lower'],
        },
      },
    });
  });

  describe('Authorization guards', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/admin/questions');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 403 for resident role across all admin routes', async () => {
      const qId = sampleQuestion._id.toString();

      const routes = [
        request(app).get('/api/admin/questions').set('Cookie', residentCookie),
        request(app).get('/api/admin/questions/stats').set('Cookie', residentCookie),
        request(app).get(`/api/admin/questions/${qId}`).set('Cookie', residentCookie),
        request(app)
          .post(`/api/admin/questions/${qId}/approve`)
          .set('Cookie', residentCookie)
          .send({}),
        request(app)
          .post(`/api/admin/questions/${qId}/reject`)
          .set('Cookie', residentCookie)
          .send({}),
        request(app)
          .put(`/api/admin/questions/${qId}`)
          .set('Cookie', residentCookie)
          .send({
            stem: 'سؤال جدید',
            options: [{ text: 'یک' }, { text: 'دو' }, { text: 'سه' }, { text: 'چهار' }],
            correctIndex: 0,
            rationale: 'توضیحات',
          }),
      ];

      for (const reqPromise of routes) {
        const res = await reqPromise;
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
    });
  });

  describe('List, Filtering and Stats', () => {
    it('lists questions with pagination and filters', async () => {
      const res = await request(app)
        .get('/api/admin/questions?status=pending_review&type=finding')
        .set('Cookie', instructorCookie);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].id).toBe(sampleQuestion._id.toString());
      expect(res.body.items[0].imageUrl).toBe('/api/images/pub_cohen_10_1234567890/file');
    });

    it('returns stats counts', async () => {
      const res = await request(app)
        .get('/api/admin/questions/stats')
        .set('Cookie', instructorCookie);

      expect(res.status).toBe(200);
      expect(res.body.countsByStatus.pending_review).toBe(1);
      expect(res.body.countsByStatus.total).toBe(1);
      expect(res.body.countsByType.finding).toBe(1);
      expect(res.body.countsByPair['covid19:pneumonia']).toBe(1);
    });

    it('returns 404 for non-existent question ID', async () => {
      const res = await request(app)
        .get('/api/admin/questions/507f1f77bcf86cd799439011')
        .set('Cookie', instructorCookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Approve, Reject and Edit Actions', () => {
    it('approves question and updates status and history', async () => {
      const qId = sampleQuestion._id.toString();
      const res = await request(app)
        .post(`/api/admin/questions/${qId}/approve`)
        .set('Cookie', instructorCookie)
        .send({ note: 'تأیید برای بانک سؤالات' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('approved');
      expect(res.body.reviewedBy).toBe('Dr. Instructor');
      expect(res.body.note).toBe('تأیید برای بانک سؤالات');
      expect(res.body.history).toHaveLength(2);
      expect(res.body.history[1].action).toBe('approved');
    });

    it('rejects question and updates status and history', async () => {
      const qId = sampleQuestion._id.toString();
      const res = await request(app)
        .post(`/api/admin/questions/${qId}/reject`)
        .set('Cookie', instructorCookie)
        .send({ note: 'کیفیت مناسب آموزش نیست' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('rejected');
      expect(res.body.reviewedBy).toBe('Dr. Instructor');
      expect(res.body.note).toBe('کیفیت مناسب آموزش نیست');
      expect(res.body.history).toHaveLength(2);
      expect(res.body.history[1].action).toBe('rejected');
    });

    it('rejects edit when validation rules are violated (e.g. contains digit)', async () => {
      const qId = sampleQuestion._id.toString();
      const res = await request(app)
        .put(`/api/admin/questions/${qId}`)
        .set('Cookie', instructorCookie)
        .send({
          stem: 'صورت سؤال حاوی عدد 123 است؟',
          options: [
            { text: 'کدورت شیشه‌مات' },
            { text: 'تراکم ریوی' },
            { text: 'هوابرونکوگرام' },
            { text: 'ریه شفاف طبیعی' },
          ],
          correctIndex: 0,
          rationale: 'توضیحات اصلاح شد.',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toContain('HAS_DIGIT');
    });

    it('allows valid edit, sets edited=true, resets status to pending_review, and records diff', async () => {
      // First approve the question
      const qId = sampleQuestion._id.toString();
      await request(app)
        .post(`/api/admin/questions/${qId}/approve`)
        .set('Cookie', instructorCookie)
        .send({});

      const newStem = 'کدام الگوی پاتولوژیک بارز و اولیه در ریه بیمار مشاهده می‌گردد؟';
      const res = await request(app)
        .put(`/api/admin/questions/${qId}`)
        .set('Cookie', instructorCookie)
        .send({
          stem: newStem,
          options: [
            { text: 'کدورت شیشه‌مات دوطرفه' },
            { text: 'تراکم تک‌لوب' },
            { text: 'هوابرونکوگرام محیطی' },
            { text: 'ریه بدون ضایعه و شفاف' },
          ],
          correctIndex: 0,
          rationale: 'توضیحات اصلاح شد و دقیق‌تر گردید.',
          note: 'متن گزینه‌ها شفاف‌تر شد',
        });

      expect(res.status).toBe(200);
      expect(res.body.edited).toBe(true);
      expect(res.body.status).toBe('pending_review'); // Reset to pending!
      expect(res.body.stem).toBe(newStem);
      expect(res.body.options[0].text).toBe('کدورت شیشه‌مات دوطرفه');
      expect(res.body.options[0].key).toBe('ground_glass'); // Key preserved!
      expect(res.body.history.length).toBeGreaterThanOrEqual(3);

      const latestAction = res.body.history[res.body.history.length - 1];
      expect(latestAction.action).toBe('edited');
      expect(latestAction.fromStatus).toBe('approved');
      expect(latestAction.toStatus).toBe('pending_review');
    });
  });

  describe('Strict Resident Isolation & Zero Leakage', () => {
    it('guarantees that resident endpoints NEVER leak question bank stems, options or rationales', async () => {
      // Seed catalog so session creation succeeds
      await seedFixtureImages(14);

      // 1. Resident creates a session
      const createRes = await request(app)
        .post('/api/sessions')
        .set('Cookie', residentCookie)
        .send({ size: 60 });

      expect(createRes.status).toBe(201);
      const sessionObj = createRes.body.data;
      const jsonStr = JSON.stringify(sessionObj);

      // Verify no leak of sampleQuestion's stem or stableId
      expect(jsonStr).not.toContain(sampleQuestion.stem);
      expect(jsonStr).not.toContain(sampleQuestion.stableId);
      expect(jsonStr).not.toContain('کدورت شیشه‌مات دوطرفه');

      // 2. Resident inspects session by id
      const getRes = await request(app)
        .get(`/api/sessions/${sessionObj.id}`)
        .set('Cookie', residentCookie);

      expect(getRes.status).toBe(200);
      const getStr = JSON.stringify(getRes.body);
      expect(getStr).not.toContain(sampleQuestion.stem);
      expect(getStr).not.toContain(sampleQuestion.stableId);
      expect(getStr).not.toContain(sampleQuestion.rationale);

      // 3. Resident calls progress endpoint
      const progRes = await request(app).get('/api/progress').set('Cookie', residentCookie);

      expect(progRes.status).toBe(200);
      const progStr = JSON.stringify(progRes.body);
      expect(progStr).not.toContain(sampleQuestion.stem);
      expect(progStr).not.toContain(sampleQuestion.stableId);
    });
  });
});
