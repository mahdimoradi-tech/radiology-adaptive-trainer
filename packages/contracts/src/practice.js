import { z } from 'zod';
import { QuestionTypeSchema } from './questionBank.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Standard number of multiple choice options for practice questions
 */
export const PRACTICE_OPTION_COUNT = 4;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * Request payload to create a new targeted practice set
 * @typedef {Object} PracticeCreateRequest
 * @property {number} [size=10] - Number of questions in set (5..20)
 */
export const PracticeCreateRequestSchema = z
  .object({
    size: z.number().int().min(5).max(20).default(10),
  })
  .strict();

/**
 * Resident view of an answered practice question's evaluation
 * Strictly prevents leaking trueClass, bucket, confusedWith, or model metadata
 * @typedef {Object} PracticeQuestionAnswerResident
 * @property {number} selectedIndex
 * @property {boolean} correct
 * @property {number} correctIndex
 * @property {string} rationale
 */
export const PracticeQuestionAnswerResidentSchema = z
  .object({
    selectedIndex: z
      .number()
      .int()
      .min(0)
      .max(PRACTICE_OPTION_COUNT - 1),
    correct: z.boolean(),
    correctIndex: z
      .number()
      .int()
      .min(0)
      .max(PRACTICE_OPTION_COUNT - 1),
    rationale: z.string().min(1),
  })
  .strict();

/**
 * Resident view of a practice question (Zero label leakage)
 * Only opaque images and shuffled options without diagnostic metadata
 * @typedef {Object} PracticeQuestionResident
 * @property {number} no
 * @property {import('./questionBank.js').QuestionType} type
 * @property {string} stem
 * @property {string[]} options
 * @property {string} imageUrl
 * @property {boolean} answered
 * @property {PracticeQuestionAnswerResident} [answer]
 */
export const PracticeQuestionResidentSchema = z
  .object({
    no: z.number().int().min(1),
    type: QuestionTypeSchema,
    stem: z.string().min(1),
    options: z.array(z.string().min(1)).length(PRACTICE_OPTION_COUNT),
    imageUrl: z.string().min(1),
    answered: z.boolean(),
    answer: PracticeQuestionAnswerResidentSchema.optional(),
  })
  .strict();

/**
 * Resident view of a full targeted practice set
 * @typedef {Object} PracticeSetResident
 * @property {string} id
 * @property {'in_progress' | 'completed'} status
 * @property {number} size
 * @property {number} answeredCount
 * @property {number} correctCount
 * @property {string | Date} createdAt
 * @property {string | Date | null} [completedAt]
 * @property {PracticeQuestionResident[]} questions
 */
export const PracticeSetResidentSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum(['in_progress', 'completed']),
    size: z.number().int().min(1),
    answeredCount: z.number().int().min(0),
    correctCount: z.number().int().min(0),
    createdAt: z.string().datetime().or(z.date()),
    completedAt: z.string().datetime().or(z.date()).nullable().optional(),
    questions: z.array(PracticeQuestionResidentSchema),
  })
  .strict();

/**
 * Request payload when answering a single practice question
 * @typedef {Object} PracticeAnswerRequest
 * @property {number} selectedIndex - Option index chosen by resident (in shuffled order)
 * @property {number} [timeMs] - Response duration in milliseconds
 */
export const PracticeAnswerRequestSchema = z
  .object({
    selectedIndex: z
      .number()
      .int()
      .min(0)
      .max(PRACTICE_OPTION_COUNT - 1),
    timeMs: z.number().int().min(0).max(600000).optional(),
  })
  .strict();

/**
 * Immediate feedback returned to resident upon answering a question
 * @typedef {Object} PracticeAnswerResponse
 * @property {boolean} correct - Whether selected index matches the correct option
 * @property {number} correctIndex - The correct option index (in current shuffled order)
 * @property {string} rationale - Instructor-approved educational explanation
 * @property {boolean} completed - Whether this answer completes the entire set
 */
export const PracticeAnswerResponseSchema = z
  .object({
    correct: z.boolean(),
    correctIndex: z
      .number()
      .int()
      .min(0)
      .max(PRACTICE_OPTION_COUNT - 1),
    rationale: z.string().min(1),
    completed: z.boolean(),
  })
  .strict();

/**
 * Summary view of a practice set for lists and histories
 * @typedef {Object} PracticeSummary
 * @property {string} id
 * @property {'in_progress' | 'completed'} status
 * @property {number} size
 * @property {number} answeredCount
 * @property {number} correctCount
 * @property {string | Date} createdAt
 * @property {string | Date | null} [completedAt]
 */
export const PracticeSummarySchema = z
  .object({
    id: z.string().min(1),
    status: z.enum(['in_progress', 'completed']),
    size: z.number().int().min(1),
    answeredCount: z.number().int().min(0),
    correctCount: z.number().int().min(0),
    createdAt: z.string().datetime().or(z.date()),
    completedAt: z.string().datetime().or(z.date()).nullable().optional(),
  })
  .strict();
