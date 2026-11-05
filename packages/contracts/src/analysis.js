import { z } from 'zod';
import { AnalysisClassSchema, ImageAnalysisResultSchema } from './vocabulary.js';

// ---------------------------------------------------------------------------
// Analysis pipeline contracts (T08a)
// These shapes are shared between the API models and the scripts.
// ---------------------------------------------------------------------------

/**
 * Analysis run identifier — which prompt wording was used
 * @typedef {'A' | 'B'} AnalysisRun
 */
export const ANALYSIS_RUNS = /** @type {const} */ (['A', 'B']);
export const AnalysisRunSchema = z.enum(ANALYSIS_RUNS);

/**
 * Status of a planned analysis batch
 * @typedef {'pending' | 'done' | 'failed'} BatchStatus
 */
export const BATCH_STATUSES = /** @type {const} */ (['pending', 'done', 'failed']);
export const BatchStatusSchema = z.enum(BATCH_STATUSES);

/**
 * Auto-validation status for a single image (after both runs are complete)
 * @typedef {'auto_passed' | 'auto_rejected'} ValidationStatus
 */
export const VALIDATION_STATUSES = /** @type {const} */ (['auto_passed', 'auto_rejected']);
export const ValidationStatusSchema = z.enum(VALIDATION_STATUSES);

/**
 * Reason codes produced by validateAnalysis()
 * @typedef {'RUN_MISSING' | 'SCHEMA_INVALID' | 'QUALITY_NOT_OK' |
 *   'RUNS_DISAGREE' | 'LABEL_MISMATCH' | 'RULE_CLEAR_EXCLUSIVE' |
 *   'RULE_NORMAL_PATTERNS' | 'RULE_DISEASE_NEEDS_PATTERN' |
 *   'NO_CONSENSUS_PATTERN'} ValidationReason
 */
export const VALIDATION_REASONS = /** @type {const} */ ([
  'RUN_MISSING',
  'SCHEMA_INVALID',
  'QUALITY_NOT_OK',
  'RUNS_DISAGREE',
  'LABEL_MISMATCH',
  'RULE_CLEAR_EXCLUSIVE',
  'RULE_NORMAL_PATTERNS',
  'RULE_DISEASE_NEEDS_PATTERN',
  'NO_CONSENSUS_PATTERN',
]);
export const ValidationReasonSchema = z.enum(VALIDATION_REASONS);

// ---------------------------------------------------------------------------
// AnalysisBatch — one planned API call (6 images, run A or B)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} AnalysisBatch
 * @property {string} batchId - Deterministic id e.g. "v1-g07-A"
 * @property {number} group - Group index (0-based)
 * @property {AnalysisRun} run - Which prompt wording
 * @property {string[]} imageIds - Catalog image ids in the order sent to the LLM
 * @property {BatchStatus} status
 * @property {number} attempts - How many times this batch has been tried
 * @property {string | null} lastError - Last error message if any
 * @property {Date | null} requestedAt
 * @property {Date | null} finishedAt
 * @property {string} model - Gemini model id used
 * @property {string} promptVersion - e.g. "v1"
 */
export const AnalysisBatchSchema = z.object({
  batchId: z.string().min(1),
  group: z.number().int().min(0),
  run: AnalysisRunSchema,
  imageIds: z.array(z.string().min(1)).min(1),
  status: BatchStatusSchema,
  attempts: z.number().int().min(0),
  lastError: z.string().nullable(),
  requestedAt: z.date().nullable(),
  finishedAt: z.date().nullable(),
  model: z.string().min(1),
  promptVersion: z.string().min(1),
});

// ---------------------------------------------------------------------------
// ImageAnalysis — one validated per-image result, stored after a done batch
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ImageAnalysis
 * @property {string} imageId - Catalog image id
 * @property {AnalysisRun} run - Which prompt wording produced this result
 * @property {string} promptVersion
 * @property {string} model
 * @property {string} batchId
 * @property {import('./vocabulary.js').ImageAnalysisResult} output - Validated result object
 */
export const ImageAnalysisSchema = z.object({
  imageId: z.string().min(1),
  run: AnalysisRunSchema,
  promptVersion: z.string().min(1),
  model: z.string().min(1),
  batchId: z.string().min(1),
  output: ImageAnalysisResultSchema,
});

// ---------------------------------------------------------------------------
// AnalysisValidation — computed after both runs exist for an image
// ---------------------------------------------------------------------------

/**
 * Consensus fields derived from the intersection of run A and run B
 * @typedef {Object} AnalysisConsensus
 * @property {import('./vocabulary.js').Pattern[]} patterns - Intersection of A and B patterns
 * @property {import('./vocabulary.js').Distribution | null} distribution - Value if A==B, else null
 * @property {import('./vocabulary.js').Laterality | null} laterality - Value if A==B, else null
 * @property {import('./vocabulary.js').Zone[]} zones - Intersection of A and B zones
 */
export const AnalysisConsensusSchema = z.object({
  patterns: z.array(z.string()),
  distribution: z.string().nullable(),
  laterality: z.string().nullable(),
  zones: z.array(z.string()),
});

/**
 * @typedef {Object} AnalysisValidation
 * @property {string} imageId
 * @property {string} promptVersion
 * @property {ValidationStatus} status
 * @property {ValidationReason[]} reasons
 * @property {AnalysisConsensus} consensus
 * @property {import('./vocabulary.js').AnalysisClass} datasetLabel
 * @property {Date} validatedAt
 */
export const AnalysisValidationSchema = z.object({
  imageId: z.string().min(1),
  promptVersion: z.string().min(1),
  status: ValidationStatusSchema,
  reasons: z.array(ValidationReasonSchema),
  consensus: AnalysisConsensusSchema,
  datasetLabel: AnalysisClassSchema,
  validatedAt: z.date(),
});
