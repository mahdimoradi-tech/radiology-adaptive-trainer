import { describe, it, expect } from 'vitest';
import { computeClassMetrics, topConfusions, buildReport, buildProgress } from '../metrics.js';

describe('Metrics module', () => {
  describe('Hand-computed unit test with 12 responses across 3 classes', () => {
    /**
     * Hand-computed arithmetic:
     * 12 answers across 3 classes (covid19, pneumonia, normal), 4 questions per ground-truth class.
     *
     * Responses:
     * - covid19 (4 questions):
     *   3 answered 'covid19' (TP for covid)
     *   1 answered 'pneumonia' (FN for covid, FP for pneumonia)
     *   0 answered 'normal'
     *
     * - pneumonia (4 questions):
     *   1 answered 'covid19' (FN for pna, FP for covid)
     *   2 answered 'pneumonia' (TP for pna)
     *   1 answered 'normal' (FN for pna, FP for normal)
     *
     * - normal (4 questions):
     *   0 answered 'covid19'
     *   1 answered 'pneumonia' (FN for normal, FP for pneumonia)
     *   3 answered 'normal' (TP for normal)
     *
     * Confusion Matrix:
     *                predicted: covid19  pneumonia  normal
     * true covid19                 3         1        0      = 4
     * true pneumonia               1         2        1      = 4
     * true normal                  0         1        3      = 4
     * Sum answers:                 4         4        4      = 12
     *
     * Class-level metrics (One-vs-Rest):
     * 1) covid19:
     *    TP = 3, FN = 1 (class total = 4)
     *    FP = 1 (1 from pneumonia), TN = 7 (3 pna not covid + 4 normal not covid)
     *    Negative total = FP + TN = 8
     *    accuracy = recall = TP / (TP + FN) = 3 / 4 = 0.75
     *    precision = TP / (TP + FP) = 3 / 4 = 0.75
     *    f1 = 2 * (0.75 * 0.75) / (0.75 + 0.75) = 0.75
     *    fpr = FP / (FP + TN) = 1 / 8 = 0.125
     *    fnr = FN / (TP + FN) = 1 / 4 = 0.25
     *
     * 2) pneumonia:
     *    TP = 2, FN = 2 (class total = 4)
     *    FP = 2 (1 from covid + 1 from normal), TN = 6 (3 covid not pna + 3 normal not pna)
     *    Negative total = FP + TN = 8
     *    accuracy = recall = TP / (TP + FN) = 2 / 4 = 0.50
     *    precision = TP / (TP + FP) = 2 / 4 = 0.50
     *    f1 = 2 * (0.50 * 0.50) / (0.50 + 0.50) = 0.50
     *    fpr = FP / (FP + TN) = 2 / 8 = 0.25
     *    fnr = FN / (TP + FN) = 2 / 4 = 0.50
     *
     * 3) normal:
     *    TP = 3, FN = 1 (class total = 4)
     *    FP = 1 (1 from pneumonia), TN = 7 (4 covid not normal + 3 pna not normal)
     *    Negative total = FP + TN = 8
     *    accuracy = recall = TP / (TP + FN) = 3 / 4 = 0.75
     *    precision = TP / (TP + FP) = 3 / 4 = 0.75
     *    f1 = 2 * (0.75 * 0.75) / (0.75 + 0.75) = 0.75
     *    fpr = FP / (FP + TN) = 1 / 8 = 0.125
     *    fnr = FN / (TP + FN) = 1 / 4 = 0.25
     */
    const responses = [
      // 4 covid19
      { trueClass: 'covid19', answer: 'covid19', bucket: 'easy' },
      { trueClass: 'covid19', answer: 'covid19', bucket: 'medium' },
      { trueClass: 'covid19', answer: 'covid19', bucket: 'hard' },
      { trueClass: 'covid19', answer: 'pneumonia', bucket: 'hard' },
      // 4 pneumonia
      { trueClass: 'pneumonia', answer: 'covid19', bucket: 'easy' },
      { trueClass: 'pneumonia', answer: 'pneumonia', bucket: 'easy' },
      { trueClass: 'pneumonia', answer: 'pneumonia', bucket: 'medium' },
      { trueClass: 'pneumonia', answer: 'normal', bucket: 'hard' },
      // 4 normal
      { trueClass: 'normal', answer: 'pneumonia', bucket: 'easy' },
      { trueClass: 'normal', answer: 'normal', bucket: 'medium' },
      { trueClass: 'normal', answer: 'normal', bucket: 'hard' },
      { trueClass: 'normal', answer: 'normal', bucket: 'hard' },
    ];

    it('computes exact hand-computed metrics for covid19', () => {
      const m = computeClassMetrics(responses, 'covid19');
      expect(m.tp).toBe(3);
      expect(m.fn).toBe(1);
      expect(m.fp).toBe(1);
      expect(m.tn).toBe(7);
      expect(m.accuracy).toBeCloseTo(0.75, 4);
      expect(m.recall).toBeCloseTo(0.75, 4);
      expect(m.precision).toBeCloseTo(0.75, 4);
      expect(m.f1).toBeCloseTo(0.75, 4);
      expect(m.fpr).toBeCloseTo(0.125, 4);
      expect(m.fnr).toBeCloseTo(0.25, 4);
    });

    it('computes exact hand-computed metrics for pneumonia', () => {
      const m = computeClassMetrics(responses, 'pneumonia');
      expect(m.tp).toBe(2);
      expect(m.fn).toBe(2);
      expect(m.fp).toBe(2);
      expect(m.tn).toBe(6);
      expect(m.accuracy).toBeCloseTo(0.5, 4);
      expect(m.recall).toBeCloseTo(0.5, 4);
      expect(m.precision).toBeCloseTo(0.5, 4);
      expect(m.f1).toBeCloseTo(0.5, 4);
      expect(m.fpr).toBeCloseTo(0.25, 4);
      expect(m.fnr).toBeCloseTo(0.5, 4);
    });

    it('computes exact hand-computed metrics for normal', () => {
      const m = computeClassMetrics(responses, 'normal');
      expect(m.tp).toBe(3);
      expect(m.fn).toBe(1);
      expect(m.fp).toBe(1);
      expect(m.tn).toBe(7);
      expect(m.accuracy).toBeCloseTo(0.75, 4);
      expect(m.recall).toBeCloseTo(0.75, 4);
      expect(m.precision).toBeCloseTo(0.75, 4);
      expect(m.f1).toBeCloseTo(0.75, 4);
      expect(m.fpr).toBeCloseTo(0.125, 4);
      expect(m.fnr).toBeCloseTo(0.25, 4);
    });
  });

  describe('topConfusions', () => {
    it('returns off-diagonal confusions sorted descending by frequency', () => {
      const responses = [
        { trueClass: 'covid19', answer: 'pneumonia' },
        { trueClass: 'covid19', answer: 'pneumonia' },
        { trueClass: 'covid19', answer: 'normal' },
        { trueClass: 'pneumonia', answer: 'covid19' },
        { trueClass: 'pneumonia', answer: 'pneumonia' }, // on-diagonal, skipped
      ];

      const top = topConfusions(responses);
      expect(top[0]).toEqual({ trueClass: 'covid19', predicted: 'pneumonia', count: 2 });
      expect(top.length).toBe(3);
      expect(top.every((tc) => tc.trueClass !== tc.predicted)).toBe(true);
    });
  });

  describe('buildReport', () => {
    it('builds complete report with review and bucket breakdowns', () => {
      const session = {
        _id: 'sess_hand_test',
        index: 1,
        kind: 'baseline',
        size: 3,
        questions: [
          {
            no: 1,
            imageId: 'img_1',
            publicId: 'pub_1',
            trueClass: 'covid19',
            bucket: 'easy',
            difficulty: 0.15,
            confusedWith: 'pneumonia',
          },
          {
            no: 2,
            imageId: 'img_2',
            publicId: 'pub_2',
            trueClass: 'pneumonia',
            bucket: 'medium',
            difficulty: 0.45,
            confusedWith: 'normal',
          },
          {
            no: 3,
            imageId: 'img_3',
            publicId: 'pub_3',
            trueClass: 'normal',
            bucket: 'hard',
            difficulty: 0.85,
            confusedWith: 'pneumonia',
          },
        ],
      };

      const responses = [
        {
          questionNo: 1,
          imageId: 'img_1',
          trueClass: 'covid19',
          answer: 'covid19',
          bucket: 'easy',
          correct: true,
        },
        {
          questionNo: 2,
          imageId: 'img_2',
          trueClass: 'pneumonia',
          answer: 'normal',
          bucket: 'medium',
          correct: false,
        },
      ];

      const report = buildReport({ session, responses, masteryThreshold: 0.8 });
      expect(report.sessionId).toBe('sess_hand_test');
      expect(report.answeredCount).toBe(2);
      expect(report.unansweredCount).toBe(1);
      expect(report.overall.correct).toBe(1);
      expect(report.overall.total).toBe(2);
      expect(report.overall.accuracy).toBe(0.5);

      // Review item for unanswered question #3 should have answer null and correct null
      expect(report.review).toHaveLength(3);
      expect(report.review[2].no).toBe(3);
      expect(report.review[2].answer).toBeNull();
      expect(report.review[2].correct).toBeNull();

      // Question 1 answered correctly
      expect(report.review[0].answer).toBe('covid19');
      expect(report.review[0].correct).toBe(true);
      expect(report.review[0].imageUrl).toBe('/api/images/pub_1/file');
    });

    it('handles zero answered questions gracefully without NaN', () => {
      const session = {
        _id: 'sess_empty',
        index: 1,
        kind: 'baseline',
        size: 60,
        questions: [],
      };
      const report = buildReport({ session, responses: [] });
      expect(report.answeredCount).toBe(0);
      expect(report.unansweredCount).toBe(60);
      expect(report.overall.accuracy).toBe(0);
      expect(report.mastered).toBe(false);
      expect(report.perClass.covid19.accuracy).toBe(0);
    });
  });

  describe('buildProgress', () => {
    it('aggregates multiple finished sessions into progress trajectory', () => {
      const finishedSessions = [
        {
          _id: 's1',
          index: 1,
          kind: 'baseline',
          finishedAt: new Date('2026-11-01T10:00:00Z'),
          metrics: {
            overall: { accuracy: 0.7 },
            perClass: {
              covid19: { accuracy: 0.6, fpr: 0.1, fnr: 0.4 },
              pneumonia: { accuracy: 0.8, fpr: 0.05, fnr: 0.2 },
              normal: { accuracy: 0.7, fpr: 0.05, fnr: 0.3 },
            },
            mastered: false,
          },
        },
      ];

      const allResponses = [
        { trueClass: 'covid19', answer: 'pneumonia', imageId: 'c1', bucket: 'easy' },
        { trueClass: 'pneumonia', answer: 'pneumonia', imageId: 'p1', bucket: 'medium' },
      ];

      const prog = buildProgress({ finishedSessions, allFinishedResponses: allResponses });
      expect(prog.totals.sessionsFinished).toBe(1);
      expect(prog.totals.answered).toBe(2);
      expect(prog.sessions).toHaveLength(1);
      expect(prog.sessions[0].overallAccuracy).toBe(0.7);
      expect(prog.currentWeights.covid19).toBeGreaterThan(prog.currentWeights.normal);
      expect(prog.currentWeights.pneumonia).toBeGreaterThan(prog.currentWeights.normal);
    });
  });
});
