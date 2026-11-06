import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMe, useLogin, useRegister, useLogout } from '../hooks.js';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

describe('Auth Hooks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('useMe', () => {
    it('returns user data on 200 OK', async () => {
      const mockUser = { id: 'u1', email: 'test@example.com', role: 'resident' };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: { user: mockUser } }),
      });

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useMe(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockUser);
    });

    it('resolves gracefully to null on 401 UNAUTHENTICATED', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          error: { code: 'UNAUTHENTICATED', message: 'Not logged in' },
        }),
      });

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useMe(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeNull();
      expect(result.current.isError).toBe(false);
    });
  });

  describe('useLogin', () => {
    it('mutates login endpoint and updates query cache', async () => {
      const mockUser = { id: 'u1', email: 'test@example.com', role: 'resident' };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: { user: mockUser } }),
      });

      const { queryClient, Wrapper } = createWrapper();
      const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          email: 'test@example.com',
          password: 'password123',
        });
      });

      expect(queryClient.getQueryData(['me'])).toEqual(mockUser);
    });
  });

  describe('useRegister', () => {
    it('mutates register endpoint and sets user session in cache', async () => {
      const mockUser = { id: 'u2', email: 'new@example.com', role: 'resident' };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: { user: mockUser } }),
      });

      const { queryClient, Wrapper } = createWrapper();
      const { result } = renderHook(() => useRegister(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          email: 'new@example.com',
          password: 'password123',
          displayName: 'New Resident',
        });
      });

      expect(queryClient.getQueryData(['me'])).toEqual(mockUser);
    });
  });

  describe('useLogout', () => {
    it('calls logout endpoint and nullifies user cache', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
      });

      const { queryClient, Wrapper } = createWrapper();
      queryClient.setQueryData(['me'], { id: 'u1' });

      const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        credentials: 'include',
      });

      expect(queryClient.getQueryData(['me'])).toBeNull();
    });
  });
});
