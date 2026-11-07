import { z } from 'zod';
import { resolveRepoPath } from './paths.js';

export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/radiology'),
    MONGODB_URI_TEST: z.string().min(1).default('mongodb://127.0.0.1:27017'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_TTL_HOURS: z.coerce.number().positive().default(12),
    PUBLIC_ID_SALT: z.string().min(16, 'PUBLIC_ID_SALT must be at least 16 characters'),
    BCRYPT_COST: z.coerce.number().int().min(4).max(16).default(12),
    COOKIE_SECURE: z
      .preprocess((val) => {
        if (typeof val === 'string') {
          return val.toLowerCase() === 'true' || val === '1';
        }
        return val === undefined ? false : Boolean(val);
      }, z.boolean())
      .default(false),
    CORS_ORIGIN: z
      .string()
      .refine((val) => val !== '*', {
        message: 'CORS_ORIGIN cannot be * when credentials are used',
      })
      .default(''),
    RATE_LIMIT_ENABLED: z
      .preprocess((val) => {
        if (typeof val === 'string') {
          return val.toLowerCase() === 'true' || val === '1';
        }
        return val === undefined ? true : Boolean(val);
      }, z.boolean())
      .default(true),
    ALLOW_REPEATS: z
      .preprocess((val) => {
        if (typeof val === 'string') {
          return val.toLowerCase() === 'true' || val === '1';
        }
        return val === undefined ? false : Boolean(val);
      }, z.boolean())
      .default(false),
    CATALOG_FILE: z.string().default('ml/artifacts/catalog.json'),
    CATALOG_IMAGE_DIR: z.string().default('data/catalog/images'),
    LLM_MODE: z.enum(['live', 'cache-only', 'fake']).default('cache-only'),
    LLM_ENABLED: z
      .preprocess((val) => {
        if (typeof val === 'string') {
          return val.toLowerCase() === 'true' || val === '1';
        }
        return val === undefined ? true : Boolean(val);
      }, z.boolean())
      .default(true),
    GEMINI_API_KEY: z.string().default(''),
    GEMINI_MODEL: z.string().default('gemini-3.8-flash'),
    LLM_DAILY_REQUEST_BUDGET: z.coerce.number().int().min(1).default(16),
    LLM_MIN_INTERVAL_MS: z.coerce.number().int().min(0).default(13000),
    LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).default(60000),
    LLM_RATE_LIMIT_PER_USER_PER_HOUR: z.coerce.number().int().min(1).default(30),
  })
  .refine(
    (env) => {
      if (env.NODE_ENV === 'production' && env.JWT_SECRET === 'change-me') {
        return false;
      }
      return true;
    },
    {
      message: 'JWT_SECRET cannot be "change-me" in production',
      path: ['JWT_SECRET'],
    },
  )
  .refine(
    (env) => {
      if (env.LLM_MODE === 'live' && env.LLM_ENABLED && !env.GEMINI_API_KEY?.trim()) {
        return false;
      }
      return true;
    },
    {
      message: 'GEMINI_API_KEY is required when LLM_MODE is "live" and LLM_ENABLED is true',
      path: ['GEMINI_API_KEY'],
    },
  );

/**
 * Load and validate environment variables
 * @param {Record<string, string|undefined>} [source=process.env]
 * @returns {z.infer<typeof EnvSchema> & { catalogFilePath: string, catalogImageDirPath: string }}
 */
export function loadEnv(source = process.env) {
  const parsed = EnvSchema.parse(source);

  // Default BCRYPT_COST to 4 in test mode for performance if not explicitly set
  const bcryptCost = source.BCRYPT_COST
    ? parsed.BCRYPT_COST
    : parsed.NODE_ENV === 'test'
      ? 4
      : parsed.BCRYPT_COST;

  return {
    ...parsed,
    BCRYPT_COST: bcryptCost,
    catalogFilePath: resolveRepoPath(parsed.CATALOG_FILE),
    catalogImageDirPath: resolveRepoPath(parsed.CATALOG_IMAGE_DIR),
  };
}
