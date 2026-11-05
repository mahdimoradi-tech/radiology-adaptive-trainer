import { LlmError } from './provider.js';

/**
 * Deterministic fake provider for offline testing
 */
export class FakeProvider {
  constructor() {
    /** @type {Array<any>} */
    this.calls = [];
    /** @type {Array<any>} */
    this.queue = [];
    /** @type {Map<string, any>} */
    this.customResponses = new Map();
    /** @type {((params: import('./provider.js').LlmGenerateParams) => any) | null} */
    this.customHandler = null;
  }

  /**
   * Reset state between tests
   */
  reset() {
    this.calls = [];
    this.queue = [];
    this.customResponses.clear();
    this.customHandler = null;
  }

  /**
   * Enqueue a sequence of outcomes (can be data, rawText string, or Error)
   * @param {any[]} items
   */
  enqueue(...items) {
    this.queue.push(...items);
  }

  /**
   * Map a promptId to a deterministic output
   * @param {string} promptId
   * @param {any} data
   */
  setResponse(promptId, data) {
    this.customResponses.set(promptId, data);
  }

  /**
   * Custom handler function
   * @param {(params: import('./provider.js').LlmGenerateParams) => any} handler
   */
  setHandler(handler) {
    this.customHandler = handler;
  }

  /**
   * Implements the provider contract
   * @param {import('./provider.js').LlmGenerateParams} params
   * @returns {Promise<import('./provider.js').LlmGenerateResult>}
   */
  async generateJson(params) {
    const { promptId, schema, input } = params;
    this.calls.push({ ...params, calledAt: new Date().toISOString() });

    // 1. Check queue
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next instanceof Error) {
        throw next;
      }
      if (typeof next === 'string') {
        // Try parsing string as JSON, or throw invalid JSON error
        try {
          const parsed = JSON.parse(next);
          const validated = schema ? schema.parse(parsed) : parsed;
          return {
            data: validated,
            rawText: next,
            usage: { promptTokens: 50, responseTokens: 25, totalTokens: 75 },
          };
        } catch (err) {
          throw new LlmError(`Failed to parse LLM JSON: ${err.message}`, {
            code: 'LLM_INVALID_RESPONSE',
            details: next,
          });
        }
      }
      if (next && typeof next === 'object') {
        const validated = schema ? schema.parse(next) : next;
        return {
          data: validated,
          rawText: JSON.stringify(validated),
          usage: { promptTokens: 50, responseTokens: 25, totalTokens: 75 },
        };
      }
    }

    // 2. Custom handler
    if (this.customHandler) {
      const res = await this.customHandler(params);
      const validated = schema ? schema.parse(res) : res;
      return {
        data: validated,
        rawText: JSON.stringify(validated),
        usage: { promptTokens: 50, responseTokens: 25, totalTokens: 75 },
      };
    }

    // 3. Custom mapped response
    if (this.customResponses.has(promptId)) {
      const mapped = this.customResponses.get(promptId);
      const validated = schema ? schema.parse(mapped) : mapped;
      return {
        data: validated,
        rawText: JSON.stringify(validated),
        usage: { promptTokens: 50, responseTokens: 25, totalTokens: 75 },
      };
    }

    // 4. Default fixtures
    let data;
    if (promptId === 'explain-pairs') {
      const pairs =
        input && typeof input === 'object' && 'pairs' in input && Array.isArray(input.pairs)
          ? input.pairs
          : [];
      data = pairs.map((p) => ({
        trueClass: p.trueClass,
        userAnswer: p.userAnswer,
        whatToLookFor: ['یافته تشخیصی کلیدی'],
        whyConfused: 'شباهت ظاهری در لوب پایینی ریه',
        tip: 'بررسی دقیق‌تر حاشیه‌های خارجی و زوایای دنده‌ای',
      }));
    } else if (promptId === 'narrative') {
      data = {
        overview: 'گزارش تحلیلی عملکرد رزیدنت در آزمون تطبیقی.',
        strengths: ['تسلط بالا در تشخیص ریه نرمال'],
        weaknesses: ['دشواری در تفکیک کووید-۱۹ از پنومونی'],
        patterns: ['گرایش به تشخیص پنومونی در مراحل ابتدایی کووید'],
        recommendations: [
          'مرور تصاویر کدورت‌های شیشه‌مات در قاعده ریه',
          'تمرکز بر تفاوت‌های توزیع محیطی در برابر لوبار',
          'انجام یک آزمون هدفمند برای تمرین جفت‌های پرخطا',
        ],
      };
    } else {
      data = { ok: true };
    }

    const validated = schema ? schema.parse(data) : data;
    return {
      data: validated,
      rawText: JSON.stringify(validated),
      usage: { promptTokens: 100, responseTokens: 50, totalTokens: 150 },
    };
  }
}
