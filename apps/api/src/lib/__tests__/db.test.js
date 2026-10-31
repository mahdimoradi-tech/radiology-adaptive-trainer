import { describe, it, expect, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { setupTestDb } from '../../../test/helpers/testDb.js';
import { createApp } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { createLogger } from '../logger.js';

describe('Database and Test Helper', () => {
  let testDb;

  afterAll(async () => {
    if (testDb) {
      await testDb.teardown();
    }
  });

  it('connects to an isolated test database and health check reports db up', async () => {
    testDb = await setupTestDb();
    expect(mongoose.connection.readyState).toBe(1);

    const config = loadEnv({
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-at-least-32-characters-long-12345',
      PUBLIC_ID_SALT: 'test-salt-at-least-16-chars',
    });
    const logger = createLogger({ NODE_ENV: 'test' });
    const app = createApp({ config, logger });

    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.db).toBe('up');
  });

  it('drops database and cleans up on teardown', async () => {
    expect(mongoose.connection.db).toBeDefined();
    await testDb.teardown();
    expect(mongoose.connection.readyState).toBe(0);
    testDb = null;
  });

  it('fails with clear error message when MongoDB service is unreachable', async () => {
    await expect(setupTestDb({ uri: 'mongodb://127.0.0.1:59999', timeout: 1000 })).rejects.toThrow(
      /Start the MongoDB service/,
    );
  });
});
