import { describe, it, expect } from 'vitest';
import { wilsonInterval, cohenKappa } from '../stats/index.js';

describe('Statistics Helpers (pure engine functions)', () => {
  describe('wilsonInterval(k, n, z)', () => {
    it('computes known test values for k=8, n=10, z=1.96', () => {
      const res = wilsonInterval(8, 10);
      expect(res.p).toBe(0.8);
      expect(res.low).toBeCloseTo(0.49, 3);
      expect(res.high).toBeCloseTo(0.943, 3);
    });

    it('returns nulls for n=0', () => {
      expect(wilsonInterval(0, 0)).toEqual({
        p: null,
        low: null,
        high: null,
      });
      expect(wilsonInterval(5, 0)).toEqual({
        p: null,
        low: null,
        high: null,
      });
    });

    it('handles boundary k=0 gracefully', () => {
      const res = wilsonInterval(0, 10);
      expect(res.p).toBe(0);
      expect(res.low).toBe(0);
      expect(res.high).toBeGreaterThan(0);
      expect(res.high).toBeLessThan(0.4);
    });

    it('handles boundary k=n gracefully', () => {
      const res = wilsonInterval(10, 10);
      expect(res.p).toBe(1);
      expect(res.low).toBeGreaterThan(0.6);
      expect(res.high).toBe(1);
    });

    it('respects custom z parameter', () => {
      const res99 = wilsonInterval(8, 10, 2.576);
      const res95 = wilsonInterval(8, 10, 1.96);
      expect(res99.low).toBeLessThan(res95.low);
      expect(res99.high).toBeGreaterThan(res95.high);
    });
  });

  describe('cohenKappa(table)', () => {
    it('computes known test values for [[20, 5], [10, 15]] -> kappa=0.4, po=0.7, pe=0.5', () => {
      const res = cohenKappa([
        [20, 5],
        [10, 15],
      ]);
      expect(res.kappa).toBeCloseTo(0.4, 6);
      expect(res.po).toBeCloseTo(0.7, 6);
      expect(res.pe).toBeCloseTo(0.5, 6);
    });

    it('returns nulls for empty table or n=0', () => {
      expect(cohenKappa([])).toEqual({ kappa: null, po: null, pe: null });
      expect(
        cohenKappa([
          [0, 0],
          [0, 0],
        ]),
      ).toEqual({ kappa: null, po: null, pe: null });
    });

    it('returns kappa=1 for perfect agreement on 3x3 table', () => {
      const res = cohenKappa([
        [10, 0, 0],
        [0, 15, 0],
        [0, 0, 20],
      ]);
      expect(res.kappa).toBeCloseTo(1.0, 6);
      expect(res.po).toBeCloseTo(1.0, 6);
    });

    it('accepts dictionary/object of objects confusion format', () => {
      const dict = {
        covid19: { covid19: 20, pneumonia: 5 },
        pneumonia: { covid19: 10, pneumonia: 15 },
      };
      const res = cohenKappa(dict);
      expect(res.kappa).toBeCloseTo(0.4, 6);
      expect(res.po).toBeCloseTo(0.7, 6);
      expect(res.pe).toBeCloseTo(0.5, 6);
    });

    it('handles complete chance agreement edge cases without dividing by zero', () => {
      // All items in one category: po = 1, pe = 1 -> (1 - pe) == 0
      const res = cohenKappa([
        [10, 0],
        [0, 0],
      ]);
      expect(res.po).toBe(1);
      expect(res.pe).toBe(1);
      expect(res.kappa).toBe(1);
    });
  });
});
