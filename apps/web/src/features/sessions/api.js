import { apiFetch } from '../../lib/api.js';

/**
 * Fetch paginated list of resident's sessions
 * @param {Object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.pageSize=20]
 * @returns {Promise<{ items: import('@radiology/contracts').SessionSummary[], meta: { total: number, page: number, pageSize: number, totalPages: number } }>}
 */
export async function getSessions({ page = 1, pageSize = 20 } = {}) {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const res = await apiFetch(`/api/sessions?${query.toString()}`);
  return {
    items: res?.data ?? [],
    meta: res?.meta ?? { total: 0, page, pageSize, totalPages: 1 },
  };
}

/**
 * Fetch a single session by its ID
 * @param {string} sessionId
 * @returns {Promise<import('@radiology/contracts').SessionPublic>}
 */
export async function getSession(sessionId) {
  const res = await apiFetch(`/api/sessions/${sessionId}`);
  return res?.data;
}

/**
 * Create a new training session (baseline or adaptive)
 * @param {Object} [params]
 * @param {number} [params.size=60]
 * @returns {Promise<import('@radiology/contracts').SessionPublic>}
 */
export async function createSession({ size = 60 } = {}) {
  const res = await apiFetch('/api/sessions', {
    method: 'POST',
    body: { size },
  });
  return res?.data;
}

/**
 * Record an answer for a specific question in an active session
 * @param {string} sessionId
 * @param {number} questionNo
 * @param {Object} payload
 * @param {import('@radiology/contracts').ClassId} payload.answer
 * @param {number} [payload.timeMs]
 * @returns {Promise<{ no: number, answered: boolean, answer: import('@radiology/contracts').ClassId }>}
 */
export async function answerQuestion(sessionId, questionNo, { answer, timeMs }) {
  const res = await apiFetch(`/api/sessions/${sessionId}/questions/${questionNo}/answer`, {
    method: 'PUT',
    body: { answer, ...(timeMs !== undefined ? { timeMs } : {}) },
  });
  return res?.data;
}

/**
 * Finish a session and compute evaluation metrics
 * @param {string} sessionId
 * @returns {Promise<import('@radiology/contracts').SessionReport>}
 */
export async function finishSession(sessionId) {
  const res = await apiFetch(`/api/sessions/${sessionId}/finish`, {
    method: 'POST',
  });
  return res?.data;
}

/**
 * Fetch report for a finished session
 * @param {string} sessionId
 * @returns {Promise<import('@radiology/contracts').SessionReport>}
 */
export async function getSessionReport(sessionId) {
  const res = await apiFetch(`/api/sessions/${sessionId}/report`);
  return res?.data;
}
