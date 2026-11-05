import { describe, it, expect } from 'vitest';
import { normalizeDigits, extractNumbers, passesGuard } from '../guard.js';

describe('LLM Output Guard', () => {
  describe('normalizeDigits', () => {
    it('converts Persian digits to ASCII', () => {
      expect(normalizeDigits('کدورت در لوب ۳ با دقت ۸۵ درصد')).toBe(
        'کدورت در لوب 3 با دقت 85 درصد',
      );
      expect(normalizeDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
    });

    it('converts Arabic-Indic digits to ASCII', () => {
      expect(normalizeDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    });

    it('leaves ASCII digits unchanged', () => {
      expect(normalizeDigits('test 123')).toBe('test 123');
    });
  });

  describe('extractNumbers', () => {
    it('extracts numbers from primitives, strings, arrays and objects', () => {
      const payload = {
        totalQuestions: 45,
        accuracyPercent: 78.4,
        note: 'دارای ۳ کلاس مختلف',
        nested: {
          wrongCount: 10,
          ids: ['Q1', 'Q2'],
        },
      };

      const numbers = extractNumbers(payload);
      expect(numbers.has('45')).toBe(true);
      expect(numbers.has('78')).toBe(true);
      expect(numbers.has('3')).toBe(true);
      expect(numbers.has('10')).toBe(true);
      expect(numbers.has('1')).toBe(true);
      expect(numbers.has('2')).toBe(true);
    });

    it('extracts Persian digits from strings', () => {
      const numbers = extractNumbers({ text: 'دقت ۸۲ و تعداد ۱۵' });
      expect(numbers.has('82')).toBe(true);
      expect(numbers.has('15')).toBe(true);
    });
  });

  describe('passesGuard', () => {
    const allowed = new Set(['45', '35', '78', '3']);

    it('accepts output with known numbers and no percent sign', () => {
      const output = {
        overview: 'از مجموع ۴۵ سوال، ۳۵ پاسخ صحیح ثبت شد و دقت کلی ۷۸ است.',
        strengths: ['تشخیص در ۳ کلاس متوازن بود.'],
      };
      expect(passesGuard(output, allowed)).toBe(true);
    });

    it('rejects output containing ASCII percent sign (%)', () => {
      const output = {
        overview: 'دقت کلی ۷۸% بوده است.',
      };
      expect(passesGuard(output, allowed)).toBe(false);
    });

    it('rejects output containing Persian/Arabic percent sign (٪)', () => {
      const output = {
        overview: 'دقت کلی ۷۸٪ ثبت گردید.',
      };
      expect(passesGuard(output, allowed)).toBe(false);
    });

    it('rejects output containing hallucinated numbers not in input', () => {
      const output = {
        overview: 'دقت شما ۹۲ است.', // 92 was never in allowed
      };
      expect(passesGuard(output, allowed)).toBe(false);
    });

    it('rejects output containing hallucinated Persian digits', () => {
      const output = {
        overview: 'تعداد خطاهای پنومونی ۸ مورد بود.', // 8 was not in allowed
      };
      expect(passesGuard(output, allowed)).toBe(false);
    });

    it('accepts text without any numbers', () => {
      const output = {
        overview: 'عملکرد رزیدنت در حد انتظار ارزیابی شد.',
      };
      expect(passesGuard(output, allowed)).toBe(true);
    });
  });
});
