import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requireRole } from '../requireRole.js';
import { errorHandler } from '../errorHandler.js';
import { setupTestDb } from '../../../test/helpers/testDb.js';
import { loadEnv } from '../../config/env.js';
import { createOrPromoteInstructor, registerUser } from '../../modules/auth/service.js';

describe('requireRole middleware and instructor creation', () => {
  let testDb;
  let config;

  beforeAll(async () => {
    testDb = await setupTestDb();
    config = loadEnv({
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-at-least-32-characters-long-12345',
      PUBLIC_ID_SALT: 'test-salt-at-least-16-chars',
      RATE_LIMIT_ENABLED: 'false',
    });
  });

  afterAll(async () => {
    if (testDb) {
      await testDb.teardown();
    }
  });

  it('blocks anonymous requests with 401 UNAUTHENTICATED', async () => {
    const app = express();
    app.get('/instructor-only', requireRole('instructor'), (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    const res = await request(app).get('/instructor-only');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('blocks resident users with 403 FORBIDDEN', async () => {
    const app = express();
    // Simulate authenticated resident user
    app.use((req, _res, next) => {
      req.user = { role: 'resident', email: 'resident@example.com' };
      next();
    });
    app.get('/instructor-only', requireRole('instructor'), (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    const res = await request(app).get('/instructor-only');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toBe('Insufficient permissions');
  });

  it('allows instructor users with 200 OK', async () => {
    const app = express();
    // Simulate authenticated instructor user
    app.use((req, _res, next) => {
      req.user = { role: 'instructor', email: 'instructor@example.com' };
      next();
    });
    app.get('/instructor-only', requireRole('instructor'), (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    const res = await request(app).get('/instructor-only');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('creates new instructor or promotes existing resident', async () => {
    // 1. Create a resident user
    const { user: resident } = await registerUser(
      {
        email: 'promo@hospital.org',
        password: 'password123',
        displayName: 'Dr. Promotion',
      },
      config,
    );
    expect(resident.role).toBe('resident');

    // 2. Promote to instructor
    const promoted = await createOrPromoteInstructor({ email: 'promo@hospital.org' }, config);
    expect(promoted.role).toBe('instructor');
    expect(promoted.email).toBe('promo@hospital.org');

    // 3. Create a brand new instructor from scratch
    const newInstructor = await createOrPromoteInstructor(
      {
        email: 'new_prof@hospital.org',
        password: 'newProfessorPass123',
        displayName: 'Prof. X',
      },
      config,
    );
    expect(newInstructor.role).toBe('instructor');
    expect(newInstructor.email).toBe('new_prof@hospital.org');
  });
});
