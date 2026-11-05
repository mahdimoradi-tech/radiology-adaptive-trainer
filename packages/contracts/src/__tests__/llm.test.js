import { describe, it, expect } from 'vitest';
import {
  LLM_MODES,
  LlmModeSchema,
  LANGS,
  LangSchema,
  LLM_SOURCES,
  LlmSourceSchema,
  ExplanationPairSchema,
  ExplanationItemSchema,
  ExplanationsResponseSchema,
  NarrativeSchema,
  NarrativeResponseSchema,
  LlmRequestBodySchema,
  AdminLlmStatusSchema,
} from '../llm.js';

describe('LLM Contracts', () => {
  describe('LlmModeSchema', () => {
    it('accepts valid modes', () => {
      for (const mode of LLM_MODES) {
        expect(LlmModeSchema.parse(mode)).toBe(mode);
      }
    });

    it('rejects invalid modes', () => {
      expect(() => LlmModeSchema.parse('invalid')).toThrow();
    });
  });

  describe('LangSchema', () => {
    it('accepts fa and en', () => {
      for (const lang of LANGS) {
        expect(LangSchema.parse(lang)).toBe(lang);
      }
    });

    it('rejects invalid languages', () => {
      expect(() => LangSchema.parse('fr')).toThrow();
    });
  });

  describe('LlmSourceSchema', () => {
    it('accepts valid sources', () => {
      for (const src of LLM_SOURCES) {
        expect(LlmSourceSchema.parse(src)).toBe(src);
      }
    });

    it('rejects invalid source', () => {
      expect(() => LlmSourceSchema.parse('unknown')).toThrow();
    });
  });

  describe('ExplanationItemSchema', () => {
    const validItem = {
      no: 1,
      trueClass: 'covid19',
      userAnswer: 'pneumonia',
      whatToLookFor: ['کدورت‌های محیطی و دوطرفه'],
      whyConfused: 'شباهت ظاهری با پنومونی باکتریال',
      tip: 'همیشه توزیع محیطی در قاعده ریه‌ها را بررسی کنید',
    };

    it('accepts valid explanation item', () => {
      expect(ExplanationItemSchema.parse(validItem)).toEqual(validItem);
    });

    it('rejects item with no < 1', () => {
      expect(() => ExplanationItemSchema.parse({ ...validItem, no: 0 })).toThrow();
    });

    it('rejects whatToLookFor with > 3 items', () => {
      expect(() =>
        ExplanationItemSchema.parse({
          ...validItem,
          whatToLookFor: ['1', '2', '3', '4'],
        }),
      ).toThrow();
    });

    it('rejects strings longer than 160 chars', () => {
      const longStr = 'a'.repeat(161);
      expect(() =>
        ExplanationItemSchema.parse({
          ...validItem,
          whyConfused: longStr,
        }),
      ).toThrow();
    });

    it('ExplanationPairSchema validates pair without no', () => {
      const { no: _no, ...pair } = validItem;
      expect(ExplanationPairSchema.parse(pair)).toEqual(pair);
    });
  });

  describe('ExplanationsResponseSchema', () => {
    it('accepts valid explanations response', () => {
      const response = {
        source: 'cache',
        reviewed: false,
        items: [
          {
            no: 3,
            trueClass: 'covid19',
            userAnswer: 'normal',
            whatToLookFor: ['کدورت خفیف در لوب تحتانی'],
            whyConfused: 'در مراحل اولیه ممکن است شبیه ریه نرمال باشد',
            tip: 'پشت دیافراگم را با دقت نگاه کنید',
          },
        ],
      };
      expect(ExplanationsResponseSchema.parse(response)).toEqual(response);
    });
  });

  describe('NarrativeSchema', () => {
    const validNarrative = {
      overview: 'عملکرد کلی رزیدنت قابل توجه بوده و دقت مناسبی در تشخیص موارد نرمال نشان داد.',
      strengths: ['تشخیص ریه سالم با دقت بالا'],
      weaknesses: ['تشخیص اشتباه کووید-۱۹ به جای پنومونی'],
      patterns: ['تمایل به نادیده گرفتن کدورت‌های محیطی'],
      recommendations: [
        'مرور تصاویر دارای کدورت‌های شیشه‌مات در حاشیه ریه',
        'دقت بیشتر به زاویه‌های دنده‌ای-دیافراگمی',
        'انجام یک آزمون با تمرکز بر تمایز کووید-۱۹ و پنومونی',
      ],
    };

    it('accepts valid narrative with exactly 3 recommendations', () => {
      expect(NarrativeSchema.parse(validNarrative)).toEqual(validNarrative);
    });

    it('rejects narrative with fewer than 3 recommendations', () => {
      expect(() =>
        NarrativeSchema.parse({
          ...validNarrative,
          recommendations: ['توصیه ۱', 'توصیه ۲'],
        }),
      ).toThrow();
    });

    it('rejects narrative with more than 3 recommendations', () => {
      expect(() =>
        NarrativeSchema.parse({
          ...validNarrative,
          recommendations: ['توصیه ۱', 'توصیه ۲', 'توصیه ۳', 'توصیه ۴'],
        }),
      ).toThrow();
    });

    it('rejects overview longer than 400 chars', () => {
      expect(() =>
        NarrativeSchema.parse({
          ...validNarrative,
          overview: 'x'.repeat(401),
        }),
      ).toThrow();
    });
  });

  describe('NarrativeResponseSchema', () => {
    it('accepts valid narrative response and defaults reviewed to false', () => {
      const parsed = NarrativeResponseSchema.parse({
        source: 'llm',
        narrative: {
          overview: 'متن خلاصه کارنامه رزیدنت.',
          strengths: ['نقطه قوت'],
          weaknesses: ['نقطه ضعف'],
          patterns: ['الگوی خطا'],
          recommendations: ['توصیه ۱', 'توصیه ۲', 'توصیه ۳'],
        },
      });
      expect(parsed.source).toBe('llm');
      expect(parsed.reviewed).toBe(false);
    });
  });

  describe('LlmRequestBodySchema', () => {
    it('defaults lang to fa when empty', () => {
      expect(LlmRequestBodySchema.parse({})).toEqual({ lang: 'fa' });
    });

    it('accepts explicit lang en', () => {
      expect(LlmRequestBodySchema.parse({ lang: 'en' })).toEqual({ lang: 'en' });
    });
  });

  describe('AdminLlmStatusSchema', () => {
    it('accepts valid status payload', () => {
      const status = {
        mode: 'cache-only',
        model: 'gemini-3.8-flash',
        today: {
          count: 5,
          budget: 16,
          exhausted: false,
          lastCallAt: '2026-11-05T08:00:00.000Z',
        },
        cache: {
          totalEntries: 6,
        },
      };
      expect(AdminLlmStatusSchema.parse(status)).toEqual(status);
    });
  });
});
