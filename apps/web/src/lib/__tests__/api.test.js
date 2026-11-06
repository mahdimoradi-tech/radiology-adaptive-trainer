import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { apiFetch, ApiError, getErrorI18nKey } from '../api.js';

describe('API Client (apiFetch)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('performs JSON request with credentials: include and parses JSON body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: { id: '123' } }),
    });

    const result = await apiFetch('/api/test', {
      method: 'POST',
      body: { name: 'Radiology' },
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/test', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Radiology' }),
      credentials: 'include',
    });
    expect(result).toEqual({ data: { id: '123' } });
  });

  it('parses successful response through Zod schema when provided', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ value: 42 }),
    });

    const Schema = z.object({ value: z.number() });
    const result = await apiFetch('/api/schema-test', { schema: Schema });
    expect(result).toEqual({ value: 42 });
  });

  it('throws ApiError with error details on HTTP error status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      }),
    });

    await expect(apiFetch('/api/auth/login', { method: 'POST' })).rejects.toThrow(ApiError);

    try {
      await apiFetch('/api/auth/login', { method: 'POST' });
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.code).toBe('INVALID_CREDENTIALS');
      expect(err.status).toBe(401);
    }
  });

  it('throws ApiError with code NETWORK on connection rejection', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    try {
      await apiFetch('/api/network-fail');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.code).toBe('NETWORK');
      expect(err.status).toBe(0);
    }
  });

  it('handles 204 No Content gracefully returning null and supplies Content-Type for POST without body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
    });

    const res = await apiFetch('/api/auth/logout', { method: 'POST' });
    expect(res).toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
      credentials: 'include',
    });
  });

  it('automatically adds Content-Type and empty JSON body for state-changing methods without body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true }),
    });

    for (const method of ['POST', 'PUT', 'PATCH']) {
      await apiFetch(`/api/action-${method}`, { method });
      expect(globalThis.fetch).toHaveBeenCalledWith(`/api/action-${method}`, {
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        credentials: 'include',
      });
    }
  });

  it('does not add Content-Type: application/json for GET or FormData requests', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: 'ok' }),
    });

    await apiFetch('/api/info', { method: 'GET' });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/info', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      body: undefined,
      credentials: 'include',
    });

    const formData = new FormData();
    formData.append('key', 'val');
    await apiFetch('/api/upload', { method: 'POST', body: formData });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/upload', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      body: formData,
      credentials: 'include',
    });
  });

  it('getErrorI18nKey maps codes to i18n paths correctly', () => {
    expect(getErrorI18nKey('EMAIL_TAKEN')).toBe('errors.EMAIL_TAKEN');
    expect(getErrorI18nKey('INVALID_CREDENTIALS')).toBe('errors.INVALID_CREDENTIALS');
    expect(getErrorI18nKey('UNKNOWN_CODE')).toBe('errors.INTERNAL_ERROR');
  });
});
