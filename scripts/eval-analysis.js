/**
 * eval:analysis — Evaluates LLM image analysis against dataset ground truth labels
 * and compares against the DenseNet-121 ML baseline on the same images.
 *
 * Works without MongoDB by reading apps/api/seed/image-analyses.json and
 * ml/artifacts/difficulty.json (or catalog.json).
 *
 * Usage: node scripts/eval-analysis.js [--analyses <path>] [--difficulty <path>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { CLASS_IDS } from '@radiology/contracts';
import { ImageAnalysisResultSchema } from '../packages/contracts/src/vocabulary.js';
import { wilsonInterval, cohenKappa } from '../packages/engine/src/index.js';

function getGitSha() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Extract predicted class from DenseNet-121 probability vector.
 * @param {Record<string, number>} probs
 * @returns {string | null}
 */
export function getDensenetPrediction(probs) {
  if (!probs || typeof probs !== 'object') return null;
  let maxP = -Infinity;
  let pred = null;
  for (const [cls, p] of Object.entries(probs)) {
    if (typeof p === 'number' && p > maxP) {
      maxP = p;
      pred = cls;
    }
  }
  return pred;
}

/**
 * Builds empty 3x3 confusion matrix: matrix[trueClass][predictedClass].
 */
export function createEmptyConfusionMatrix() {
  /** @type {Record<string, Record<string, number>>} */
  const m = {};
  for (const tc of CLASS_IDS) {
    m[tc] = {};
    for (const pred of CLASS_IDS) {
      m[tc][pred] = 0;
    }
  }
  return m;
}

/**
 * Compute accuracy, per-class recall, and precision from a confusion matrix.
 */
export function computeClassMetrics(confusion) {
  let totalAll = 0;
  let correctAll = 0;
  const byClass = {};

  for (const tc of CLASS_IDS) {
    let tp = confusion[tc]?.[tc] || 0;
    let actualTotal = 0;
    for (const pred of CLASS_IDS) {
      actualTotal += confusion[tc]?.[pred] || 0;
    }
    let predictedTotal = 0;
    for (const otherTc of CLASS_IDS) {
      predictedTotal += confusion[otherTc]?.[tc] || 0;
    }

    totalAll += actualTotal;
    correctAll += tp;

    const recallInterval = wilsonInterval(tp, actualTotal);
    const precisionInterval = wilsonInterval(tp, predictedTotal);

    byClass[tc] = {
      tp,
      actualTotal,
      predictedTotal,
      recall: recallInterval.p,
      recallCi: { low: recallInterval.low, high: recallInterval.high },
      precision: precisionInterval.p,
      precisionCi: { low: precisionInterval.low, high: precisionInterval.high },
    };
  }

  const overallInterval = wilsonInterval(correctAll, totalAll);

  return {
    total: totalAll,
    correct: correctAll,
    accuracy: overallInterval.p,
    accuracyCi: { low: overallInterval.low, high: overallInterval.high },
    byClass,
    confusion,
  };
}

/**
 * Evaluates image analysis records against ground truth and ML baseline.
 *
 * @param {Object} options
 * @param {any[]} options.analyses
 * @param {any[]} [options.difficultyItems=[]]
 * @param {string} [options.date]
 * @returns {Object}
 */
export function evaluateAnalyses({
  analyses = [],
  difficultyItems = [],
  date = new Date().toISOString(),
} = {}) {
  const gitSha = getGitSha();
  const diffMap = new Map();
  for (const item of difficultyItems) {
    const key = item.imageId || item.id;
    if (key) diffMap.set(key, item);
  }

  const nImages = analyses.length;
  let totalRunOutputs = 0;
  let schemaValidOutputs = 0;

  let autoPassedCount = 0;
  let autoRejectedCount = 0;

  const confA = createEmptyConfusionMatrix();
  const confB = createEmptyConfusionMatrix();
  const confConsensus = createEmptyConfusionMatrix();
  const agreementMatrix = createEmptyConfusionMatrix();

  const bySource = {};
  const byBucket = {};

  let densenetTotal = 0;
  let densenetCorrect = 0;
  const densenetConf = createEmptyConfusionMatrix();

  for (const item of analyses) {
    const trueClass = item.datasetLabel || item.trueClass;
    const bucket = item.bucket || 'unknown';
    const source = item.source || 'unknown';

    if (!bySource[source]) {
      bySource[source] = { total: 0, correctA: 0, correctB: 0 };
    }
    if (!byBucket[bucket]) {
      byBucket[bucket] = { total: 0, correctA: 0, correctB: 0 };
    }
    bySource[source].total++;
    byBucket[bucket].total++;

    if (item.validation?.status === 'auto_passed') {
      autoPassedCount++;
    } else if (item.validation?.status === 'auto_rejected') {
      autoRejectedCount++;
    }

    // Run A
    if (item.runA) {
      totalRunOutputs++;
      if (ImageAnalysisResultSchema.safeParse(item.runA).success) {
        schemaValidOutputs++;
      }
      const predA = item.runA.predictedClass;
      if (CLASS_IDS.includes(trueClass) && CLASS_IDS.includes(predA)) {
        confA[trueClass][predA]++;
        if (predA === trueClass) {
          bySource[source].correctA++;
          byBucket[bucket].correctA++;
        }
      }
    }

    // Run B
    if (item.runB) {
      totalRunOutputs++;
      if (ImageAnalysisResultSchema.safeParse(item.runB).success) {
        schemaValidOutputs++;
      }
      const predB = item.runB.predictedClass;
      if (CLASS_IDS.includes(trueClass) && CLASS_IDS.includes(predB)) {
        confB[trueClass][predB]++;
        if (predB === trueClass) {
          bySource[source].correctB++;
          byBucket[bucket].correctB++;
        }
      }
    }

    // Paired agreement (Run A vs Run B)
    if (item.runA?.predictedClass && item.runB?.predictedClass) {
      const pA = item.runA.predictedClass;
      const pB = item.runB.predictedClass;
      if (CLASS_IDS.includes(pA) && CLASS_IDS.includes(pB)) {
        agreementMatrix[pA][pB]++;
      }
    }

    // Consensus (when both agree or auto_passed)
    if (item.runA?.predictedClass && item.runA.predictedClass === item.runB?.predictedClass) {
      const predC = item.runA.predictedClass;
      if (CLASS_IDS.includes(trueClass) && CLASS_IDS.includes(predC)) {
        confConsensus[trueClass][predC]++;
      }
    }

    // DenseNet-121 baseline on the SAME image
    const mlEntry = diffMap.get(item.imageId);
    if (mlEntry?.probs && CLASS_IDS.includes(trueClass)) {
      const mlPred = getDensenetPrediction(mlEntry.probs);
      if (mlPred && CLASS_IDS.includes(mlPred)) {
        densenetTotal++;
        densenetConf[trueClass][mlPred]++;
        if (mlPred === trueClass) {
          densenetCorrect++;
        }
      }
    }
  }

  const metricsA = computeClassMetrics(confA);
  const metricsB = computeClassMetrics(confB);
  const metricsConsensus = computeClassMetrics(confConsensus);
  const metricsDensenet = computeClassMetrics(densenetConf);

  const kappaRes = cohenKappa(agreementMatrix);
  const schemaValidWilson = wilsonInterval(schemaValidOutputs, totalRunOutputs);
  const passRateWilson = wilsonInterval(autoPassedCount, autoPassedCount + autoRejectedCount);

  // Source breakdown metrics
  const sourceBreakdown = {};
  for (const [src, sStats] of Object.entries(bySource)) {
    const ciA = wilsonInterval(sStats.correctA, sStats.total);
    const ciB = wilsonInterval(sStats.correctB, sStats.total);
    sourceBreakdown[src] = {
      total: sStats.total,
      accuracyA: ciA.p,
      accuracyCiA: { low: ciA.low, high: ciA.high },
      accuracyB: ciB.p,
      accuracyCiB: { low: ciB.low, high: ciB.high },
    };
  }

  // Bucket breakdown metrics
  const bucketBreakdown = {};
  for (const [bkt, bStats] of Object.entries(byBucket)) {
    const ciA = wilsonInterval(bStats.correctA, bStats.total);
    const ciB = wilsonInterval(bStats.correctB, bStats.total);
    bucketBreakdown[bkt] = {
      total: bStats.total,
      accuracyA: ciA.p,
      accuracyCiA: { low: ciA.low, high: ciA.high },
      accuracyB: ciB.p,
      accuracyCiB: { low: ciB.low, high: ciB.high },
    };
  }

  return {
    metadata: {
      command: 'npm run eval:analysis',
      date,
      gitSha,
      nImages,
      totalRunOutputs,
    },
    quality: {
      schemaValidOutputs,
      totalRunOutputs,
      schemaValidRate: schemaValidWilson.p,
      schemaValidCi: { low: schemaValidWilson.low, high: schemaValidWilson.high },
      autoPassedCount,
      autoRejectedCount,
      passRate: passRateWilson.p,
      passRateCi: { low: passRateWilson.low, high: passRateWilson.high },
    },
    agreement: {
      matrix: agreementMatrix,
      rawAgreement: kappaRes.po,
      cohenKappa: kappaRes.kappa,
    },
    runA: metricsA,
    runB: metricsB,
    consensus: metricsConsensus,
    densenetBaseline: {
      total: densenetTotal,
      correct: densenetCorrect,
      accuracy: metricsDensenet.accuracy,
      accuracyCi: metricsDensenet.accuracyCi,
      confusion: densenetConf,
      byClass: metricsDensenet.byClass,
    },
    breakdown: {
      bySource: sourceBreakdown,
      byBucket: bucketBreakdown,
    },
  };
}

function fmtRate(p, ci) {
  if (p === null || p === undefined || Number.isNaN(p)) return 'N/A';
  if (!ci || ci.low === null) return `${(p * 100).toFixed(1)}%`;
  return `${(p * 100).toFixed(1)}% [${(ci.low * 100).toFixed(1)}%-${(ci.high * 100).toFixed(1)}%]`;
}

export function formatAnalysisMarkdown(report) {
  const { metadata, quality, agreement, runA, runB, consensus, densenetBaseline, breakdown } =
    report;

  const lines = [
    `### E2 - LLM Image Analysis vs Dataset Ground Truth`,
    ``,
    `> Command: \`${metadata.command}\` | Images: ${metadata.nImages} | SHA: \`${metadata.gitSha}\``,
    ``,
    `#### Summary Quality & Reliability`,
    `- **Schema-valid rate:** ${fmtRate(quality.schemaValidRate, quality.schemaValidCi)} (${quality.schemaValidOutputs}/${quality.totalRunOutputs})`,
    `- **Auto-validation pass rate:** ${fmtRate(quality.passRate, quality.passRateCi)} (${quality.autoPassedCount}/${quality.autoPassedCount + quality.autoRejectedCount})`,
    `- **Run A vs Run B Raw Agreement:** ${fmtRate(agreement.rawAgreement)}`,
    `- **Run A vs Run B Cohen's Kappa:** ${agreement.cohenKappa !== null ? agreement.cohenKappa.toFixed(3) : 'N/A'}`,
    ``,
    `#### Diagnostic Accuracy vs Dataset Labels`,
    `| Evaluation Target | N | Accuracy (Wilson 95% CI) | Covid-19 Recall / Prec | Pneumonia Recall / Prec | Normal Recall / Prec |`,
    `|---|---|---|---|---|---|`,
  ];

  const targets = [
    { label: 'LLM Run A', data: runA },
    { label: 'LLM Run B', data: runB },
    { label: 'LLM Consensus (Agreed)', data: consensus },
    { label: 'DenseNet-121 Baseline (Same Images)', data: densenetBaseline },
  ];

  for (const t of targets) {
    const accStr = fmtRate(t.data.accuracy, t.data.accuracyCi);
    const cRec = fmtRate(t.data.byClass?.covid19?.recall);
    const cPrec = fmtRate(t.data.byClass?.covid19?.precision);
    const pRec = fmtRate(t.data.byClass?.pneumonia?.recall);
    const pPrec = fmtRate(t.data.byClass?.pneumonia?.precision);
    const nRec = fmtRate(t.data.byClass?.normal?.recall);
    const nPrec = fmtRate(t.data.byClass?.normal?.precision);

    lines.push(
      `| **${t.label}** | ${t.data.total} | ${accStr} | ${cRec} / ${cPrec} | ${pRec} / ${pPrec} | ${nRec} / ${nPrec} |`,
    );
  }

  lines.push('');
  lines.push('#### Breakdown by Image Source & Bucket');
  lines.push('| Category | Key | N | Run A Accuracy (95% CI) | Run B Accuracy (95% CI) |');
  lines.push('|---|---|---|---|---|');

  for (const [src, s] of Object.entries(breakdown.bySource)) {
    lines.push(
      `| Source | \`${src}\` | ${s.total} | ${fmtRate(s.accuracyA, s.accuracyCiA)} | ${fmtRate(s.accuracyB, s.accuracyCiB)} |`,
    );
  }
  for (const [bkt, b] of Object.entries(breakdown.byBucket)) {
    lines.push(
      `| Bucket | \`${bkt}\` | ${b.total} | ${fmtRate(b.accuracyA, b.accuracyCiA)} | ${fmtRate(b.accuracyB, b.accuracyCiB)} |`,
    );
  }

  if (
    Object.keys(breakdown.bySource).length === 0 &&
    Object.keys(breakdown.byBucket).length === 0
  ) {
    lines.push('| None | N/A | 0 | N/A | N/A |');
  }

  lines.push('');
  return lines.join('\n');
}

export async function run() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      analyses: { type: 'string', default: 'apps/api/seed/image-analyses.json' },
      difficulty: { type: 'string', default: 'ml/artifacts/difficulty.json' },
      output: { type: 'string', default: 'docs/evaluation/analysis.json' },
    },
    strict: false,
  });

  const analysesPath = values.analyses;
  const diffPath = values.difficulty;
  const outputPath = values.output;

  let analyses = [];
  if (fs.existsSync(analysesPath)) {
    try {
      analyses = JSON.parse(fs.readFileSync(analysesPath, 'utf8'));
    } catch {
      analyses = [];
    }
  }

  let difficultyItems = [];
  if (fs.existsSync(diffPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(diffPath, 'utf8'));
      difficultyItems = Array.isArray(parsed) ? parsed : parsed.items || [];
    } catch {
      difficultyItems = [];
    }
  }

  const report = evaluateAnalyses({ analyses, difficultyItems });

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Wrote image analysis evaluation data to ${outputPath}`);

  const md = formatAnalysisMarkdown(report);
  console.log('\n' + md);
}

if (process.argv[1]?.endsWith('eval-analysis.js')) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
