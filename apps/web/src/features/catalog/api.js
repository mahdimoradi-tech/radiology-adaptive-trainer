import { apiFetch } from '../../lib/api.js';

/**
 * Fetch aggregated catalog distribution statistics
 * @returns {Promise<import('@radiology/contracts').CatalogStats>}
 */
export async function getCatalogStats() {
  const res = await apiFetch('/api/catalog/stats');
  return res?.data;
}

/**
 * Fetch paginated and filtered images from catalog
 *
 * @param {Object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.pageSize=20]
 * @param {string} [params.trueClass]
 * @param {string} [params.bucket]
 * @param {string} [params.source]
 * @returns {Promise<{ items: import('@radiology/contracts').CatalogImageAdmin[], meta: { total: number, page: number, pageSize: number, totalPages: number } }>}
 */
export async function getCatalogImages({
  page = 1,
  pageSize = 20,
  trueClass,
  bucket,
  source,
} = {}) {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (trueClass) query.set('trueClass', trueClass);
  if (bucket) query.set('bucket', bucket);
  if (source) query.set('source', source);

  const res = await apiFetch(`/api/catalog/images?${query.toString()}`);
  return {
    items: res?.data ?? [],
    meta: res?.meta ?? { total: 0, page, pageSize, totalPages: 1 },
  };
}
