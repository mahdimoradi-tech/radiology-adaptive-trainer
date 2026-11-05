import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { LlmError } from './provider.js';

/**
 * Real Gemini provider using Google GenAI SDK (Interactions API)
 */
export class GeminiProvider {
  /**
   * @param {Object} options
   * @param {string} options.apiKey
   * @param {string} [options.model='gemini-3.8-flash']
   * @param {number} [options.timeoutMs=60000]
   * @param {any} [options.client] - Injected client for testing
   */
  constructor({ apiKey, model = 'gemini-3.8-flash', timeoutMs = 60000, client = null }) {
    if (!client && !apiKey) {
      throw new Error('GeminiProvider requires a valid GEMINI_API_KEY');
    }
    this.model = model;
    this.timeoutMs = timeoutMs;
    this.client = client || new GoogleGenAI({ apiKey });
  }

  /**
   * Generates a structured JSON response via Gemini Interactions API.
   *
   * @param {import('./provider.js').LlmGenerateParams} params
   * @returns {Promise<import('./provider.js').LlmGenerateResult>}
   */
  async generateJson({ system, input, schema, images, timeoutMs: callTimeoutMs }) {
    const effectiveTimeoutMs = callTimeoutMs || this.timeoutMs;

    // Convert Zod schema to standard JSON Schema
    let jsonSchema = undefined;
    if (schema) {
      jsonSchema = z.toJSONSchema(schema);
    }

    // Prepare input payload (supporting multimodal parts array, text + optional image parts, or string/object)
    let inputPayload;
    if (Array.isArray(input)) {
      inputPayload = input;
    } else if (images && images.length > 0) {
      const textPart = {
        type: 'text',
        text: typeof input === 'string' ? input : JSON.stringify(input),
      };
      const imageParts = images.map((img) => ({
        type: 'image',
        data: img.data,
        mime_type: img.mime_type || 'image/jpeg',
      }));
      inputPayload = [textPart, ...imageParts];
    } else {
      inputPayload = typeof input === 'string' ? input : JSON.stringify(input);
    }

    const requestPayload = {
      model: this.model,
      input: inputPayload,
      system_instruction: system,
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: jsonSchema,
      },
    };

    let interaction;
    try {
      // Execute interaction with AbortController timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), effectiveTimeoutMs);

      try {
        interaction = await this.client.interactions.create(requestPayload, {
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      // 429 Rate limit / Quota exceeded
      const is429 =
        err?.status === 429 ||
        err?.code === 'RESOURCE_EXHAUSTED' ||
        String(err?.message || '').includes('429') ||
        String(err?.message || '').includes('RESOURCE_EXHAUSTED');

      if (is429) {
        throw new LlmError(`Gemini 429 quota/rate limit: ${err.message}`, {
          code: 'LLM_RATE_LIMIT',
          status: 429,
          retryable: true,
          details: err,
        });
      }

      const is503 =
        err?.status === 503 ||
        String(err?.message || '').includes('503') ||
        String(err?.message || '').includes('high demand');

      if (is503) {
        throw new LlmError(`Gemini 503 high demand: ${err.message}`, {
          code: 'LLM_UNAVAILABLE',
          status: 503,
          retryable: true,
          details: err,
        });
      }

      if (err?.name === 'AbortError' || String(err?.message || '').includes('aborted')) {
        throw new LlmError(`Gemini interaction timed out after ${effectiveTimeoutMs}ms`, {
          code: 'LLM_TIMEOUT',
          retryable: true,
          details: err,
        });
      }

      throw new LlmError(`Gemini interaction failed: ${err.message}`, {
        code: 'LLM_CALL_FAILED',
        details: err,
      });
    }

    const rawText = interaction?.output_text || '';
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (parseErr) {
      throw new LlmError(`Gemini output is not valid JSON: ${parseErr.message}`, {
        code: 'LLM_INVALID_RESPONSE',
        retryable: true,
        details: { rawText },
      });
    }

    let validated = parsed;
    if (schema) {
      try {
        validated = schema.parse(parsed);
      } catch (validationErr) {
        throw new LlmError(`Gemini JSON failed schema validation: ${validationErr.message}`, {
          code: 'LLM_SCHEMA_VALIDATION_FAILED',
          retryable: true,
          details: { parsed, rawText },
        });
      }
    }

    const usage = {
      promptTokens: interaction?.usage?.total_input_tokens ?? 0,
      responseTokens: interaction?.usage?.total_output_tokens ?? 0,
      totalTokens: interaction?.usage?.total_tokens ?? 0,
    };

    return {
      data: validated,
      rawText,
      usage,
    };
  }
}
