/**
 * eval:ml — Evaluates DenseNet-121 out-of-fold predictions, per-source accuracy,
 * and dataset source-confound distributions (E4).
 *
 * Usage: node scripts/eval-ml.js [--difficulty <path>] [--catalog <path>] [--output <path>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { CLASS_IDS } from '@radiology/contracts';
import { wilsonInterval } from '../packages/engine/src/index.js';

function getGitSha() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Predict class from probabilities vector.
 */
export function getPredictedClass(probs) {
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
 * Empty 3x3 confusion matrix: matrix[trueClass][predictedClass].
 */
export function createEmptyConfusion() {
  const m = {};
  for (const tc of CLASS_IDS) {
    m[tc] = {};
    for (const pred of CLASS_IDS) {
      m[tc][pred] = 0;
    }
  }
  return m;
}

export function evaluateMlArtifacts({
  difficultyItems = [],
  catalogItems = [],
  date = new Date().toISOString(),
} = {}) {
  const gitSha = getGitSha();
  const totalImages = difficultyItems.length;

  const confAll = createEmptyConfusion();
  const confCatalog = createEmptyConfusion();

  let overallCorrect = 0;
  let catalogCorrect = 0;
  let catalogTotal = 0;

  const bySource = {};
  const byClassSource = {};
  const bucketBySource = {};
  const classBySource = {};

  for (const tc of CLASS_IDS) {
    classBySource[tc] = {};
  }

  for (const item of difficultyItems) {
    const trueClass = item.trueClass;
    const source = item.source || 'unknown';
    const bucket = item.bucket || 'unknown';
    const probs = item.probs;
    const inCatalog = Boolean(item.inCatalog);

    const predClass = getPredictedClass(probs);
    const isCorrect = predClass === trueClass;

    // Source tracking
    if (!bySource[source]) {
      bySource[source] = { total: 0, correct: 0 };
      bucketBySource[source] = { easy: 0, medium: 0, hard: 0, unknown: 0 };
    }
    bySource[source].total++;
    if (isCorrect) bySource[source].correct++;

    if (bucketBySource[source][bucket] !== undefined) {
      bucketBySource[source][bucket]++;
    } else {
      bucketBySource[source].unknown++;
    }

    // Class x Source tracking
    const csKey = `${trueClass} × ${source}`;
    if (!byClassSource[csKey]) {
      byClassSource[csKey] = { trueClass, source, total: 0, correct: 0 };
    }
    byClassSource[csKey].total++;
    if (isCorrect) byClassSource[csKey].correct++;

    // Share of class by source
    if (classBySource[trueClass]) {
      classBySource[trueClass][source] = (classBySource[trueClass][source] || 0) + 1;
    }

    // Confusion matrices
    if (CLASS_IDS.includes(trueClass) && CLASS_IDS.includes(predClass)) {
      confAll[trueClass][predClass]++;
      if (isCorrect) overallCorrect++;

      if (inCatalog) {
        catalogTotal++;
        confCatalog[trueClass][predClass]++;
        if (isCorrect) catalogCorrect++;
      }
    }
  }

  // Compute overall & per-class metrics
  const computeMetrics = (conf, total, correct) => {
    const byClass = {};
    for (const tc of CLASS_IDS) {
      const tp = conf[tc]?.[tc] || 0;
      let actual = 0;
      let predicted = 0;
      for (const other of CLASS_IDS) {
        actual += conf[tc]?.[other] || 0;
        predicted += conf[other]?.[tc] || 0;
      }
      const rec = wilsonInterval(tp, actual);
      const prec = wilsonInterval(tp, predicted);
      byClass[tc] = {
        tp,
        actualTotal: actual,
        predictedTotal: predicted,
        recall: rec.p,
        recallCi: { low: rec.low, high: rec.high },
        precision: prec.p,
        precisionCi: { low: prec.low, high: prec.high },
      };
    }
    const acc = wilsonInterval(correct, total);
    return {
      total,
      correct,
      accuracy: acc.p,
      accuracyCi: { low: acc.low, high: acc.high },
      byClass,
      confusion: conf,
    };
  };

  const overallMetrics = computeMetrics(confAll, totalImages, overallCorrect);
  const catalogMetrics = computeMetrics(confCatalog, catalogTotal, catalogCorrect);

  // Per-source results with Wilson CI
  const sourceMetrics = {};
  for (const [src, data] of Object.entries(bySource)) {
    const acc = wilsonInterval(data.correct, data.total);
    sourceMetrics[src] = {
      total: data.total,
      correct: data.correct,
      accuracy: acc.p,
      accuracyCi: { low: acc.low, high: acc.high },
    };
  }

  // Class x Source results with Wilson CI
  const classSourceMetrics = {};
  for (const [csKey, data] of Object.entries(byClassSource)) {
    const acc = wilsonInterval(data.correct, data.total);
    classSourceMetrics[csKey] = {
      trueClass: data.trueClass,
      source: data.source,
      total: data.total,
      correct: data.correct,
      accuracy: acc.p,
      accuracyCi: { low: acc.low, high: acc.high },
    };
  }

  // Class share by source (%)
  const classShareBySource = {};
  for (const [cls, srcMap] of Object.entries(classBySource)) {
    const classTotal = Object.values(srcMap).reduce((a, b) => a + b, 0);
    classShareBySource[cls] = { total: classTotal, sources: {} };
    for (const [src, cnt] of Object.entries(srcMap)) {
      classShareBySource[cls].sources[src] = {
        count: cnt,
        share: classTotal > 0 ? cnt / classTotal : null,
      };
    }
  }

  return {
    metadata: {
      command: 'npm run eval:ml',
      date,
      gitSha,
      totalImages,
      catalogSubsetCount: catalogTotal,
      catalogJsonCount: catalogItems.length,
    },
    overallOof: overallMetrics,
    catalogOof: catalogMetrics,
    bySource: sourceMetrics,
    byClassSource: classSourceMetrics,
    classShareBySource,
    bucketBySource,
  };
}

function fmtRate(p, ci) {
  if (p === null || p === undefined || Number.isNaN(p)) return 'N/A';
  if (!ci || ci.low === null) return `${(p * 100).toFixed(1)}%`;
  return `${(p * 100).toFixed(1)}% [${(ci.low * 100).toFixed(1)}%–${(ci.high * 100).toFixed(1)}%]`;
}

export function formatMlMarkdown(report) {
  const {
    metadata,
    overallOof,
    catalogOof,
    bySource,
    byClassSource,
    classShareBySource,
    bucketBySource,
  } = report;

  const lines = [
    `### E4 — ML (DenseNet-121) Out-of-Fold Performance & Confounder Analysis`,
    ``,
    `> Command: \`${metadata.command}\` | Total Images: ${metadata.totalImages} | Catalog Subset: ${metadata.catalogSubsetCount} | SHA: \`${metadata.gitSha}\``,
    ``,
    `#### 1. Out-of-Fold (OOF) Classification Accuracy`,
    `| Dataset Scope | N | Accuracy (Wilson 95% CI) | Covid-19 Recall / Prec | Pneumonia Recall / Prec | Normal Recall / Prec |`,
    `|---|---|---|---|---|---|`,
  ];

  const scopes = [
    { label: 'Full Dataset (OOF)', data: overallOof },
    { label: 'App Catalog (500 Cap)', data: catalogOof },
  ];

  for (const s of scopes) {
    const accStr = fmtRate(s.data.accuracy, s.data.accuracyCi);
    const cRec = fmtRate(s.data.byClass?.covid19?.recall);
    const cPrec = fmtRate(s.data.byClass?.covid19?.precision);
    const pRec = fmtRate(s.data.byClass?.pneumonia?.recall);
    const pPrec = fmtRate(s.data.byClass?.pneumonia?.precision);
    const nRec = fmtRate(s.data.byClass?.normal?.recall);
    const nPrec = fmtRate(s.data.byClass?.normal?.precision);
    lines.push(
      `| **${s.label}** | ${s.data.total} | ${accStr} | ${cRec} / ${cPrec} | ${pRec} / ${pPrec} | ${nRec} / ${nPrec} |`,
    );
  }

  lines.push('');
  lines.push('#### 2. Accuracy by Image Source');
  lines.push('| Source | N | Correct | Accuracy (Wilson 95% CI) |');
  lines.push('|---|---|---|---|');

  for (const [src, s] of Object.entries(bySource)) {
    lines.push(`| \`${src}\` | ${s.total} | ${s.correct} | ${fmtRate(s.accuracy, s.accuracyCi)} |`);
  }

  lines.push('');
  lines.push('#### 3. Accuracy by Class × Source');
  lines.push('| Class × Source | N | Correct | Accuracy (Wilson 95% CI) |');
  lines.push('|---|---|---|---|');

  for (const [csKey, cs] of Object.entries(byClassSource)) {
    lines.push(
      `| **${csKey}** | ${cs.total} | ${cs.correct} | ${fmtRate(cs.accuracy, cs.accuracyCi)} |`,
    );
  }

  lines.push('');
  lines.push('#### 4. Class Distribution by Source (Confounder Disclosure)');
  lines.push('| Disease Class | Total N | Sources Breakdown (Count & Class Share) |');
  lines.push('|---|---|---|');

  for (const [cls, data] of Object.entries(classShareBySource)) {
    const srcParts = Object.entries(data.sources)
      .map(([src, d]) => `\`${src}\`: ${d.count} (${(d.share * 100).toFixed(1)}%)`)
      .join(', ');
    lines.push(`| **${cls}** | ${data.total} | ${srcParts} |`);
  }

  lines.push('');
  lines.push('#### 5. Difficulty Bucket Distribution per Source');
  lines.push('| Source | Easy (%) | Medium (%) | Hard (%) | Total |');
  lines.push('|---|---|---|---|---|');

  for (const [src, b] of Object.entries(bucketBySource)) {
    const total = b.easy + b.medium + b.hard;
    const ePct = total > 0 ? ((b.easy / total) * 100).toFixed(1) + '%' : 'N/A';
    const mPct = total > 0 ? ((b.medium / total) * 100).toFixed(1) + '%' : 'N/A';
    const hPct = total > 0 ? ((b.hard / total) * 100).toFixed(1) + '%' : 'N/A';
    lines.push(
      `| \`${src}\` | ${b.easy} (${ePct}) | ${b.medium} (${mPct}) | ${b.hard} (${hPct}) | ${total} |`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

export async function run() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      difficulty: { type: 'string', default: 'ml/artifacts/difficulty.json' },
      catalog: { type: 'string', default: 'ml/artifacts/catalog.json' },
      output: { type: 'string', default: 'docs/evaluation/ml.json' },
    },
    strict: false,
  });

  const diffPath = values.difficulty;
  const catPath = values.catalog;
  const outputPath = values.output;

  let difficultyItems = [];
  if (fs.existsSync(diffPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(diffPath, 'utf8'));
      difficultyItems = Array.isArray(parsed) ? parsed : parsed.items || [];
    } catch {
      difficultyItems = [];
    }
  }

  let catalogItems = [];
  if (fs.existsSync(catPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(catPath, 'utf8'));
      catalogItems = Array.isArray(parsed) ? parsed : [];
    } catch {
      catalogItems = [];
    }
  }

  const report = evaluateMlArtifacts({ difficultyItems, catalogItems });

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Wrote ML per-source evaluation to ${outputPath}`);

  const md = formatMlMarkdown(report);
  console.log('\n' + md);
}

if (process.argv[1]?.endsWith('eval-ml.js')) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
