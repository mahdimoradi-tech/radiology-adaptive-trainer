import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { applyDirection, useDirection } from '../direction.js';
import { fmt } from '../format.js';
import i18n from '../../i18n/index.js';

describe('Direction & Format Helpers', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('dir');
    document.documentElement.removeAttribute('lang');
  });

  describe('applyDirection', () => {
    it('sets dir="rtl" and lang="fa" for Persian', () => {
      const res = applyDirection('fa');
      expect(res).toEqual({ dir: 'rtl', lang: 'fa' });
      expect(document.documentElement.getAttribute('dir')).toBe('rtl');
      expect(document.documentElement.getAttribute('lang')).toBe('fa');
    });

    it('sets dir="ltr" and lang="en" for English', () => {
      const res = applyDirection('en');
      expect(res).toEqual({ dir: 'ltr', lang: 'en' });
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');
      expect(document.documentElement.getAttribute('lang')).toBe('en');
    });
  });

  describe('useDirection Hook', () => {
    it('syncs HTML attributes with active i18next language', async () => {
      await act(async () => {
        await i18n.changeLanguage('fa');
      });

      const { result } = renderHook(() => useDirection());
      expect(result.current.isRtl).toBe(true);
      expect(result.current.dir).toBe('rtl');
      expect(document.documentElement.getAttribute('dir')).toBe('rtl');

      await act(async () => {
        await i18n.changeLanguage('en');
      });

      expect(result.current.isRtl).toBe(false);
      expect(result.current.dir).toBe('ltr');
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    });
  });

  describe('fmt formatting helpers', () => {
    it('formats numbers with Persian and Latin digits', () => {
      const faNum = fmt.number(12345, 'fa');
      const enNum = fmt.number(12345, 'en');

      expect(faNum).toContain('۱۲');
      expect(enNum).toBe('12,345');
    });

    it('formats percentages correctly', () => {
      const faPct = fmt.percent(0.854, 'fa', 1);
      const enPct = fmt.percent(0.854, 'en', 1);

      expect(faPct).toContain('٪');
      expect(faPct).toContain('۸۵');
      expect(enPct).toBe('85.4%');
    });

    it('formats dates in Persian Jalali and English Gregorian calendars', () => {
      // 2026-11-01 corresponds to 10 Aban 1405 in Persian calendar
      const date = new Date('2026-11-01T12:00:00Z');
      const faDate = fmt.date(date, 'fa');
      const enDate = fmt.date(date, 'en');

      expect(faDate).toContain('۱۴۰۵');
      expect(faDate).toContain('آبان');
      expect(enDate).toContain('Nov');
      expect(enDate).toContain('2026');
    });

    it('handles invalid inputs gracefully', () => {
      expect(fmt.number('invalid')).toBe('');
      expect(fmt.percent(null)).toBe('');
      expect(fmt.date('')).toBe('');
    });
  });
});
