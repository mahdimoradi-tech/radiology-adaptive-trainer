import { describe, it, expect } from 'vitest';
import { loadEnv } from '../env.js';

describe('API Environment loader', () => {
  const validSource = {
    JWT_SECRET: 'this-is-a-valid-jwt-secret-string-of-32-chars-or-more',
    PUBLIC_ID_SALT: 'this-is-a-valid-salt-string-16-chars',
  };

  it('loads valid environment and applies default values', () => {
    const env = loadEnv(validSource);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
    expect(env.MONGODB_URI).toBe('mongodb://127.0.0.1:27017/radiology');
    expect(env.MONGODB_URI_TEST).toBe('mongodb://127.0.0.1:27017');
    expect(env.JWT_TTL_HOURS).toBe(12);
    expect(env.BCRYPT_COST).toBe(12);
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.RATE_LIMIT_ENABLED).toBe(true);
    expect(env.ALLOW_REPEATS).toBe(false);
    expect(env.catalogFilePath).toContain('catalog.json');
    expect(env.catalogImageDirPath).toContain('images');
  });

  it('sets BCRYPT_COST to 4 by default when NODE_ENV is test', () => {
    const env = loadEnv({
      ...validSource,
      NODE_ENV: 'test',
    });
    expect(env.BCRYPT_COST).toBe(4);
  });

  it('rejects JWT_SECRET shorter than 32 characters', () => {
    expect(() =>
      loadEnv({
        ...validSource,
        JWT_SECRET: 'short-secret',
      }),
    ).toThrow();
  });

  it('rejects PUBLIC_ID_SALT shorter than 16 characters', () => {
    expect(() =>
      loadEnv({
        ...validSource,
        PUBLIC_ID_SALT: 'short-salt',
      }),
    ).toThrow();
  });

  it('rejects "change-me" for JWT_SECRET when NODE_ENV is production', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'change-me',
        PUBLIC_ID_SALT: 'this-is-a-valid-salt-string-16-chars',
      }),
    ).toThrow();
  });

  it('correctly parses boolean strings for flags', () => {
    const env = loadEnv({
      ...validSource,
      COOKIE_SECURE: 'true',
      RATE_LIMIT_ENABLED: 'false',
    });
    expect(env.COOKIE_SECURE).toBe(true);
    expect(env.RATE_LIMIT_ENABLED).toBe(false);
  });
});
