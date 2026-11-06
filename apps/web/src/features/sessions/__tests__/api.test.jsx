import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { sessionKeys } from '../keys.js';
import {
  getSessions,
  getSession,
  createSession,
  answerQuestion,
  finishSession,
  getSessionReport,
} from '../api.js';
import { useAnswerQuestion } from '../hooks.js';

describe('Sessions API and Query Keys', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('constructs consistent query keys', () => {
    expect(sessionKeys.all).toEqual(['sessions']);
    expect(sessionKeys.lists()).toEqual(['sessions', 'list']);
    expect(sessionKeys.list({ page: 2, pageSize: 10 })).toEqual([
      'sessions',
      'list',
      { page: 2, pageSize: 10 },
    ]);
    expect(sessionKeys.details()).toEqual(['sessions', 'detail']);
    expect(sessionKeys.detail('sess-1')).toEqual(['sessions', 'detail', 'sess-1']);
    expect(sessionKeys.reports()).toEqual(['sessions', 'report']);
    expect(sessionKeys.report('sess-1')).toEqual(['sessions', 'report', 'sess-1']);
  });

  it('getSessions fetches paginated list and unwraps data and meta', async () => {
    const mockData = [{ id: 'sess-1', index: 1 }];
    const mockMeta = { total: 1, page: 1, pageSize: 20, totalPages: 1 };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: mockData, meta: mockMeta }),
    });

    const result = await getSessions({ page: 1, pageSize: 20 });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions?page=1&pageSize=20', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      body: undefined,
      credentials: 'include',
    });
    expect(result).toEqual({ items: mockData, meta: mockMeta });
  });

  it('getSession fetches session detail and unwraps data', async () => {
    const mockSession = { id: 'sess-1', size: 60 };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: mockSession }),
    });

    const result = await getSession('sess-1');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions/sess-1', expect.anything());
    expect(result).toEqual(mockSession);
  });

  it('createSession posts session size and unwraps created session', async () => {
    const mockSession = { id: 'sess-new', size: 45 };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: mockSession }),
    });

    const result = await createSession({ size: 45 });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/sessions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ size: 45 }),
      }),
    );
    expect(result).toEqual(mockSession);
  });

  it('answerQuestion puts answer with timeMs to correct endpoint', async () => {
    const mockResult = { no: 3, answered: true, answer: 'covid19' };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: mockResult }),
    });

    const result = await answerQuestion('sess-1', 3, { answer: 'covid19', timeMs: 4200 });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/sessions/sess-1/questions/3/answer',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ answer: 'covid19', timeMs: 4200 }),
      }),
    );
    expect(result).toEqual(mockResult);
  });

  it('finishSession posts to finish endpoint and unwraps report', async () => {
    const mockReport = { sessionId: 'sess-1', overall: { accuracy: 0.8 } };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: mockReport }),
    });

    const result = await finishSession('sess-1');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/sessions/sess-1/finish',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({}),
      }),
    );
    expect(result).toEqual(mockReport);
  });

  it('getSessionReport fetches session report and unwraps data', async () => {
    const mockReport = { sessionId: 'sess-1', mastered: true };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: mockReport }),
    });

    const result = await getSessionReport('sess-1');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions/sess-1/report', expect.anything());
    expect(result).toEqual(mockReport);
  });

  it('useAnswerQuestion applies optimistic update and rolls back on failure', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const initialSession = {
      id: 's-1',
      answeredCount: 0,
      questions: [
        { no: 1, answered: false, answer: null },
        { no: 2, answered: false, answer: null },
      ],
    };
    queryClient.setQueryData(sessionKeys.detail('s-1'), initialSession);

    // Mock failure
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'Fail' } }),
    });

    const { result } = renderHook(() => useAnswerQuestion('s-1'), { wrapper });

    await expect(
      result.current.mutateAsync({ questionNo: 1, answer: 'pneumonia' }),
    ).rejects.toThrow();

    await waitFor(() => {
      const cached = queryClient.getQueryData(sessionKeys.detail('s-1'));
      expect(cached.questions[0].answered).toBe(false);
      expect(cached.answeredCount).toBe(0);
    });
  });
});
