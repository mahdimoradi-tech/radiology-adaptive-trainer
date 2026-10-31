import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validate } from '../validate.js';
import { errorHandler } from '../errorHandler.js';

describe('Validate middleware', () => {
  it('stores parsed body and query in req.valid without mutating req.query', async () => {
    const app = express();
    app.use(express.json());

    const bodySchema = z.object({
      name: z.string().trim(),
    });
    const querySchema = z.object({
      page: z.coerce.number().int().min(1),
    });

    app.post('/test', validate({ body: bodySchema, query: querySchema }), (req, res) => {
      res.json({
        valid: req.valid,
        queryType: typeof req.query.page,
      });
    });
    app.use(errorHandler);

    const res = await request(app).post('/test?page=5').send({ name: '  Radiology User  ' });

    expect(res.status).toBe(200);
    expect(res.body.valid.body.name).toBe('Radiology User');
    expect(res.body.valid.query.page).toBe(5);
    // In Express 5 req.query is untouched
    expect(res.body.queryType).toBe('string');
  });

  it('returns 400 VALIDATION_ERROR with issues on schema validation failure', async () => {
    const app = express();
    app.use(express.json());

    const bodySchema = z.object({
      age: z.number().min(18),
    });

    app.post('/test-fail', validate({ body: bodySchema }), (_req, res) => {
      res.json({ ok: true });
    });
    app.use(errorHandler);

    const res = await request(app).post('/test-fail').send({ age: 10 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });
});
