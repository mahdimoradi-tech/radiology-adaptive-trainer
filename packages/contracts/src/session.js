import { z } from 'zod';
import { ClassIdSchema, BucketSchema } from './engine.js';

/**
 * Session training kind
 * @typedef {'baseline' | 'adaptive'} SessionKind
 */
export const SESSION_KINDS = /** @type {const} */ (['baseline', 'adaptive']);
export const SessionKindSchema = z.enum(SESSION_KINDS);

/**
 * Session lifecycle status
 * @typedef {'in_progress' | 'finished'} SessionStatus
 */
export const SESSION_STATUSES = /** @type {const} */ (['in_progress', 'finished']);
export const SessionStatusSchema = z.enum(SESSION_STATUSES);

/**
 * Body schema for session creation
 * @typedef {Object} CreateSessionBody
 * @property {number} [size=60]
 */
export const CreateSessionBodySchema = z.object({
  size: z.coerce
    .number()
    .int()
    .min(45, 'size must be at least 45')
    .max(120, 'size must not exceed 120')
    .default(60),
});

/**
 * Body schema for answering a question
 * @typedef {Object} AnswerBody
 * @property {import('./engine.js').ClassId} answer
 * @property {number} [timeMs]
 */
export const AnswerBodySchema = z.object({
  answer: ClassIdSchema,
  timeMs: z.number().int().min(0).max(600000).optional(),
});

/**
 * Public question item exposed to resident during a session
 * (Labels, bucket, difficulty and internal IDs are strictly withheld)
 * @typedef {Object} QuestionPublic
 * @property {number} no
 * @property {string} imageUrl
 * @property {boolean} answered
 * @property {import('./engine.js').ClassId | null} answer
 */
export const QuestionPublicSchema = z.object({
  no: z.number().int().min(1),
  imageUrl: z.string().min(1),
  answered: z.boolean(),
  answer: ClassIdSchema.nullable(),
});

/**
 * Public full session projection
 * @typedef {Object} SessionPublic
 * @property {string} id
 * @property {number} index
 * @property {SessionKind} kind
 * @property {SessionStatus} status
 * @property {number} size
 * @property {string | Date} startedAt
 * @property {string | Date | null} finishedAt
 * @property {number} answeredCount
 * @property {QuestionPublic[]} questions
 */
export const SessionPublicSchema = z.object({
  id: z.string().min(1),
  index: z.number().int().min(1),
  kind: SessionKindSchema,
  status: SessionStatusSchema,
  size: z.number().int().min(45),
  startedAt: z.union([z.string(), z.date()]),
  finishedAt: z.union([z.string(), z.date()]).nullable(),
  answeredCount: z.number().int().min(0),
  questions: z.array(QuestionPublicSchema),
});

/**
 * Compact session summary schema for listings
 * @typedef {Object} SessionSummary
 * @property {string} id
 * @property {number} index
 * @property {SessionKind} kind
 * @property {SessionStatus} status
 * @property {number} size
 * @property {string | Date} startedAt
 * @property {string | Date | null} finishedAt
 * @property {number} answeredCount
 * @property {number | null} overallAccuracy
 */
export const SessionSummarySchema = z.object({
  id: z.string().min(1),
  index: z.number().int().min(1),
  kind: SessionKindSchema,
  status: SessionStatusSchema,
  size: z.number().int().min(45),
  startedAt: z.union([z.string(), z.date()]),
  finishedAt: z.union([z.string(), z.date()]).nullable(),
  answeredCount: z.number().int().min(0),
  overallAccuracy: z.number().min(0).max(1).nullable(),
});

/**
 * Raw unsmoothed one-vs-rest metrics for a disease class
 * @typedef {Object} ClassMetrics
 * @property {number} tp
 * @property {number} fp
 * @property {number} fn
 * @property {number} tn
 * @property {number} accuracy
 * @property {number} precision
 * @property {number} recall
 * @property {number} f1
 * @property {number} fpr
 * @property {number} fnr
 */
export const ClassMetricsSchema = z.object({
  tp: z.number().int().min(0),
  fp: z.number().int().min(0),
  fn: z.number().int().min(0),
  tn: z.number().int().min(0),
  accuracy: z.number().min(0).max(1),
  precision: z.number().min(0).max(1),
  recall: z.number().min(0).max(1),
  f1: z.number().min(0).max(1),
  fpr: z.number().min(0).max(1),
  fnr: z.number().min(0).max(1),
});

/**
 * Detailed review item for finished session report
 * @typedef {Object} ReportItem
 * @property {number} no
 * @property {string} imageUrl
 * @property {import('./engine.js').ClassId} trueClass
 * @property {import('./engine.js').ClassId | null} answer
 * @property {boolean | null} correct
 * @property {import('./engine.js').Bucket} bucket
 * @property {number} difficulty
 */
export const ReportItemSchema = z.object({
  no: z.number().int().min(1),
  imageUrl: z.string().min(1),
  trueClass: ClassIdSchema,
  answer: ClassIdSchema.nullable(),
  correct: z.boolean().nullable(),
  bucket: BucketSchema,
  difficulty: z.number().min(0).max(1),
});

/**
 * Shortfall item recording catalog deficit during question allocation
 * @typedef {Object} PlanShortfall
 * @property {import('./engine.js').ClassId} classId
 * @property {import('./engine.js').Bucket} bucket
 * @property {number} requested
 * @property {number} available
 * @property {number} shortfall
 */
export const PlanShortfallSchema = z.object({
  classId: ClassIdSchema,
  bucket: BucketSchema,
  requested: z.number().int().min(0),
  available: z.number().int().min(0),
  shortfall: z.number().int().min(0),
});

/**
 * Engine planning snapshot attached to session report
 * @typedef {Object} EnginePlanSnapshot
 * @property {Record<import('./engine.js').ClassId, number>} classCounts
 * @property {Record<import('./engine.js').ClassId, Record<import('./engine.js').Bucket, number>>} bucketCounts
 * @property {Record<import('./engine.js').ClassId, number>} weights
 * @property {Record<import('./engine.js').ClassId, unknown> | null} errors
 * @property {PlanShortfall[]} shortfalls
 * @property {number} deficit
 */
export const EnginePlanSnapshotSchema = z.object({
  classCounts: z.record(ClassIdSchema, z.number().int().min(0)),
  bucketCounts: z.record(ClassIdSchema, z.record(BucketSchema, z.number().int().min(0))),
  weights: z.record(ClassIdSchema, z.number().min(0).max(1)),
  errors: z.record(ClassIdSchema, z.unknown()).nullable(),
  shortfalls: z.array(PlanShortfallSchema),
  deficit: z.number().int().min(0),
});

/**
 * Overall accuracy summary
 * @typedef {Object} OverallMetrics
 * @property {number} correct
 * @property {number} total
 * @property {number} accuracy
 */
export const OverallMetricsSchema = z.object({
  correct: z.number().int().min(0),
  total: z.number().int().min(0),
  accuracy: z.number().min(0).max(1),
});

/**
 * Session report schema generated upon completion
 * @typedef {Object} SessionReport
 * @property {string} sessionId
 * @property {number} index
 * @property {SessionKind} kind
 * @property {number} size
 * @property {number} answeredCount
 * @property {number} unansweredCount
 * @property {OverallMetrics} overall
 * @property {Record<import('./engine.js').ClassId, Record<import('./engine.js').ClassId, number>>} confusion
 * @property {Record<import('./engine.js').ClassId, ClassMetrics>} perClass
 * @property {Record<import('./engine.js').ClassId, Record<import('./engine.js').Bucket, { correct: number, incorrect: number }>>} byClassBucket
 * @property {boolean} mastered
 * @property {Record<import('./engine.js').ClassId, boolean>} perClassMastered
 * @property {EnginePlanSnapshot} plan
 * @property {ReportItem[]} review
 */
export const SessionReportSchema = z.object({
  sessionId: z.string().min(1),
  index: z.number().int().min(1),
  kind: SessionKindSchema,
  size: z.number().int().min(45),
  answeredCount: z.number().int().min(0),
  unansweredCount: z.number().int().min(0),
  overall: OverallMetricsSchema,
  confusion: z.record(ClassIdSchema, z.record(ClassIdSchema, z.number().int().min(0))),
  perClass: z.record(ClassIdSchema, ClassMetricsSchema),
  byClassBucket: z.record(
    ClassIdSchema,
    z.record(
      BucketSchema,
      z.object({
        correct: z.number().int().min(0),
        incorrect: z.number().int().min(0),
      }),
    ),
  ),
  mastered: z.boolean(),
  perClassMastered: z.record(ClassIdSchema, z.boolean()),
  plan: EnginePlanSnapshotSchema,
  review: z.array(ReportItemSchema),
});

/**
 * Historic session point in progress trajectory
 * @typedef {Object} ProgressSessionPoint
 * @property {string} id
 * @property {number} index
 * @property {SessionKind} kind
 * @property {string | Date} finishedAt
 * @property {number} overallAccuracy
 * @property {Record<import('./engine.js').ClassId, { accuracy: number, fpr: number, fnr: number }>} perClass
 * @property {boolean} mastered
 */
export const ProgressSessionPointSchema = z.object({
  id: z.string().min(1),
  index: z.number().int().min(1),
  kind: SessionKindSchema,
  finishedAt: z.union([z.string(), z.date()]),
  overallAccuracy: z.number().min(0).max(1),
  perClass: z.record(
    ClassIdSchema,
    z.object({
      accuracy: z.number().min(0).max(1),
      fpr: z.number().min(0).max(1),
      fnr: z.number().min(0).max(1),
    }),
  ),
  mastered: z.boolean(),
});

/**
 * Top confused class pair in progress analysis
 * @typedef {Object} TopConfusion
 * @property {import('./engine.js').ClassId} trueClass
 * @property {import('./engine.js').ClassId} predicted
 * @property {number} count
 */
export const TopConfusionSchema = z.object({
  trueClass: ClassIdSchema,
  predicted: ClassIdSchema,
  count: z.number().int().min(0),
});

/**
 * Complete resident progress trajectory schema
 * @typedef {Object} Progress
 * @property {ProgressSessionPoint[]} sessions
 * @property {Record<import('./engine.js').ClassId, number>} currentWeights
 * @property {Record<import('./engine.js').ClassId, unknown> | null} currentErrors
 * @property {TopConfusion[]} topConfusions
 * @property {{ sessionsFinished: number, answered: number }} totals
 */
export const ProgressSchema = z.object({
  sessions: z.array(ProgressSessionPointSchema),
  currentWeights: z.record(ClassIdSchema, z.number().min(0).max(1)),
  currentErrors: z.record(ClassIdSchema, z.unknown()).nullable(),
  topConfusions: z.array(TopConfusionSchema),
  totals: z.object({
    sessionsFinished: z.number().int().min(0),
    answered: z.number().int().min(0),
  }),
});

/**
 * Resident summary in instructor resident list
 * @typedef {Object} AdminResidentSummary
 * @property {string} id
 * @property {string} email
 * @property {string} displayName
 * @property {number} sessionsFinished
 * @property {number | null} lastAccuracy
 * @property {string | Date | null} lastActiveAt
 * @property {string | Date} createdAt
 */
export const AdminResidentSummarySchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  sessionsFinished: z.number().int().min(0),
  lastAccuracy: z.number().min(0).max(1).nullable(),
  lastActiveAt: z.union([z.string(), z.date()]).nullable(),
  createdAt: z.union([z.string(), z.date()]),
});
