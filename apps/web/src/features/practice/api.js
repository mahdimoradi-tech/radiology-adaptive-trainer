import { apiFetch } from '../../lib/api.js';

/**
 * Fetch paginated list of resident's practice sets
 *
 * @param {Object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.pageSize=20]
 * @returns {Promise<{ items: import('@radiology/contracts').PracticeSummary[], meta: { total: number, page: number, pageSize: number, totalPages: number } }>}
 */
export async function getPracticeSets({ page = 1, pageSize = 20 } = {}) {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const res = await apiFetch(`/api/practice?${query.toString()}`);
  return {
    items: res?.data ?? [],
    meta: res?.meta ?? { total: 0, page, pageSize, totalPages: 1 },
  };
}

/**
 * Fetch a single practice set by ID
 *
 * @param {string} setId
 * @returns {Promise<import('@radiology/contracts').PracticeSetResident>}
 */
export async function getPracticeSet(setId) {
  const res = await apiFetch(`/api/practice/${setId}`);
  return res?.data;
}

/**
 * Create a new targeted practice set
 *
 * @param {Object} [params]
 * @param {number} [params.size=10]
 * @returns {Promise<import('@radiology/contracts').PracticeSetResident>}
 */
export async function createPracticeSet({ size = 10 } = {}) {
  const res = await apiFetch('/api/practice', {
    method: 'POST',
    body: { size },
  });
  return res?.data;
}

/**
 * Submit an answer for a specific question in a practice set
 *
 * @param {Object} params
 * @param {string} params.setId
 * @param {number} params.questionNo
 * @param {number} params.selectedIndex
 * @param {number} [params.timeMs]
 * @returns {Promise<import('@radiology/contracts').PracticeAnswerResponse>}
 */
export async function answerPracticeQuestion({ setId, questionNo, selectedIndex, timeMs }) {
  const res = await apiFetch(`/api/practice/${setId}/questions/${questionNo}/answer`, {
    method: 'PUT',
    body: { selectedIndex, timeMs },
  });
  return res?.data;
}
