import { apiFetch } from '../../lib/api.js';

/**
 * Fetch paginated and filtered list of bank questions
 * @param {Object} [filters]
 * @returns {Promise<{ items: any[], total: number, page: number, pageSize: number, totalPages: number }>}
 */
export async function getBankQuestions(filters = {}) {
  const query = new URLSearchParams();
  if (filters.status) query.set('status', filters.status);
  if (filters.type) query.set('type', filters.type);
  if (filters.trueClass) query.set('trueClass', filters.trueClass);
  if (filters.confusedWith) query.set('confusedWith', filters.confusedWith);
  if (filters.page) query.set('page', String(filters.page));
  if (filters.pageSize) query.set('pageSize', String(filters.pageSize));

  const qs = query.toString();
  return apiFetch(`/api/admin/questions${qs ? `?${qs}` : ''}`);
}

/**
 * Fetch bank review statistics
 * @returns {Promise<{ countsByStatus: any, countsByType: any, countsByPair: any }>}
 */
export async function getBankStats() {
  return apiFetch('/api/admin/questions/stats');
}

/**
 * Fetch single bank question by ID
 * @param {string} id
 * @returns {Promise<any>}
 */
export async function getBankQuestion(id) {
  return apiFetch(`/api/admin/questions/${id}`);
}

/**
 * Approve a question
 * @param {string} id
 * @param {{ note?: string|null }} [body]
 * @returns {Promise<any>}
 */
export async function approveQuestion(id, body = {}) {
  return apiFetch(`/api/admin/questions/${id}/approve`, {
    method: 'POST',
    body,
  });
}

/**
 * Reject a question
 * @param {string} id
 * @param {{ note?: string|null }} [body]
 * @returns {Promise<any>}
 */
export async function rejectQuestion(id, body = {}) {
  return apiFetch(`/api/admin/questions/${id}/reject`, {
    method: 'POST',
    body,
  });
}

/**
 * Edit a question
 * @param {string} id
 * @param {Object} body
 * @returns {Promise<any>}
 */
export async function editQuestion(id, body) {
  return apiFetch(`/api/admin/questions/${id}`, {
    method: 'PUT',
    body,
  });
}
