import { useQuery } from '@tanstack/react-query';
import { residentKeys } from './keys.js';
import { getAdminResidents } from './api.js';

/**
 * Hook to fetch paginated resident trainees list for instructors
 *
 * @param {Object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.pageSize=10]
 */
export function useAdminResidents({ page = 1, pageSize = 10 } = {}) {
  return useQuery({
    queryKey: residentKeys.list({ page, pageSize }),
    queryFn: () => getAdminResidents({ page, pageSize }),
  });
}
