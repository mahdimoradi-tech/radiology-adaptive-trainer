import { describe, it, expect } from 'vitest';
import {
  getPredictedClass,
  evaluateMlArtifacts,
  formatMlMarkdown,
} from '../../../../scripts/eval-ml.js';

describe('eval-ml — ML Per-Source Accuracy & Confounder Evaluation (T10)', () => {
  it('getPredictedClass extracts highest probability class', () => {
    expect(
      getPredictedClass({
        covid19: 0.1,
        pneumonia: 0.8,
        normal: 0.1,
      }),
    ).toBe('pneumonia');

    expect(
      getPredictedClass({
        covid19: 0.7,
        pneumonia: 0.2,
        normal: 0.1,
      }),
    ).toBe('covid19');

    expect(getPredictedClass(null)).toBeNull();
  });

  it('evaluateMlArtifacts computes overall, per-source, and class x source metrics with CIs', () => {
    const mockDifficulty = [
      {
        imageId: 'img1',
        trueClass: 'covid19',
        source: 'cohen',
        bucket: 'hard',
        probs: { covid19: 0.9, pneumonia: 0.05, normal: 0.05 },
        inCatalog: true,
      },
      {
        imageId: 'img2',
        trueClass: 'covid19',
        source: 'figure1',
        bucket: 'medium',
        probs: { covid19: 0.4, pneumonia: 0.5, normal: 0.1 }, // Wrong prediction (pneumonia)
        inCatalog: true,
      },
      {
        imageId: 'img3',
        trueClass: 'pneumonia',
        source: 'kermany',
        bucket: 'easy',
        probs: { covid19: 0.05, pneumonia: 0.9, normal: 0.05 },
        inCatalog: false,
      },
      {
        imageId: 'img4',
        trueClass: 'normal',
        source: 'kermany',
        bucket: 'easy',
        probs: { covid19: 0.05, pneumonia: 0.05, normal: 0.9 },
        inCatalog: true,
      },
    ];

    const report = evaluateMlArtifacts({
      difficultyItems: mockDifficulty,
      catalogItems: mockDifficulty.filter((i) => i.inCatalog),
      date: '2026-11-07T00:00:00.000Z',
    });

    expect(report.metadata.totalImages).toBe(4);
    expect(report.metadata.catalogSubsetCount).toBe(3);

    // Full dataset: 3 correct out of 4 (75%)
    expect(report.overallOof.total).toBe(4);
    expect(report.overallOof.correct).toBe(3);
    expect(report.overallOof.accuracy).toBe(0.75);
    expect(report.overallOof.accuracyCi.low).toBeGreaterThan(0.3);

    // Catalog subset: 2 correct out of 3
    expect(report.catalogOof.total).toBe(3);
    expect(report.catalogOof.correct).toBe(2);
    expect(report.catalogOof.accuracy).toBeCloseTo(2 / 3, 4);

    // Source breakdown
    expect(report.bySource.kermany.total).toBe(2);
    expect(report.bySource.kermany.correct).toBe(2);
    expect(report.bySource.cohen.correct).toBe(1);
    expect(report.bySource.figure1.correct).toBe(0);

    // Class x Source
    expect(report.byClassSource['covid19 × cohen'].correct).toBe(1);
    expect(report.byClassSource['covid19 × figure1'].correct).toBe(0);

    // Class distribution by source
    expect(report.classShareBySource.covid19.total).toBe(2);
    expect(report.classShareBySource.covid19.sources.cohen.count).toBe(1);
    expect(report.classShareBySource.covid19.sources.cohen.share).toBe(0.5);

    // Markdown contains formatted sections
    const md = formatMlMarkdown(report);
    expect(md).toContain('### E4 — ML (DenseNet-121)');
    expect(md).toContain('Full Dataset (OOF)');
    expect(md).toContain('App Catalog (500 Cap)');
    expect(md).toContain('Class Distribution by Source');
  });
});
