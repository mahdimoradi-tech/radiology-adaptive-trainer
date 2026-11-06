import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../../lib/api.js';

export const AUTH_QUERY_KEY = ['me'];

/**
 * Fetch current authenticated user session
 * 401 (UNAUTHENTICATED) resolves gracefully to null instead of an error state.
 */
export function useMe() {
  return useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      try {
        const res = await apiFetch('/api/me');
        return res?.data?.user ?? null;
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.code === 'UNAUTHENTICATED')) {
          return null;
        }
        throw err;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Mutation for resident/instructor login
 */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials) => {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: credentials,
      });
      return res?.data?.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, user);
    },
  });
}

/**
 * Mutation for resident registration
 */
export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (registrationData) => {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: registrationData,
      });
      return res?.data?.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, user);
    },
  });
}

/**
 * Mutation to terminate user session and clear cache
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiFetch('/api/auth/logout', { method: 'POST', body: {} });
    },
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
    },
  });
}
