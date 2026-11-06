import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { setupTestDb } from '../../test/helpers/testDb.js';
import { seedFixtureImages, TEST_SALT } from '../../test/helpers/sessionFixture.js';
import { loadEnv } from '../../src/config/env.js';
import { UserModel } from '../../src/modules/auth/model.js';
import { SessionModel, ResponseModel } from '../../src/modules/sessions/model.js';
import {
  runDemoSeed,
  DEMO_RESIDENT_EMAIL,
  DEMO_RESIDENT_DISPLAY_NAME,
  DEMO_DEFAULT_PASSWORD,
} from '../demo-seed.js';

describe('Demo Seed Script (apps/api/scripts/demo-seed.js)', () => {
  let testDb;
  let config;

  beforeAll(async () => {
    testDb = await setupTestDb();
    await SessionModel.syncIndexes();
    process.env.JWT_SECRET = 'session-secret-jwt-key-with-32-chars-minimum-xyz';
    process.env.PUBLIC_ID_SALT = TEST_SALT;
    process.env.ALLOW_REPEATS = 'true';
    config = loadEnv({
      ...process.env,
      NODE_ENV: 'test',
      JWT_SECRET: 'session-secret-jwt-key-with-32-chars-minimum-xyz',
      PUBLIC_ID_SALT: TEST_SALT,
      ALLOW_REPEATS: 'true',
    });
  });

  afterAll(async () => {
    if (testDb) {
      await testDb.teardown();
    }
  });

  beforeEach(async () => {
    await testDb.clearCollections();
    await seedFixtureImages(14); // 126 fixture images
  });

  it('refuses to run in production environment with clear error code', async () => {
    await expect(runDemoSeed({ env: 'production', silent: true })).rejects.toMatchObject({
      code: 'PRODUCTION_REFUSED',
      message: expect.stringContaining('refuses to run in production'),
    });
  });

  it('creates demo resident and 4 finished sessions with evolving accuracy, and is idempotent', async () => {
    // 1. Seed demo data
    const result = await runDemoSeed({ env: 'test', config, silent: true });

    expect(result.user).toBeDefined();
    expect(result.user.email).toBe(DEMO_RESIDENT_EMAIL);
    expect(result.user.displayName).toBe(DEMO_RESIDENT_DISPLAY_NAME);
    expect(result.user.role).toBe('resident');

    // Verify password hash
    const dbUser = await UserModel.findOne({ email: DEMO_RESIDENT_EMAIL });
    expect(dbUser).toBeDefined();
    const isMatch = await bcrypt.compare(DEMO_DEFAULT_PASSWORD, dbUser.passwordHash);
    expect(isMatch).toBe(true);

    // Verify 4 sessions created with size 45
    expect(result.sessions).toHaveLength(4);
    const dbSessions = await SessionModel.find({ userId: dbUser._id }).sort({ index: 1 });
    expect(dbSessions).toHaveLength(4);

    for (let i = 0; i < 4; i++) {
      const s = dbSessions[i];
      expect(s.index).toBe(i + 1);
      expect(s.status).toBe('finished');
      expect(s.size).toBe(45);
      expect(s.metrics).toBeDefined();
      expect(s.metrics.overall.accuracy).toBeGreaterThan(0);
      expect(s.metrics.overall.accuracy).toBeLessThan(1); // Never equals 100%
      expect(s.metrics.perClass.covid19.accuracy).toBeLessThan(1);
      expect(s.metrics.perClass.pneumonia.accuracy).toBeLessThan(1);
      expect(s.metrics.perClass.normal.accuracy).toBeLessThan(1);
    }

    // Verify responses stored
    const responsesCount = await ResponseModel.countDocuments({ userId: dbUser._id });
    expect(responsesCount).toBe(4 * 45);

    // 2. Idempotency: run again and confirm exactly 4 sessions remain
    const secondResult = await runDemoSeed({ env: 'test', config, silent: true });
    expect(secondResult.sessions).toHaveLength(4);

    const countAfter = await SessionModel.countDocuments({ userId: dbUser._id });
    expect(countAfter).toBe(4);
  });

  it('--reset removes ONLY the demo resident and its sessions, leaving other users untouched', async () => {
    // Create an innocent non-demo resident
    const otherUser = await UserModel.create({
      email: 'other.doctor@hospital.test',
      displayName: 'Dr. Other Resident',
      passwordHash: 'dummy-hash-12345678',
      role: 'resident',
    });
    const otherSession = await SessionModel.create({
      userId: otherUser._id,
      index: 1,
      kind: 'baseline',
      status: 'finished',
      size: 45,
      questions: [],
    });

    // Run demo:seed to create demo user
    await runDemoSeed({ env: 'test', config, silent: true });
    expect(await UserModel.countDocuments()).toBe(2);
    expect(await SessionModel.countDocuments()).toBe(5);

    // Reset demo seed
    const resetResult = await runDemoSeed({ env: 'test', config, reset: true, silent: true });
    expect(resetResult.resetOnly).toBe(true);

    // Demo resident is gone
    const demoUser = await UserModel.findOne({ email: DEMO_RESIDENT_EMAIL });
    expect(demoUser).toBeNull();
    const demoSessions = await SessionModel.find({ userId: { $ne: otherUser._id } });
    expect(demoSessions).toHaveLength(0);

    // Other user and session still exist!
    const remainingUser = await UserModel.findOne({ email: 'other.doctor@hospital.test' });
    expect(remainingUser).toBeDefined();
    const remainingSession = await SessionModel.findById(otherSession._id);
    expect(remainingSession).toBeDefined();
  });
});
