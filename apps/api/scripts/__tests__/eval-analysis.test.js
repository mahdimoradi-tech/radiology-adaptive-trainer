import { describe, it, expect } from 'vitest';
import {
  getDensenetPrediction,
  computeClassMetrics,
  createEmptyConfusionMatrix,
  evaluateAnalyses,
  formatAnalysisMarkdown,
} from '../../../../scripts/eval-analysis.js';

describe('eval-analysis — Image Analysis Evaluation Logic (T10)', () => {
  it('getDensenetPrediction extracts argmax disease class', () => {
    expect(
      getDensenetPrediction({
        covid19: 0.05,
        pneumonia: 0.85,
        normal: 0.1,
      }),
    ).toBe('pneumonia');

    expect(
      getDensenetPrediction({
        covid19: 0.9,
        pneumonia: 0.05,
        normal: 0.05,
      }),
    ).toBe('covid19');

    expect(getDensenetPrediction(null)).toBeNull();
  });

  it('computeClassMetrics calculates accuracy, recall, and precision with Wilson CIs', () => {
    const conf = createEmptyConfusionMatrix();
    // 8 covid19 correct, 2 confused with pneumonia
    conf.covid19.covid19 = 8;
    conf.covid19.pneumonia = 2;
    // 10 pneumonia correct
    conf.pneumonia.pneumonia = 10;
    // 10 normal correct
    conf.normal.normal = 10;

    const res = computeClassMetrics(conf);
    expect(res.total).toBe(30);
    expect(res.correct).toBe(28);
    expect(res.accuracy).toBeCloseTo(28 / 30, 4);
    expect(res.byClass.covid19.recall).toBeCloseTo(0.8, 4);
    expect(res.byClass.covid19.precision).toBeCloseTo(1.0, 4);
    expect(res.byClass.pneumonia.recall).toBeCloseTo(1.0, 4);
    expect(res.byClass.pneumonia.precision).toBeCloseTo(10 / 12, 4);
  });

  it('evaluates realistic fixture analyses correctly', () => {
    const fixtureAnalyses = [
      {
        imageId: 'img_001',
        datasetLabel: 'covid19',
        source: 'figure1',
        bucket: 'hard',
        runA: {
          index: 1,
          imageQuality: 'ok',
          predictedClass: 'covid19',
          certainty: 'high',
          laterality: 'bilateral',
          zones: ['middle', 'lower'],
          patterns: ['ground_glass'],
          distribution: 'peripheral',
        },
        runB: {
          index: 1,
          imageQuality: 'ok',
          predictedClass: 'covid19',
          certainty: 'high',
          laterality: 'bilateral',
          zones: ['middle', 'lower'],
          patterns: ['ground_glass'],
          distribution: 'peripheral',
        },
        validation: { status: 'auto_passed', reasons: [] },
      },
      {
        imageId: 'img_002',
        datasetLabel: 'pneumonia',
        source: 'kermany',
        bucket: 'medium',
        runA: {
          index: 1,
          imageQuality: 'ok',
          predictedClass: 'pneumonia',
          certainty: 'medium',
          laterality: 'right',
          zones: ['lower'],
          patterns: ['consolidation'],
          distribution: 'focal_lobar',
        },
        runB: {
          index: 1,
          imageQuality: 'ok',
          predictedClass: 'normal', // Disagreement
          certainty: 'low',
          laterality: 'none',
          zones: [],
          patterns: ['clear_lungs'],
          distribution: 'none',
        },
        validation: { status: 'auto_rejected', reasons: ['RUNS_DISAGREE'] },
      },
    ];

    const fixtureDiff = [
      {
        imageId: 'img_001',
        trueClass: 'covid19',
        probs: { covid19: 0.85, pneumonia: 0.1, normal: 0.05 },
      },
      {
        imageId: 'img_002',
        trueClass: 'pneumonia',
        probs: { covid19: 0.05, pneumonia: 0.9, normal: 0.05 },
      },
    ];

    const report = evaluateAnalyses({
      analyses: fixtureAnalyses,
      difficultyItems: fixtureDiff,
      date: '2026-11-07T00:00:00.000Z',
    });

    expect(report.metadata.nImages).toBe(2);
    expect(report.quality.schemaValidOutputs).toBe(4);
    expect(report.quality.schemaValidRate).toBe(1.0);
    expect(report.quality.autoPassedCount).toBe(1);
    expect(report.quality.autoRejectedCount).toBe(1);

    // Run A got 2/2 correct
    expect(report.runA.correct).toBe(2);
    expect(report.runA.accuracy).toBe(1.0);

    // Run B got 1/2 correct
    expect(report.runB.correct).toBe(1);
    expect(report.runB.accuracy).toBe(0.5);

    // DenseNet baseline got 2/2
    expect(report.densenetBaseline.correct).toBe(2);
    expect(report.densenetBaseline.accuracy).toBe(1.0);

    // Markdown contains expected tables
    const md = formatAnalysisMarkdown(report);
    expect(md).toContain('### E2 — LLM Image Analysis');
    expect(md).toContain('LLM Run A');
    expect(md).toContain('DenseNet-121 Baseline');
  });
});
