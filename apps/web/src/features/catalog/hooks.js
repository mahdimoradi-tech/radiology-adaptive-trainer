import { useQuery } from '@tanstack/react-query';
import { catalogKeys } from './keys.js';
import { getCatalogStats, getCatalogImages } from './api.js';

/**
 * Hook to retrieve aggregated catalog statistics
 */
export function useCatalogStats() {
  return useQuery({
    queryKey: catalogKeys.stats(),
    queryFn: getCatalogStats,
  });
}

/**
 * Hook to retrieve paginated and filtered images from catalog
 *
 * @param {Object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.pageSize=20]
 * @param {string} [params.trueClass]
 * @param {string} [params.bucket]
 * @param {string} [params.source]
 */
export function useCatalogImages({ page = 1, pageSize = 20, trueClass, bucket, source } = {}) {
  return useQuery({
    queryKey: catalogKeys.list({ page, pageSize, trueClass, bucket, source }),
    queryFn: () => getCatalogImages({ page, pageSize, trueClass, bucket, source }),
  });
}
