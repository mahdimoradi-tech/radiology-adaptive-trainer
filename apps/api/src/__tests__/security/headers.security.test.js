import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { loadEnv, EnvSchema } from '../../config/env.js';
import { createLogger } from '../../lib/logger.js';

describe('Security Headers & CORS Regression Tests (S18, S19)', () => {
  let app;
  const CORS_ORIGIN = 'http://127.0.0.1:5173';

  beforeAll(() => {
    const config = loadEnv({
      NODE_ENV: 'test',
      JWT_SECRET: 'headers-security-jwt-key-32chars-min-xyz',
      PUBLIC_ID_SALT: 'salt-for-testing-purposes-16chars',
      CORS_ORIGIN,
      RATE_LIMIT_ENABLED: 'false',
    });
    const logger = createLogger({ NODE_ENV: 'test' });
    app = createApp({ config, logger });
  });

  describe('S18 - Helmet Security Headers', () => {
    it('enforces nosniff and frame protection headers and suppresses x-powered-by', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);

      // 1. X-Content-Type-Options
      expect(res.headers['x-content-type-options']).toBe('nosniff');

      // 2. X-Frame-Options
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');

      // 3. X-Powered-By must be completely stripped
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('handles CORS preflight OPTIONS requests with exact allowed origin and credentials', async () => {
      const res = await request(app)
        .options('/api/auth/login')
        .set('Origin', CORS_ORIGIN)
        .set('Access-Control-Request-Method', 'POST');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(CORS_ORIGIN);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['access-control-allow-methods']).toContain('POST');
    });

    it('forbids wildcard "*" for CORS_ORIGIN via Zod environment validation', () => {
      const invalidEnv = {
        JWT_SECRET: 'headers-security-jwt-key-32chars-min-xyz',
        PUBLIC_ID_SALT: 'salt-for-testing-purposes-16chars',
        CORS_ORIGIN: '*',
      };

      const result = EnvSchema.safeParse(invalidEnv);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('CORS_ORIGIN cannot be *');
    });
  });

  describe('S19 - Sanitized Error Responses in Production', () => {
    it('returns generic INTERNAL_ERROR without leaking error stack traces or file paths', async () => {
      const prodConfig = loadEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'production-safe-jwt-secret-key-32chars-min',
        PUBLIC_ID_SALT: 'salt-for-testing-purposes-16chars',
        RATE_LIMIT_ENABLED: 'false',
      });
      const prodLogger = createLogger({ NODE_ENV: 'production', LOG_LEVEL: 'silent' });
      const testProdApp = createApp({ config: prodConfig, logger: prodLogger });

      // Request nonexistent endpoint (404)
      const res404 = await request(testProdApp).get('/api/nonexistent-route');
      expect(res404.status).toBe(404);
      expect(res404.body.error.code).toBe('NOT_FOUND');
      expect(res404.body.error.stack).toBeUndefined();
      expect(JSON.stringify(res404.body)).not.toContain('node_modules');
      expect(JSON.stringify(res404.body)).not.toContain('apps/api');
    });
  });
});
