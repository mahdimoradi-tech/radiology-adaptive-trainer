import { z } from 'zod';

/**
 * Standard API error codes
 * @typedef {'VALIDATION_ERROR' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'EMAIL_TAKEN' | 'INVALID_CREDENTIALS' | 'RATE_LIMITED' | 'UNSUPPORTED_MEDIA_TYPE' | 'INTERNAL_ERROR' | 'SESSION_IN_PROGRESS' | 'SESSION_NOT_IN_PROGRESS' | 'SESSION_NOT_FINISHED' | 'SESSION_ALREADY_FINISHED' | 'POOL_EXHAUSTED' | 'QUESTION_NOT_FOUND'} ApiErrorCode
 */
export const API_ERROR_CODES = /** @type {const} */ ([
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'EMAIL_TAKEN',
  'INVALID_CREDENTIALS',
  'RATE_LIMITED',
  'UNSUPPORTED_MEDIA_TYPE',
  'INTERNAL_ERROR',
  'SESSION_IN_PROGRESS',
  'SESSION_NOT_IN_PROGRESS',
  'SESSION_NOT_FINISHED',
  'SESSION_ALREADY_FINISHED',
  'POOL_EXHAUSTED',
  'QUESTION_NOT_FOUND',
]);

export const ApiErrorCodeSchema = z.enum(API_ERROR_CODES);

/**
 * Standard API error response schema
 * @typedef {Object} ApiError
 * @property {{ code: ApiErrorCode, message: string, details?: unknown }} error
 */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string().min(1),
    details: z.unknown().optional(),
  }),
});

/**
 * Pagination query schema
 * @typedef {Object} PaginationQuery
 * @property {number} page
 * @property {number} pageSize
 */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * MongoDB 24-character hexadecimal ObjectId schema
 */
export const ObjectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Must be a 24-character hexadecimal ObjectId');
