import crypto from 'node:crypto';
import mongoose from 'mongoose';

/**
 * Deterministic JSON serialization by sorting object keys recursively.
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }

  const sortedKeys = Object.keys(value).sort();
  const entries = sortedKeys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
  return `{${entries.join(',')}}`;
}

/**
 * Computes a deterministic SHA256 cache key for a prompt execution.
 * @param {string} promptId
 * @param {string} version
 * @param {unknown} input
 * @returns {string}
 */
export function computeCacheKey(promptId, version, input) {
  const payload = `${promptId}:${version}:${canonicalJson(input)}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

const llmCacheSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    promptId: {
      type: String,
      required: true,
      index: true,
    },
    version: {
      type: String,
      required: true,
    },
    lang: {
      type: String,
      enum: ['fa', 'en'],
      default: 'fa',
    },
    portable: {
      type: Boolean,
      default: false,
      index: true,
    },
    input: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    response: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    collection: 'llm_cache',
    timestamps: true,
  },
);

export const LlmCache = mongoose.models.LlmCache || mongoose.model('LlmCache', llmCacheSchema);

/**
 * Retrieves a response from the LLM cache if it exists.
 *
 * @param {string} promptId
 * @param {string} version
 * @param {unknown} input
 * @returns {Promise<any | null>}
 */
export async function getCachedResponse(promptId, version, input) {
  const key = computeCacheKey(promptId, version, input);
  const doc = await LlmCache.findOne({ key }).lean();
  return doc ? doc.response : null;
}

/**
 * Saves a response to the LLM cache.
 *
 * @param {Object} params
 * @param {string} params.promptId
 * @param {string} params.version
 * @param {unknown} params.input
 * @param {unknown} params.response
 * @param {boolean} [params.portable=false]
 * @param {'fa'|'en'} [params.lang='fa']
 * @returns {Promise<any>}
 */
export async function setCachedResponse({
  promptId,
  version,
  input,
  response,
  portable = false,
  lang = 'fa',
}) {
  const key = computeCacheKey(promptId, version, input);
  return LlmCache.findOneAndUpdate(
    { key },
    {
      $set: {
        promptId,
        version,
        lang,
        portable,
        input,
        response,
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
}

/**
 * Counts entries in the cache
 * @returns {Promise<{ totalEntries: number, portableEntries: number }>}
 */
export async function countCacheEntries() {
  const totalEntries = await LlmCache.countDocuments();
  const portableEntries = await LlmCache.countDocuments({ portable: true });
  return { totalEntries, portableEntries };
}
