import { useQuery } from '@tanstack/react-query';
import { progressKeys } from './keys.js';
import { getProgress, getAdminUserProgress } from './api.js';

/**
 * Hook to fetch current resident's learning progress trajectory
 */
export function useProgress() {
  return useQuery({
    queryKey: progressKeys.resident(),
    queryFn: getProgress,
  });
}

/**
 * Hook for instructors to fetch any resident trainee's progress trajectory
 * @param {string} userId
 */
export function useAdminUserProgress(userId) {
  return useQuery({
    queryKey: progressKeys.adminUser(userId),
    queryFn: () => getAdminUserProgress(userId),
    enabled: Boolean(userId),
  });
}
