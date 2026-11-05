import { NarrativeSchema } from '@radiology/contracts';

export const NARRATIVE_PROMPT_ID = 'narrative';
export const NARRATIVE_VERSION = 'v1';

/**
 * Builds the prompt parameters for generating a pedagogical narrative for a completed session.
 *
 * @param {Object} options
 * @param {'fa' | 'en'} [options.lang='fa'] - Language code
 * @param {number} options.sessionIndex - Index of the session (e.g. 1, 2)
 * @param {Object} options.stats - Sanitized integer statistics (percentages rounded to integers)
 * @param {Array<{ slug: string, title?: string, content: string }>} options.kbSnippets - Relevant KB snippets
 * @returns {{ promptId: string, version: string, system: string, input: object, schema: typeof NarrativeSchema }}
 */
export function buildNarrativePrompt({ lang = 'fa', sessionIndex, stats, kbSnippets }) {
  const languageName = lang === 'fa' ? 'Persian (Farsi)' : 'English';
  const sessionLabel = `S${sessionIndex}`;

  const system = [
    'You are a teaching assistant for radiology residents using a training tool.',
    `Write in ${languageName}.`,
    'Use ONLY the provided statistics and knowledge-base snippets.',
    'Do NOT invent findings, numbers, percentages or references.',
    'Do NOT use the "%" symbol or any unstated numbers; refer to percentages using the provided integer values.',
    'Do not give medical advice or diagnose real patients.',
    'Be concise, constructive and concrete.',
    'Length limits:',
    '- overview: maximum 400 characters.',
    '- strengths: at most 3 items, each maximum 160 characters.',
    '- weaknesses: at most 3 items, each maximum 160 characters.',
    '- patterns: at most 3 items, each maximum 160 characters.',
    '- recommendations: EXACTLY 3 items, each maximum 160 characters.',
    'Return a valid JSON object matching the schema exactly.',
  ].join(' ');

  return {
    promptId: NARRATIVE_PROMPT_ID,
    version: NARRATIVE_VERSION,
    system,
    input: {
      lang,
      sessionLabel,
      stats,
      kbSnippets: (kbSnippets || []).map((s) => ({
        slug: s.slug,
        content: s.content,
      })),
    },
    schema: NarrativeSchema,
  };
}
