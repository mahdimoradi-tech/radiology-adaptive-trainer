import { apiFetch } from '../../lib/api.js';

/**
 * Fetch explanations for wrong answers in a finished session
 * @param {string} sessionId
 * @param {Object} [options]
 * @param {'fa'|'en'} [options.lang='fa']
 * @returns {Promise<import('@radiology/contracts').ExplanationsResponse>}
 */
export async function getSessionExplanations(sessionId, { lang = 'fa' } = {}) {
  const res = await apiFetch(`/api/sessions/${sessionId}/explanations`, {
    method: 'POST',
    body: { lang },
  });
  return res?.data ?? res;
}

/**
 * Fetch pedagogical narrative report for a finished session
 * @param {string} sessionId
 * @param {Object} [options]
 * @param {'fa'|'en'} [options.lang='fa']
 * @returns {Promise<import('@radiology/contracts').NarrativeResponse>}
 */
export async function getSessionNarrative(sessionId, { lang = 'fa' } = {}) {
  const res = await apiFetch(`/api/sessions/${sessionId}/report-narrative`, {
    method: 'POST',
    body: { lang },
  });
  return res?.data ?? res;
}

/**
 * Fetch instructor LLM system status
 * @returns {Promise<import('@radiology/contracts').AdminLlmStatus>}
 */
export async function getAdminLlmStatus() {
  const res = await apiFetch('/api/admin/llm/status');
  return res?.data ?? res;
}
