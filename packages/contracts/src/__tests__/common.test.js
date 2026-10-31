import { describe, it, expect } from 'vitest';
import {
  API_ERROR_CODES,
  ApiErrorCodeSchema,
  ApiErrorSchema,
  PaginationQuerySchema,
  ObjectIdSchema,
} from '../common.js';

describe('Common contracts', () => {
  describe('API_ERROR_CODES and ApiErrorCodeSchema', () => {
    it('contains all required standard error codes', () => {
      const requiredCodes = [
        'VALIDATION_ERROR',
        'UNAUTHENTICATED',
        'FORBIDDEN',
        'NOT_FOUND',
        'EMAIL_TAKEN',
        'INVALID_CREDENTIALS',
        'RATE_LIMITED',
        'UNSUPPORTED_MEDIA_TYPE',
        'INTERNAL_ERROR',
      ];
      for (const code of requiredCodes) {
        expect(API_ERROR_CODES).toContain(code);
        expect(ApiErrorCodeSchema.safeParse(code).success).toBe(true);
      }
    });

    it('rejects unknown error codes', () => {
      expect(ApiErrorCodeSchema.safeParse('UNKNOWN_CODE').success).toBe(false);
      expect(ApiErrorCodeSchema.safeParse('').success).toBe(false);
      expect(ApiErrorCodeSchema.safeParse(123).success).toBe(false);
    });
  });

  describe('ApiErrorSchema', () => {
    it('accepts valid error payload with and without details', () => {
      const withoutDetails = {
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required',
        },
      };
      expect(ApiErrorSchema.safeParse(withoutDetails).success).toBe(true);

      const withDetails = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: { field: 'email', reason: 'invalid format' },
        },
      };
      expect(ApiErrorSchema.safeParse(withDetails).success).toBe(true);
    });

    it('rejects invalid error payload structures', () => {
      expect(ApiErrorSchema.safeParse({ error: { code: 'INVALID' } }).success).toBe(false);
      expect(ApiErrorSchema.safeParse({ code: 'NOT_FOUND', message: 'Not found' }).success).toBe(
        false,
      );
      expect(ApiErrorSchema.safeParse({ error: null }).success).toBe(false);
    });
  });

  describe('PaginationQuerySchema', () => {
    it('provides sensible defaults for page and pageSize', () => {
      const parsed = PaginationQuerySchema.parse({});
      expect(parsed).toEqual({ page: 1, pageSize: 20 });
    });

    it('coerces string numbers to integers', () => {
      const parsed = PaginationQuerySchema.parse({ page: '3', pageSize: '50' });
      expect(parsed).toEqual({ page: 3, pageSize: 50 });
    });

    it('enforces maximum pageSize of 100', () => {
      expect(PaginationQuerySchema.safeParse({ pageSize: 100 }).success).toBe(true);
      expect(PaginationQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
    });

    it('rejects negative or zero page and pageSize', () => {
      expect(PaginationQuerySchema.safeParse({ page: 0 }).success).toBe(false);
      expect(PaginationQuerySchema.safeParse({ page: -1 }).success).toBe(false);
      expect(PaginationQuerySchema.safeParse({ pageSize: 0 }).success).toBe(false);
      expect(PaginationQuerySchema.safeParse({ pageSize: -5 }).success).toBe(false);
    });
  });

  describe('ObjectIdSchema', () => {
    it('accepts valid 24-character hexadecimal ObjectId', () => {
      expect(ObjectIdSchema.safeParse('507f1f77bcf86cd799439011').success).toBe(true);
      expect(ObjectIdSchema.safeParse('000000000000000000000000').success).toBe(true);
      expect(ObjectIdSchema.safeParse('abcdefABCDEF012345678912').success).toBe(true);
    });

    it('rejects invalid lengths and characters', () => {
      expect(ObjectIdSchema.safeParse('507f1f77bcf86cd79943901').success).toBe(false); // 23 chars
      expect(ObjectIdSchema.safeParse('507f1f77bcf86cd7994390111').success).toBe(false); // 25 chars
      expect(ObjectIdSchema.safeParse('507f1f77bcf86cd79943901g').success).toBe(false); // 'g' is non-hex
      expect(ObjectIdSchema.safeParse('').success).toBe(false);
    });
  });
});
