import { z } from 'zod';
import { ClassIdSchema, BucketSchema } from './engine.js';

// ---------------------------------------------------------------------------
// Question Bank Contracts (T08b)
// ---------------------------------------------------------------------------

/**
 * Question types generated for chest X-ray training
 * @typedef {'finding' | 'distribution' | 'differential'} QuestionType
 */
export const QUESTION_TYPES = /** @type {const} */ (['finding', 'distribution', 'differential']);
export const QuestionTypeSchema = z.enum(QUESTION_TYPES);

/**
 * Lifecycle review statuses for questions in the question bank
 * @typedef {'pending_review' | 'approved' | 'rejected'} QuestionStatus
 */
export const QUESTION_STATUSES = /** @type {const} */ (['pending_review', 'approved', 'rejected']);
export const QuestionStatusSchema = z.enum(QUESTION_STATUSES);

/**
 * Single option in a 4-choice question.
 * For 'finding' and 'distribution', 'key' ties the option to a closed vocabulary term.
 * For 'differential', 'key' is null and justification comes from the KB reference.
 * @typedef {Object} QuestionOption
 * @property {string} text - Persian localized option text
 * @property {string|null} key - Vocabulary term or null
 */
export const QuestionOptionSchema = z.object({
  text: z.string().min(1),
  key: z.string().min(1).nullable(),
});

/**
 * Generated question candidate emitted by the LLM
 * @typedef {Object} GeneratedQuestion
 * @property {QuestionType} type
 * @property {string} stem
 * @property {QuestionOption[]} options
 * @property {number} correctIndex - 0..3
 * @property {string} rationale - Max 300 chars
 * @property {string|null} kbRef - Knowledge base slug if differential, otherwise null
 * @property {string[]} tags
 */
export const GeneratedQuestionSchema = z.object({
  type: QuestionTypeSchema,
  stem: z.string().min(1),
  options: z.array(QuestionOptionSchema).length(4),
  correctIndex: z.number().int().min(0).max(3),
  rationale: z.string().min(1).max(300),
  kbRef: z.string().min(1).nullable().default(null),
  tags: z.array(z.string()).default([]),
});

/**
 * Structured output schema returned by the LLM in generation batch requests
 * One request covers up to 8 images
 */
export const GenerationOutputSchema = z.object({
  items: z.array(
    z.object({
      imageIndex: z.number().int().min(0),
      questions: z.array(GeneratedQuestionSchema),
    }),
  ),
});

/**
 * Change audit record appended on creation, approval, rejection, or edit
 */
export const QuestionBankHistoryEntrySchema = z.object({
  action: z.enum(['created', 'approved', 'rejected', 'edited']),
  by: z.string().min(1),
  at: z.string().datetime().or(z.date()),
  fromStatus: QuestionStatusSchema.optional(),
  toStatus: QuestionStatusSchema.optional(),
  changes: z
    .record(
      z.object({
        before: z.unknown(),
        after: z.unknown(),
      }),
    )
    .optional(),
  note: z.string().nullable().optional(),
});

/**
 * Summary of validated image analysis attached to admin question view
 */
export const QuestionBankAnalysisSummarySchema = z.object({
  consensus: z
    .object({
      patterns: z.array(z.string()).default([]),
      distribution: z.string().nullable().default(null),
      laterality: z.string().nullable().default(null),
      zones: z.array(z.string()).default([]),
    })
    .optional(),
  certaintyA: z.string().optional(),
  certaintyB: z.string().optional(),
});

/**
 * Provenance metadata tracking the generation origin
 */
export const QuestionBankSourceSchema = z.object({
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  analysisIds: z.array(z.string()).default([]),
});

/**
 * Full admin view schema for a question in the bank
 */
export const QuestionBankAdminSchema = z.object({
  id: z.string().min(1),
  stableId: z.string().min(1),
  imageId: z.string().min(1),
  type: QuestionTypeSchema,
  pair: z.object({
    trueClass: ClassIdSchema,
    confusedWith: ClassIdSchema,
  }),
  bucket: BucketSchema,
  stem: z.string().min(1),
  options: z.array(QuestionOptionSchema).length(4),
  correctIndex: z.number().int().min(0).max(3),
  rationale: z.string().min(1).max(300),
  kbRef: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  status: QuestionStatusSchema,
  edited: z.boolean().default(false),
  source: QuestionBankSourceSchema,
  reviewedBy: z.string().nullable().default(null),
  reviewedAt: z.string().datetime().or(z.date()).nullable().default(null),
  note: z.string().nullable().default(null),
  history: z.array(QuestionBankHistoryEntrySchema).default([]),
  imageUrl: z.string().min(1).optional(),
  analysisSummary: QuestionBankAnalysisSummarySchema.optional(),
  createdAt: z.string().datetime().or(z.date()).optional(),
  updatedAt: z.string().datetime().or(z.date()).optional(),
});

/**
 * Aggregated statistics counts for instructor review panel
 */
export const QuestionBankStatsSchema = z.object({
  countsByStatus: z.object({
    pending_review: z.number().int().min(0),
    approved: z.number().int().min(0),
    rejected: z.number().int().min(0),
    total: z.number().int().min(0),
  }),
  countsByType: z.object({
    finding: z.number().int().min(0),
    distribution: z.number().int().min(0),
    differential: z.number().int().min(0),
  }),
  countsByPair: z.record(z.string(), z.number().int().min(0)),
});

// ---------------------------------------------------------------------------
// Action request bodies
// ---------------------------------------------------------------------------

export const ApproveQuestionBodySchema = z.object({
  note: z.string().max(500).nullable().optional(),
});

export const RejectQuestionBodySchema = z.object({
  note: z.string().max(500).nullable().optional(),
});

export const EditQuestionOptionInputSchema = z.object({
  text: z.string().min(1),
});

export const EditQuestionBodySchema = z.object({
  stem: z.string().min(1),
  options: z.array(EditQuestionOptionInputSchema).length(4),
  correctIndex: z.number().int().min(0).max(3),
  rationale: z.string().min(1).max(300),
  note: z.string().max(500).nullable().optional(),
});

// ---------------------------------------------------------------------------
// Query and List Response
// ---------------------------------------------------------------------------

export const QuestionBankQuerySchema = z.object({
  status: QuestionStatusSchema.optional(),
  type: QuestionTypeSchema.optional(),
  trueClass: ClassIdSchema.optional(),
  confusedWith: ClassIdSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const QuestionBankListResponseSchema = z.object({
  items: z.array(QuestionBankAdminSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalPages: z.number().int().min(0),
});

// ---------------------------------------------------------------------------
// Generation Attempt Record (for rejection tracking / T10)
// ---------------------------------------------------------------------------

export const QuestionGenAttemptSchema = z.object({
  imageId: z.string().min(1),
  promptVersion: z.string().min(1),
  type: QuestionTypeSchema.optional(),
  candidate: z.record(z.unknown()).optional(),
  reasons: z.array(z.string()).min(1),
  createdAt: z.string().datetime().or(z.date()).optional(),
});
