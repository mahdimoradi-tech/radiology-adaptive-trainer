import { z } from 'zod';
import { ClassIdSchema } from './engine.js';

/**
 * Supported execution modes for the LLM subsystem
 * @typedef {'live' | 'cache-only' | 'fake'} LlmMode
 */
export const LLM_MODES = /** @type {const} */ (['live', 'cache-only', 'fake']);
export const LlmModeSchema = z.enum(LLM_MODES);

/**
 * Supported languages for LLM content
 * @typedef {'fa' | 'en'} Lang
 */
export const LANGS = /** @type {const} */ (['fa', 'en']);
export const LangSchema = z.enum(LANGS);

/**
 * Source provenance of LLM response
 * @typedef {'llm' | 'cache' | 'fallback'} LlmSource
 */
export const LLM_SOURCES = /** @type {const} */ (['llm', 'cache', 'fallback']);
export const LlmSourceSchema = z.enum(LLM_SOURCES);

/**
 * Reusable explanation content for a confusion pair (trueClass, userAnswer)
 * @typedef {Object} ExplanationPair
 * @property {import('./engine.js').ClassId} trueClass
 * @property {import('./engine.js').ClassId} userAnswer
 * @property {string[]} whatToLookFor
 * @property {string} whyConfused
 * @property {string} tip
 */
export const ExplanationPairSchema = z.object({
  trueClass: ClassIdSchema,
  userAnswer: ClassIdSchema,
  whatToLookFor: z.array(z.string().max(160)).max(3),
  whyConfused: z.string().max(160),
  tip: z.string().max(160),
});

/**
 * Explanation item attached to a specific question number in a session
 * @typedef {Object} ExplanationItem
 * @property {number} no
 * @property {import('./engine.js').ClassId} trueClass
 * @property {import('./engine.js').ClassId} userAnswer
 * @property {string[]} whatToLookFor
 * @property {string} whyConfused
 * @property {string} tip
 */
export const ExplanationItemSchema = ExplanationPairSchema.extend({
  no: z.number().int().min(1),
});

/**
 * Response schema for session error explanations
 * @typedef {Object} ExplanationsResponse
 * @property {LlmSource} source
 * @property {boolean} reviewed
 * @property {ExplanationItem[]} items
 */
export const ExplanationsResponseSchema = z.object({
  source: LlmSourceSchema,
  reviewed: z.boolean(),
  items: z.array(ExplanationItemSchema),
});

/**
 * Structured session narrative content
 * @typedef {Object} Narrative
 * @property {string} overview
 * @property {string[]} strengths
 * @property {string[]} weaknesses
 * @property {string[]} patterns
 * @property {string[]} recommendations
 */
export const NarrativeSchema = z.object({
  overview: z.string().max(400),
  strengths: z.array(z.string().max(160)).max(3),
  weaknesses: z.array(z.string().max(160)).max(3),
  patterns: z.array(z.string().max(160)).max(3),
  recommendations: z.array(z.string().max(160)).length(3),
});

/**
 * Response schema for session report narrative
 * @typedef {Object} NarrativeResponse
 * @property {LlmSource} source
 * @property {boolean} reviewed
 * @property {Narrative} narrative
 */
export const NarrativeResponseSchema = z.object({
  source: LlmSourceSchema,
  reviewed: z.boolean().default(false),
  narrative: NarrativeSchema,
});

/**
 * Request body for LLM endpoints
 * @typedef {Object} LlmRequestBody
 * @property {Lang} [lang]
 */
export const LlmRequestBodySchema = z.object({
  lang: LangSchema.default('fa'),
});

export const ExplanationsBodySchema = LlmRequestBodySchema;
export const NarrativeBodySchema = LlmRequestBodySchema;

/**
 * Admin LLM status schema
 * @typedef {Object} AdminLlmStatus
 * @property {LlmMode} mode
 * @property {string} model
 * @property {{ count: number, budget: number, exhausted: boolean, lastCallAt?: string | null }} today
 * @property {{ totalEntries: number }} cache
 */
export const AdminLlmStatusSchema = z.object({
  mode: LlmModeSchema,
  model: z.string(),
  today: z.object({
    count: z.number().int().min(0),
    budget: z.number().int().min(0),
    exhausted: z.boolean(),
    lastCallAt: z.string().nullable().optional(),
  }),
  cache: z.object({
    totalEntries: z.number().int().min(0),
  }),
});
