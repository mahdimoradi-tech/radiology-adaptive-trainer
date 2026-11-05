import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getSessionExplanations, getSessionNarrative, getAdminLlmStatus } from './api.js';

export const llmKeys = {
  all: ['llm'],
  explanations: (sessionId, lang) => ['sessions', sessionId, 'explanations', lang],
  narrative: (sessionId, lang) => ['sessions', sessionId, 'narrative', lang],
  adminStatus: ['admin', 'llm-status'],
};

/**
 * Hook to retrieve error explanations for a finished session.
 * @param {string} sessionId
 * @param {Object} [options]
 * @param {boolean} [options.enabled=true]
 */
export function useSessionExplanations(sessionId, { enabled = true } = {}) {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fa';

  return useQuery({
    queryKey: llmKeys.explanations(sessionId, lang),
    queryFn: () => getSessionExplanations(sessionId, { lang }),
    enabled: Boolean(sessionId) && enabled,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 1000 * 60 * 30, // 30 minutes
    retry: 1,
  });
}

/**
 * Hook to retrieve the pedagogical report narrative for a finished session.
 * @param {string} sessionId
 * @param {Object} [options]
 * @param {boolean} [options.enabled=true]
 */
export function useSessionNarrative(sessionId, { enabled = true } = {}) {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fa';

  return useQuery({
    queryKey: llmKeys.narrative(sessionId, lang),
    queryFn: () => getSessionNarrative(sessionId, { lang }),
    enabled: Boolean(sessionId) && enabled,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 1000 * 60 * 30,
    retry: 1,
  });
}

/**
 * Hook to retrieve instructor administrative LLM budget status.
 */
export function useAdminLlmStatus() {
  return useQuery({
    queryKey: llmKeys.adminStatus,
    queryFn: getAdminLlmStatus,
    staleTime: 1000 * 15, // 15 seconds
  });
}
