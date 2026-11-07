import { describe, it, expect } from 'vitest';
import {
  escapeCsvField,
  parseCsv,
  exportRubricCsv,
  scoreRubricCsv,
  evaluateQuestionPipeline,
  formatRubricMarkdown,
} from '../../../../scripts/eval-questions.js';

describe('eval-questions — Question Quality & Rubric Evaluation (T10)', () => {
  it('escapes and parses CSV fields correctly', () => {
    const raw = 'Normal, "Clear lungs", with comma';
    const escaped = escapeCsvField(raw);
    expect(escaped).toBe('"Normal, ""Clear lungs"", with comma"');

    const csvText = ['id,name,comment', '1,simple,none', '2,"quoted, value","multi\nline"'].join(
      '\n',
    );

    const rows = parseCsv(csvText);
    expect(rows.length).toBe(3);
    expect(rows[1]).toEqual(['1', 'simple', 'none']);
    expect(rows[2][1]).toBe('quoted, value');
    expect(rows[2][2]).toBe('multi\nline');
  });

  it('exportRubricCsv stratifies questions up to 8 per type with deterministic seed', () => {
    const mockQuestions = [];
    const types = ['finding', 'distribution', 'differential'];
    for (const t of types) {
      for (let i = 1; i <= 12; i++) {
        mockQuestions.push({
          stableId: `q_${t}_${i}`,
          type: t,
          status: 'approved',
          stem: `Stem for ${t} ${i}`,
          options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }, { text: 'D' }],
          correctIndex: 0,
          rationale: `Rationale for ${t} ${i}`,
        });
      }
    }

    const csv1 = exportRubricCsv({ questions: mockQuestions, seed: 42, maxPerType: 8 });
    const csv2 = exportRubricCsv({ questions: mockQuestions, seed: 42, maxPerType: 8 });

    // Deterministic output
    expect(csv1).toBe(csv2);

    const rows = parseCsv(csv1);
    // 1 header row + 3 * 8 = 24 question rows = 25 rows
    expect(rows.length).toBe(25);
    expect(rows[0]).toEqual([
      'id',
      'type',
      'stem',
      'options',
      'keyed_answer',
      'rationale',
      'scientific_ok',
      'clear',
      'distractors_plausible',
      'leak_free',
      'comment',
    ]);

    const findingCount = rows.slice(1).filter((r) => r[1] === 'finding').length;
    const distCount = rows.slice(1).filter((r) => r[1] === 'distribution').length;
    const diffCount = rows.slice(1).filter((r) => r[1] === 'differential').length;
    expect(findingCount).toBe(8);
    expect(distCount).toBe(8);
    expect(diffCount).toBe(8);
  });

  it('scoreRubricCsv aggregates filled ratings and computes Wilson CIs', () => {
    const fixtureCsv = [
      'id,type,stem,options,keyed_answer,rationale,scientific_ok,clear,distractors_plausible,leak_free,comment',
      'q1,finding,Stem 1,1) A | 2) B,1: A,Rat 1,1,5,4,1,Looks good',
      'q2,finding,Stem 2,1) A | 2) B,1: A,Rat 2,1,4,5,1,Accurate',
      'q3,distribution,Stem 3,1) A | 2) B,1: A,Rat 3,0,3,2,0,Scientific issue',
    ].join('\n');

    const res = scoreRubricCsv(fixtureCsv, { date: '2026-11-07T00:00:00.000Z' });
    expect(res.status).toBe('scored');
    expect(res.ratedCount).toBe(3);

    // Finding: 2 items, both scientific_ok=1 (100%), both leak_free=1 (100%)
    expect(res.byType.finding.scientificOkRate).toBe(1.0);
    expect(res.byType.finding.leakFreeRate).toBe(1.0);
    expect(res.byType.finding.clearMean).toBe(4.5);
    expect(res.byType.finding.distractorsMean).toBe(4.5);

    // Distribution: 1 item, scientific_ok=0 (0%), leak_free=0 (0%)
    expect(res.byType.distribution.scientificOkRate).toBe(0.0);
    expect(res.byType.distribution.clearMean).toBe(3.0);

    // Overall: 2/3 scientific_ok
    expect(res.overall.scientificOkRate).toBeCloseTo(2 / 3, 4);
    expect(res.overall.leakFreeRate).toBeCloseTo(2 / 3, 4);

    const md = formatRubricMarkdown(res);
    expect(md).toContain(
      'Rated by one non-expert reviewer (the system’s builder); results are indicative only.',
    );
    expect(md).toContain('OVERALL');
  });

  it('evaluateQuestionPipeline computes pipeline counts and rates', () => {
    const mockBank = [
      {
        status: 'approved',
        type: 'finding',
        edited: true,
        pair: { trueClass: 'covid19', confusedWith: 'pneumonia' },
      },
      {
        status: 'approved',
        type: 'distribution',
        edited: false,
        pair: { trueClass: 'pneumonia', confusedWith: 'normal' },
      },
      {
        status: 'rejected',
        type: 'differential',
        edited: false,
        pair: { trueClass: 'normal', confusedWith: 'pneumonia' },
      },
      {
        status: 'pending_review',
        type: 'finding',
        edited: false,
        pair: { trueClass: 'covid19', confusedWith: 'pneumonia' },
      },
    ];
    const mockAttempts = [
      { reasons: ['RULE_CLEAR_EXCLUSIVE', 'LABEL_MISMATCH'] },
      { reasons: ['RULE_CLEAR_EXCLUSIVE'] },
    ];

    const report = evaluateQuestionPipeline({
      bankItems: mockBank,
      attemptItems: mockAttempts,
    });

    expect(report.counts.total).toBe(4);
    expect(report.counts.approved).toBe(2);
    expect(report.counts.rejected).toBe(1);
    expect(report.counts.pending).toBe(1);
    expect(report.counts.edited).toBe(1);
    expect(report.counts.editRate).toBe(0.25);
    expect(report.counts.approvalRate).toBe(0.5);

    expect(report.byType.finding).toBe(1);
    expect(report.byType.distribution).toBe(1);

    expect(report.generationAttempts.totalAttempts).toBe(2);
    expect(report.generationAttempts.rejectionReasons.RULE_CLEAR_EXCLUSIVE).toBe(2);
    expect(report.generationAttempts.rejectionReasons.LABEL_MISMATCH).toBe(1);
  });
});
