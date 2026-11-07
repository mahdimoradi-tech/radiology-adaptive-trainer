import { apiFetch } from '../../lib/api.js';

/**
 * Fetch resident progress trajectory
 * @returns {Promise<import('@radiology/contracts').Progress>}
 */
export async function getProgress() {
  const res = await apiFetch('/api/progress');
  return res?.data;
}

/**
 * Fetch resident progress trajectory for instructor inspection
 * @param {string} userId
 * @returns {Promise<import('@radiology/contracts').Progress>}
 */
export async function getAdminUserProgress(userId) {
  const res = await apiFetch(`/api/admin/users/${userId}/progress`);
  return res?.data;
}
