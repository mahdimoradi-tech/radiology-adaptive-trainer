import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { loadEnv } from '../../../config/env.js';
import { createLogger } from '../../../lib/logger.js';

describe('Health and App middleware', () => {
  let app;

  beforeAll(() => {
    const config = loadEnv({
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-at-least-32-characters-long-12345',
      PUBLIC_ID_SALT: 'test-salt-at-least-16-chars',
    });
    const logger = createLogger({ NODE_ENV: 'test' });
    app = createApp({ config, logger });
  });

  it('GET /api/health returns 200 with status ok and db down when not connected', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: {
        status: 'ok',
        db: 'down',
        version: expect.any(String),
      },
    });
  });

  it('GET /api/nonexistent returns 404 NOT_FOUND', async () => {
    const res = await request(app).get('/api/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    });
  });

  it('POST without application/json returns 415 UNSUPPORTED_MEDIA_TYPE', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'text/plain')
      .send('not json');

    expect(res.status).toBe(415);
    expect(res.body).toEqual({
      error: {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Content-Type must be application/json',
      },
    });
  });
});
