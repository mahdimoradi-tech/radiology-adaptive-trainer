import { apiFetch } from '../../lib/api.js';

/**
 * Fetch paginated list of resident trainees for instructor panel
 *
 * @param {Object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.pageSize=10]
 * @returns {Promise<{ items: import('@radiology/contracts').AdminResidentSummary[], meta: { total: number, page: number, pageSize: number, totalPages: number } }>}
 */
export async function getAdminResidents({ page = 1, pageSize = 10 } = {}) {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const res = await apiFetch(`/api/admin/users?${query.toString()}`);
  return {
    items: res?.data ?? [],
    meta: res?.meta ?? { total: 0, page, pageSize, totalPages: 1 },
  };
}
