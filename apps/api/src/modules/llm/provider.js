/**
 * Base interface and error types for LLM providers
 */

export class LlmError extends Error {
  /**
   * @param {string} message
   * @param {{ code: string, status?: number, retryable?: boolean, details?: unknown }} [options]
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'LlmError';
    this.code = options.code || 'LLM_ERROR';
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}

/**
 * @typedef {Object} LlmGenerateParams
 * @property {string} promptId - Identifier of prompt (e.g. 'explain-pairs', 'narrative')
 * @property {string} version - Prompt version (e.g. 'v1')
 * @property {string} system - System prompt
 * @property {unknown} input - Structured input data
 * @property {import('zod').ZodTypeAny} schema - Zod schema expected for the output
 * @property {Array<{ type: string, data: string, mime_type: string }>} [images] - Optional multimodal images
 * @property {number} [timeoutMs] - Request timeout in milliseconds
 */

/**
 * @typedef {Object} LlmGenerateResult
 * @property {unknown} data - Parsed and validated JSON object
 * @property {string} rawText - Raw text output from LLM
 * @property {{ promptTokens: number, responseTokens: number, totalTokens: number }} usage - Token usage metadata
 */
