import { describe, it, expect } from 'vitest';
import { selectAnalysisSet } from '../sampling.js';

// ---------------------------------------------------------------------------
// Fixture builder
// ---------------------------------------------------------------------------

/**
 * Build a minimal image fixture catalog.
 * @param {Object} counts - { covid19: { easy: { cohen, figure1 }, medium, hard }, pneumonia: { ... }, normal: { ... } }
 */
function buildCatalog(counts) {
  const imgs = [];
  let id = 0;
  for (const [cls, buckets] of Object.entries(counts)) {
    for (const [bucket, sources] of Object.entries(buckets)) {
      if (typeof sources === 'number') {
        // Single source: "default"
        for (let i = 0; i < sources; i++) {
          imgs.push({ _id: `img-${id++}`, trueClass: cls, bucket, source: 'default' });
        }
      } else {
        // Multiple sources
        for (const [src, n] of Object.entries(sources)) {
          for (let i = 0; i < n; i++) {
            imgs.push({ _id: `img-${id++}`, trueClass: cls, bucket, source: src });
          }
        }
      }
    }
  }
  return imgs;
}

// A catalog that satisfies all strata requirements for the default perClass=40
function sufficientCatalog() {
  return buildCatalog({
    covid19: {
      easy: { cohen: 25, figure1: 20 }, // 45 easy, need 35 split by LR
      medium: { cohen: 3 }, // 3 medium (all selected)
      hard: { cohen: 2 }, // 2 hard (all selected)
    },
    pneumonia: {
      easy: { kermany: 20 }, // need 13
      medium: { kermany: 20 }, // need 13
      hard: { kermany: 20 }, // need 14
    },
    normal: {
      easy: { kermany: 20 },
      medium: { kermany: 20 },
      hard: { kermany: 20 },
    },
  });
}

// ---------------------------------------------------------------------------
// Test 1a: Counts per stratum
// ---------------------------------------------------------------------------

describe('selectAnalysisSet — counts per stratum', () => {
  it('returns exactly 120 images total', () => {
    const set = selectAnalysisSet(sufficientCatalog());
    expect(set).toHaveLength(120);
  });

  it('returns exactly 40 per class', () => {
    const set = selectAnalysisSet(sufficientCatalog());
    const byCls = { covid19: 0, pneumonia: 0, normal: 0 };
    for (const e of set) byCls[e.trueClass]++;
    expect(byCls.covid19).toBe(40);
    expect(byCls.pneumonia).toBe(40);
    expect(byCls.normal).toBe(40);
  });

  it('covid19: selects all medium+hard, then fills to 40 with easy', () => {
    const set = selectAnalysisSet(sufficientCatalog());
    const covid = set.filter((e) => e.trueClass === 'covid19');
    const hard = covid.filter((e) => e.bucket === 'hard').length;
    const medium = covid.filter((e) => e.bucket === 'medium').length;
    const easy = covid.filter((e) => e.bucket === 'easy').length;
    expect(hard).toBe(2); // all 2 hard
    expect(medium).toBe(3); // all 3 medium
    expect(easy).toBe(35); // remainder to reach 40
  });

  it('pneumonia: 14 hard, 13 medium, 13 easy', () => {
    const set = selectAnalysisSet(sufficientCatalog());
    const pn = set.filter((e) => e.trueClass === 'pneumonia');
    expect(pn.filter((e) => e.bucket === 'hard').length).toBe(14);
    expect(pn.filter((e) => e.bucket === 'medium').length).toBe(13);
    expect(pn.filter((e) => e.bucket === 'easy').length).toBe(13);
  });

  it('normal: 14 hard, 13 medium, 13 easy', () => {
    const set = selectAnalysisSet(sufficientCatalog());
    const nm = set.filter((e) => e.trueClass === 'normal');
    expect(nm.filter((e) => e.bucket === 'hard').length).toBe(14);
    expect(nm.filter((e) => e.bucket === 'medium').length).toBe(13);
    expect(nm.filter((e) => e.bucket === 'easy').length).toBe(13);
  });

  it('each entry has required fields', () => {
    const set = selectAnalysisSet(sufficientCatalog());
    for (const e of set) {
      expect(e).toHaveProperty('imageId');
      expect(e).toHaveProperty('trueClass');
      expect(e).toHaveProperty('bucket');
      expect(e).toHaveProperty('source');
      expect(e).toHaveProperty('stratum');
      expect(e.stratum).toBe(`${e.trueClass}:${e.bucket}:${e.source}`);
    }
  });

  it('no duplicate imageIds in the set', () => {
    const set = selectAnalysisSet(sufficientCatalog());
    const ids = set.map((e) => e.imageId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// Test 1b: Deterministic with the same seed
// ---------------------------------------------------------------------------

describe('selectAnalysisSet — determinism', () => {
  it('two calls with same seed produce identical result', () => {
    const a = selectAnalysisSet(sufficientCatalog(), { seed: 'analysis-v1' });
    const b = selectAnalysisSet(sufficientCatalog(), { seed: 'analysis-v1' });
    expect(a.map((e) => e.imageId)).toEqual(b.map((e) => e.imageId));
  });

  it('different seeds produce different results (usually)', () => {
    const a = selectAnalysisSet(sufficientCatalog(), { seed: 'analysis-v1' });
    const b = selectAnalysisSet(sufficientCatalog(), { seed: 'analysis-v2' });
    // With 120 images and a large catalog, the chance of identical order is negligible
    const idsA = a.map((e) => e.imageId).join(',');
    const idsB = b.map((e) => e.imageId).join(',');
    expect(idsA).not.toBe(idsB);
  });
});

// ---------------------------------------------------------------------------
// Test 1c: Largest remainder by source for covid19 easy
// ---------------------------------------------------------------------------

describe('selectAnalysisSet — largest remainder by source (covid19 easy)', () => {
  it('splits 35 easy covid19 proportionally between cohen and figure1', () => {
    // cohen: 25, figure1: 20 -> total 45. Proportional: cohen~19.44, figure1~15.56
    // LR: cohen=20 or 19 depending on remainder; figure1=15 or 16. Total must be 35.
    const set = selectAnalysisSet(sufficientCatalog());
    const easyCovidCohen = set.filter(
      (e) => e.trueClass === 'covid19' && e.bucket === 'easy' && e.source === 'cohen',
    ).length;
    const easyCovidFigure1 = set.filter(
      (e) => e.trueClass === 'covid19' && e.bucket === 'easy' && e.source === 'figure1',
    ).length;
    expect(easyCovidCohen + easyCovidFigure1).toBe(35);
    // Both should have been given at least 1 image
    expect(easyCovidCohen).toBeGreaterThan(0);
    expect(easyCovidFigure1).toBeGreaterThan(0);
  });

  it('single-source catalog: all easy covid19 from that source', () => {
    const catalog = buildCatalog({
      covid19: {
        easy: { only: 40 },
        medium: { only: 2 },
        hard: { only: 1 },
      },
      pneumonia: { easy: { k: 15 }, medium: { k: 15 }, hard: { k: 15 } },
      normal: { easy: { k: 15 }, medium: { k: 15 }, hard: { k: 15 } },
    });
    const set = selectAnalysisSet(catalog);
    const easyCovidOnly = set.filter(
      (e) => e.trueClass === 'covid19' && e.bucket === 'easy' && e.source === 'only',
    ).length;
    expect(easyCovidOnly).toBe(37); // 40 - 2 medium - 1 hard
  });
});

// ---------------------------------------------------------------------------
// Test 1d: Error when a stratum is too small
// ---------------------------------------------------------------------------

describe('selectAnalysisSet — errors on insufficient strata', () => {
  it('throws when covid19 easy total is less than needed', () => {
    const catalog = buildCatalog({
      covid19: {
        easy: { cohen: 5 }, // only 5, need 35
        medium: { cohen: 2 },
        hard: { cohen: 1 },
      },
      pneumonia: { easy: { k: 20 }, medium: { k: 20 }, hard: { k: 20 } },
      normal: { easy: { k: 20 }, medium: { k: 20 }, hard: { k: 20 } },
    });
    expect(() => selectAnalysisSet(catalog)).toThrow(/covid19 easy stratum too small/);
  });

  it('throws when pneumonia hard is less than 14', () => {
    const catalog = buildCatalog({
      covid19: {
        easy: { cohen: 40 },
        medium: { cohen: 3 },
        hard: { cohen: 2 },
      },
      pneumonia: {
        easy: { k: 20 },
        medium: { k: 20 },
        hard: { k: 5 }, // only 5, need 14
      },
      normal: { easy: { k: 20 }, medium: { k: 20 }, hard: { k: 20 } },
    });
    expect(() => selectAnalysisSet(catalog)).toThrow(/pneumonia hard stratum too small/);
  });

  it('throws when normal medium is less than 13', () => {
    const catalog = buildCatalog({
      covid19: {
        easy: { cohen: 40 },
        medium: { cohen: 3 },
        hard: { cohen: 2 },
      },
      pneumonia: { easy: { k: 20 }, medium: { k: 20 }, hard: { k: 20 } },
      normal: {
        easy: { k: 20 },
        medium: { k: 2 }, // only 2, need 13
        hard: { k: 20 },
      },
    });
    expect(() => selectAnalysisSet(catalog)).toThrow(/normal medium stratum too small/);
  });
});
