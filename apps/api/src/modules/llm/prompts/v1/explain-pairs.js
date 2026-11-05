import { z } from 'zod';
import { ExplanationPairSchema } from '@radiology/contracts';

export const EXPLAIN_PAIRS_PROMPT_ID = 'explain-pairs';
export const EXPLAIN_PAIRS_VERSION = 'v1';

/**
 * Output schema for the explain-pairs prompt
 */
export const ExplainPairsOutputSchema = z.array(ExplanationPairSchema);

/**
 * Builds the prompt parameters for pre-generating or fetching diagnostic error pair explanations.
 *
 * @param {Object} options
 * @param {'fa' | 'en'} [options.lang='fa'] - Language code
 * @param {Array<{ trueClass: string, userAnswer: string }>} options.pairs - Confusion pairs
 * @param {Array<{ slug: string, title?: string, content: string }>} options.kbSnippets - Relevant KB snippets
 * @returns {{ promptId: string, version: string, system: string, input: object, schema: z.ZodTypeAny }}
 */
export function buildExplainPairsPrompt({ lang = 'fa', pairs, kbSnippets }) {
  const languageName = lang === 'fa' ? 'Persian (Farsi)' : 'English';

  const system = [
    'You are a teaching assistant for radiology residents using a training tool.',
    `Write in ${languageName}.`,
    'Use ONLY the provided knowledge-base snippets.',
    'Do not invent findings, numbers, percentages or references.',
    'Do not give medical advice or diagnose real patients.',
    'Be concise and concrete.',
    'Each string must be at most 160 characters.',
    'whatToLookFor must contain at most 3 concise bullet points.',
    'Return a valid JSON array matching the schema exactly.',
  ].join(' ');

  return {
    promptId: EXPLAIN_PAIRS_PROMPT_ID,
    version: EXPLAIN_PAIRS_VERSION,
    system,
    input: {
      lang,
      pairs: pairs.map((p) => ({
        trueClass: p.trueClass,
        userAnswer: p.userAnswer,
      })),
      kbSnippets: (kbSnippets || []).map((s) => ({
        slug: s.slug,
        content: s.content,
      })),
    },
    schema: ExplainPairsOutputSchema,
  };
}
