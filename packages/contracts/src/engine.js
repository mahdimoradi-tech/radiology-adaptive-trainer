import { z } from 'zod';

/**
 * Standard chest X-ray disease classes
 * @typedef {'covid19' | 'pneumonia' | 'normal'} ClassId
 */
export const CLASS_IDS = /** @type {const} */ (['covid19', 'pneumonia', 'normal']);
export const ClassIdSchema = z.enum(CLASS_IDS);

/**
 * Difficulty buckets for chest X-ray images
 * @typedef {'easy' | 'medium' | 'hard'} Bucket
 */
export const BUCKETS = /** @type {const} */ (['easy', 'medium', 'hard']);
export const BucketSchema = z.enum(BUCKETS);

/**
 * Metadata for a chest X-ray image in the catalog
 * @typedef {Object} ImageMeta
 * @property {string} id - Unique identifier for the image
 * @property {ClassId} trueClass - Ground truth disease label
 * @property {number} difficulty - Continuous difficulty score in [0, 1]
 * @property {Bucket} bucket - Difficulty tier (easy, medium, hard)
 * @property {ClassId} confusedWith - Most likely wrong class predicted by out-of-fold model
 */
export const ImageMetaSchema = z.object({
  id: z.string().min(1),
  trueClass: ClassIdSchema,
  difficulty: z.number().min(0).max(1),
  bucket: BucketSchema,
  confusedWith: ClassIdSchema,
});

/**
 * User response record for a question in a training session
 * @typedef {Object} Response
 * @property {string} sessionId - Training session identifier
 * @property {string} imageId - Image identifier
 * @property {ClassId} trueClass - Ground truth label
 * @property {ClassId} answer - User's chosen answer
 * @property {Bucket} bucket - Difficulty tier of the image
 */
export const ResponseSchema = z.object({
  sessionId: z.string().min(1),
  imageId: z.string().min(1),
  trueClass: ClassIdSchema,
  answer: ClassIdSchema,
  bucket: BucketSchema,
});

/**
 * Bucket shares for the first (baseline) diagnostic test
 * @typedef {Object} FirstTestBucketShares
 * @property {number} easy - Proportion of easy questions
 * @property {number} medium - Proportion of medium questions
 * @property {number} hard - Proportion of hard questions
 */
export const FirstTestBucketSharesSchema = z
  .object({
    easy: z.number().min(0).max(1).default(0.4),
    medium: z.number().min(0).max(1).default(0.3),
    hard: z.number().min(0).max(1).default(0.3),
  })
  .refine((shares) => Math.abs(shares.easy + shares.medium + shares.hard - 1.0) < 1e-4, {
    message: 'First test bucket shares must sum to 1.0',
  });

/**
 * Thresholds separating easy, medium, and hard difficulty tiers
 * @typedef {Object} DifficultyThresholds
 * @property {number} easyMax - Upper difficulty bound for easy bucket (e.g. 0.34)
 * @property {number} mediumMax - Upper difficulty bound for medium bucket (e.g. 0.68)
 */
export const DifficultyThresholdsSchema = z
  .object({
    easyMax: z.number().min(0).max(1).default(0.34),
    mediumMax: z.number().min(0).max(1).default(0.68),
  })
  .refine((t) => t.easyMax < t.mediumMax, {
    message: 'easyMax must be strictly less than mediumMax',
  });

/**
 * Configuration options for the adaptive question selection engine
 * @typedef {Object} EngineConfig
 * @property {number} totalQuestions - Total number of questions per test (>= 45, default 60)
 * @property {number} minClassShare - Minimum share of questions per disease class (default 0.20)
 * @property {number} minBucketShare - Minimum share of questions per difficulty bucket (default 0.04)
 * @property {FirstTestBucketShares} firstTestBucketShares - Bucket shares for initial test
 * @property {number} alpha - Laplace smoothing parameter (default 1)
 * @property {boolean} allowRepeats - Whether questions can be repeated if pool is exhausted (default false)
 * @property {DifficultyThresholds} difficultyThresholds - Bucket cut-offs
 * @property {number} masteryThreshold - Per-class accuracy threshold to declare mastery (default 0.80)
 * @property {number|string} [seed] - Optional RNG seed for deterministic question selection
 */
export const EngineConfigSchema = z
  .object({
    totalQuestions: z.number().int().min(45, 'totalQuestions must be at least 45').default(60),
    minClassShare: z
      .number()
      .min(0)
      .max(1 / 3, 'minClassShare cannot exceed 1/3')
      .default(0.2),
    minBucketShare: z.number().min(0).max(1).default(0.04),
    firstTestBucketShares: FirstTestBucketSharesSchema.default({
      easy: 0.4,
      medium: 0.3,
      hard: 0.3,
    }),
    alpha: z.number().positive('alpha must be positive').default(1),
    allowRepeats: z.boolean().default(false),
    difficultyThresholds: DifficultyThresholdsSchema.default({
      easyMax: 0.34,
      mediumMax: 0.68,
    }),
    masteryThreshold: z.number().min(0).max(1).default(0.8),
    seed: z.union([z.number(), z.string()]).optional(),
  })
  .superRefine((config, ctx) => {
    const N = config.totalQuestions;
    const minClassCount = Math.ceil(config.minClassShare * N);
    if (3 * minClassCount > N) {
      ctx.addIssue({
        code: 'custom',
        message: `3 * ceil(minClassShare * N) (${3 * minClassCount}) exceeds total questions (${N})`,
        path: ['minClassShare'],
      });
    }

    const minBucketCount = Math.max(1, Math.round(config.minBucketShare * N));
    if (3 * minBucketCount > minClassCount) {
      ctx.addIssue({
        code: 'custom',
        message: `3 * minBucketCount (${3 * minBucketCount}) exceeds minClassCount (${minClassCount})`,
        path: ['minBucketShare'],
      });
    }
  });

/**
 * Default engine configuration
 * @type {EngineConfig}
 */
export const DEFAULT_ENGINE_CONFIG = EngineConfigSchema.parse({});

/**
 * Question bank item status
 * @typedef {'pending_review' | 'approved' | 'rejected'} QuestionStatus
 */
export const QUESTION_STATUSES = /** @type {const} */ (['pending_review', 'approved', 'rejected']);
export const QuestionStatusSchema = z.enum(QUESTION_STATUSES);

/**
 * Question bank item for targeted practice
 * @typedef {Object} QuestionBankItem
 * @property {string} id - Unique question ID
 * @property {string} imageId - Associated chest X-ray image ID
 * @property {string} type - Question category ('finding', 'distribution', 'differential')
 * @property {{ trueClass: ClassId, confusedWith: ClassId }} pair - Confusion pair
 * @property {Bucket} bucket - Difficulty tier
 * @property {QuestionStatus} status - Review status
 */
export const QuestionBankItemSchema = z.object({
  id: z.string().min(1),
  imageId: z.string().min(1),
  type: z.string().min(1),
  pair: z.object({
    trueClass: ClassIdSchema,
    confusedWith: ClassIdSchema,
  }),
  bucket: BucketSchema,
  status: QuestionStatusSchema,
});
