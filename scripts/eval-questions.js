/**
 * eval:questions — Question quality rubric export & scoring (E3), plus question
 * pipeline statistics.
 *
 * Sub-commands:
 *   node scripts/eval-questions.js export-rubric [--input <bank.json>] [--output <rubric.csv>]
 *   node scripts/eval-questions.js score [<rubric.csv>] [--output <output.json>]
 *   node scripts/eval-questions.js [pipeline]
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { createRng, wilsonInterval } from '../packages/engine/src/index.js';

function getGitSha() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export function escapeCsvField(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Robust CSV parser that respects RFC 4180 quotes.
 * @param {string} csvText
 * @returns {string[][]}
 */
export function parseCsv(csvText) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (insideQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r') {
        // Skip CR
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim().length > 0));
}

/**
 * Stratified sampling of up to 24 questions (8 per type) with fixed seed.
 */
export function exportRubricCsv({ questions = [], seed = 42, maxPerType = 8 } = {}) {
  const types = ['finding', 'distribution', 'differential'];
  const rng = createRng(seed);

  const selected = [];
  for (const t of types) {
    const ofType = questions.filter((q) => q.type === t && q.status === 'approved');
    rng.shuffle(ofType);
    selected.push(...ofType.slice(0, maxPerType));
  }

  const headers = [
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
  ];

  const rows = [headers.join(',')];

  for (const q of selected) {
    const id = q.stableId || q.id || '';
    const type = q.type || '';
    const stem = q.stem || '';
    const optsStr = Array.isArray(q.options)
      ? q.options.map((o, idx) => `${idx + 1}) ${o.text}`).join(' | ')
      : '';
    const correctOpt = Array.isArray(q.options) ? q.options[q.correctIndex]?.text || '' : '';
    const keyed = `${(q.correctIndex ?? 0) + 1}: ${correctOpt}`;
    const rationale = q.rationale || '';

    const row = [
      escapeCsvField(id),
      escapeCsvField(type),
      escapeCsvField(stem),
      escapeCsvField(optsStr),
      escapeCsvField(keyed),
      escapeCsvField(rationale),
      '', // scientific_ok (0/1)
      '', // clear (1-5)
      '', // distractors_plausible (1-5)
      '', // leak_free (0/1)
      '', // comment
    ];
    rows.push(row.join(','));
  }

  return rows.join('\n') + '\n';
}

function computeMeanStd(nums) {
  if (!nums || nums.length === 0) return { mean: null, std: null, n: 0 };
  const n = nums.length;
  const mean = nums.reduce((acc, v) => acc + v, 0) / n;
  const variance = n > 1 ? nums.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1) : 0;
  return { mean, std: Math.sqrt(variance), n };
}

/**
 * Score human-rated CSV rubric.
 */
export function scoreRubricCsv(csvContent, { date = new Date().toISOString() } = {}) {
  const rows = parseCsv(csvContent);
  if (rows.length <= 1) {
    return {
      metadata: {
        command: 'npm run eval:questions score',
        date,
        gitSha: getGitSha(),
        note: "Rated by one non-expert reviewer (the system's builder); results are indicative only.",
      },
      status: 'pending_review',
      ratedCount: 0,
      types: {},
      overall: null,
    };
  }

  const headers = rows[0].map((h) => h.trim());
  const colIndex = {
    id: headers.indexOf('id'),
    type: headers.indexOf('type'),
    scientific_ok: headers.indexOf('scientific_ok'),
    clear: headers.indexOf('clear'),
    distractors_plausible: headers.indexOf('distractors_plausible'),
    leak_free: headers.indexOf('leak_free'),
    comment: headers.indexOf('comment'),
  };

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const sciStr = row[colIndex.scientific_ok]?.trim();
    const clrStr = row[colIndex.clear]?.trim();
    const distStr = row[colIndex.distractors_plausible]?.trim();
    const leakStr = row[colIndex.leak_free]?.trim();

    // Skip unrated rows where all rating columns are empty
    if (!sciStr && !clrStr && !distStr && !leakStr) {
      continue;
    }

    records.push({
      id: row[colIndex.id] || `row_${i}`,
      type: row[colIndex.type] || 'unknown',
      scientificOk: sciStr !== '' ? parseInt(sciStr, 10) : null,
      clear: clrStr !== '' ? parseFloat(clrStr) : null,
      distractorsPlausible: distStr !== '' ? parseFloat(distStr) : null,
      leakFree: leakStr !== '' ? parseInt(leakStr, 10) : null,
      comment: row[colIndex.comment] || '',
    });
  }

  if (records.length === 0) {
    return {
      metadata: {
        command: 'npm run eval:questions score',
        date,
        gitSha: getGitSha(),
        note: "Rated by one non-expert reviewer (the system's builder); results are indicative only.",
      },
      status: 'pending_review',
      ratedCount: 0,
      types: {},
      overall: null,
    };
  }

  // Aggregate by type and overall
  const byType = {};
  const allTypes = [...new Set(records.map((r) => r.type))];

  for (const t of allTypes) {
    const subset = records.filter((r) => r.type === t);
    const sciOk = subset.filter((r) => r.scientificOk === 1).length;
    const sciTotal = subset.filter((r) => r.scientificOk !== null).length;
    const sciCi = wilsonInterval(sciOk, sciTotal);

    const leakOk = subset.filter((r) => r.leakFree === 1).length;
    const leakTotal = subset.filter((r) => r.leakFree !== null).length;
    const leakCi = wilsonInterval(leakOk, leakTotal);

    const clearStats = computeMeanStd(
      subset.map((r) => r.clear).filter((v) => v !== null && !Number.isNaN(v)),
    );
    const distStats = computeMeanStd(
      subset.map((r) => r.distractorsPlausible).filter((v) => v !== null && !Number.isNaN(v)),
    );

    byType[t] = {
      n: subset.length,
      scientificOkRate: sciCi.p,
      scientificOkCi: { low: sciCi.low, high: sciCi.high },
      scientificOkCount: sciOk,
      scientificOkTotal: sciTotal,
      leakFreeRate: leakCi.p,
      leakFreeCi: { low: leakCi.low, high: leakCi.high },
      clearMean: clearStats.mean,
      clearStd: clearStats.std,
      distractorsMean: distStats.mean,
      distractorsStd: distStats.std,
    };
  }

  // Overall
  const sciOkAll = records.filter((r) => r.scientificOk === 1).length;
  const sciTotalAll = records.filter((r) => r.scientificOk !== null).length;
  const sciCiAll = wilsonInterval(sciOkAll, sciTotalAll);

  const leakOkAll = records.filter((r) => r.leakFree === 1).length;
  const leakTotalAll = records.filter((r) => r.leakFree !== null).length;
  const leakCiAll = wilsonInterval(leakOkAll, leakTotalAll);

  const clearAll = computeMeanStd(
    records.map((r) => r.clear).filter((v) => v !== null && !Number.isNaN(v)),
  );
  const distAll = computeMeanStd(
    records.map((r) => r.distractorsPlausible).filter((v) => v !== null && !Number.isNaN(v)),
  );

  return {
    metadata: {
      command: 'npm run eval:questions score',
      date,
      gitSha: getGitSha(),
      note: "Rated by one non-expert reviewer (the system's builder); results are indicative only.",
    },
    status: 'scored',
    ratedCount: records.length,
    byType,
    overall: {
      n: records.length,
      scientificOkRate: sciCiAll.p,
      scientificOkCi: { low: sciCiAll.low, high: sciCiAll.high },
      scientificOkCount: sciOkAll,
      scientificOkTotal: sciTotalAll,
      leakFreeRate: leakCiAll.p,
      leakFreeCi: { low: leakCiAll.low, high: leakCiAll.high },
      clearMean: clearAll.mean,
      clearStd: clearAll.std,
      distractorsMean: distAll.mean,
      distractorsStd: distAll.std,
    },
  };
}

/**
 * Question generation and review pipeline statistics.
 */
export function evaluateQuestionPipeline({
  bankItems = [],
  attemptItems = [],
  date = new Date().toISOString(),
} = {}) {
  const total = bankItems.length;
  const approved = bankItems.filter((q) => q.status === 'approved').length;
  const pending = bankItems.filter((q) => q.status === 'pending_review').length;
  const rejected = bankItems.filter((q) => q.status === 'rejected').length;
  const edited = bankItems.filter((q) => q.edited).length;

  const editRate = total > 0 ? edited / total : null;
  const approvalRate = total > 0 ? approved / total : null;

  // Types breakdown (approved)
  const approvedItems = bankItems.filter((q) => q.status === 'approved');
  const byType = {
    finding: approvedItems.filter((q) => q.type === 'finding').length,
    distribution: approvedItems.filter((q) => q.type === 'distribution').length,
    differential: approvedItems.filter((q) => q.type === 'differential').length,
  };

  // Pairs breakdown (approved)
  const byPair = {};
  for (const q of approvedItems) {
    if (q.pair?.trueClass && q.pair?.confusedWith) {
      const key = `${q.pair.trueClass} -> ${q.pair.confusedWith}`;
      byPair[key] = (byPair[key] || 0) + 1;
    }
  }

  // Generation rejections tally
  const rejectionReasons = {};
  for (const a of attemptItems) {
    if (Array.isArray(a.reasons)) {
      for (const r of a.reasons) {
        rejectionReasons[r] = (rejectionReasons[r] || 0) + 1;
      }
    }
  }

  return {
    metadata: {
      command: 'npm run eval:questions',
      date,
      gitSha: getGitSha(),
      totalQuestions: total,
    },
    counts: {
      total,
      pending,
      approved,
      rejected,
      edited,
      editRate,
      approvalRate,
    },
    byType,
    byPair,
    generationAttempts: {
      totalAttempts: attemptItems.length,
      rejectionReasons,
    },
  };
}

function fmtRate(p, ci) {
  if (p === null || p === undefined || Number.isNaN(p)) return 'N/A';
  if (!ci || ci.low === null) return `${(p * 100).toFixed(1)}%`;
  return `${(p * 100).toFixed(1)}% [${(ci.low * 100).toFixed(1)}%-${(ci.high * 100).toFixed(1)}%]`;
}

function fmtScore(mean, std) {
  if (mean === null || mean === undefined || Number.isNaN(mean)) return 'N/A';
  if (std === null || std === undefined) return mean.toFixed(2);
  return `${mean.toFixed(2)} +/- ${std.toFixed(2)}`;
}

export function formatRubricMarkdown(rubricReport) {
  const lines = [
    `### E3 - Question Bank Quality & Rubric Evaluation`,
    ``,
    `> **Note:** ${rubricReport.metadata?.note || "Rated by one non-expert reviewer (the system's builder); results are indicative only."}`,
    `> Command: \`${rubricReport.metadata?.command}\` | Rated: ${rubricReport.ratedCount} | SHA: \`${rubricReport.metadata?.gitSha}\``,
    ``,
  ];

  if (rubricReport.status === 'pending_review' || rubricReport.ratedCount === 0) {
    lines.push(
      `_Rubric rating is pending manual review in \`docs/evaluation/question-rubric.csv\`._`,
    );
    lines.push('');
    return lines.join('\n');
  }

  lines.push(
    `| Question Type | N | Scientific OK (Wilson 95% CI) | Clarity (1-5) | Distractor Plausibility (1-5) | Leak-Free (Wilson 95% CI) |`,
  );
  lines.push(`|---|---|---|---|---|---|`);

  for (const [type, stats] of Object.entries(rubricReport.byType)) {
    lines.push(
      `| \`${type}\` | ${stats.n} | ${fmtRate(stats.scientificOkRate, stats.scientificOkCi)} | ${fmtScore(stats.clearMean, stats.clearStd)} | ${fmtScore(stats.distractorsMean, stats.distractorsStd)} | ${fmtRate(stats.leakFreeRate, stats.leakFreeCi)} |`,
    );
  }

  if (rubricReport.overall) {
    const ov = rubricReport.overall;
    lines.push(
      `| **OVERALL** | **${ov.n}** | **${fmtRate(ov.scientificOkRate, ov.scientificOkCi)}** | **${fmtScore(ov.clearMean, ov.clearStd)}** | **${fmtScore(ov.distractorsMean, ov.distractorsStd)}** | **${fmtRate(ov.leakFreeRate, ov.leakFreeCi)}** |`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

export function formatPipelineMarkdown(pipelineReport) {
  const { counts, byType, byPair, generationAttempts } = pipelineReport;
  const lines = [
    `#### Question Generation Pipeline Statistics`,
    `- **Total questions in bank:** ${counts.total}`,
    `- **Approved:** ${counts.approved} (${counts.approvalRate !== null ? (counts.approvalRate * 100).toFixed(1) + '%' : 'N/A'})`,
    `- **Pending review:** ${counts.pending}`,
    `- **Rejected by instructor:** ${counts.rejected}`,
    `- **Edited by instructor:** ${counts.edited} (${counts.editRate !== null ? (counts.editRate * 100).toFixed(1) + '%' : 'N/A'})`,
    ``,
    `##### Approved Questions by Type`,
    `| Finding | Distribution | Differential |`,
    `|---|---|---|`,
    `| ${byType.finding} | ${byType.distribution} | ${byType.differential} |`,
    ``,
    `##### Approved Questions by Confusion Pair`,
    `| Confusion Pair | Count |`,
    `|---|---|`,
  ];

  if (Object.keys(byPair).length === 0) {
    lines.push(`| None | 0 |`);
  } else {
    for (const [pair, cnt] of Object.entries(byPair)) {
      lines.push(`| \`${pair}\` | ${cnt} |`);
    }
  }

  lines.push('');
  lines.push(`##### Generation Attempts & Automatic Rejections`);
  lines.push(`- **Total logged rejected attempts:** ${generationAttempts.totalAttempts}`);
  if (Object.keys(generationAttempts.rejectionReasons).length > 0) {
    lines.push(`| Rule / Reason | Rejections |`);
    lines.push(`|---|---|`);
    for (const [rule, cnt] of Object.entries(generationAttempts.rejectionReasons)) {
      lines.push(`| \`${rule}\` | ${cnt} |`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

export async function run() {
  const args = process.argv.slice(2);
  const subCommand = args[0]?.startsWith('--') ? 'pipeline' : args[0] || 'pipeline';

  if (subCommand === 'export-rubric') {
    const { values } = parseArgs({
      args: args.slice(1),
      options: {
        input: { type: 'string', default: 'apps/api/seed/question-bank.approved.json' },
        output: { type: 'string', default: 'docs/evaluation/question-rubric.csv' },
        seed: { type: 'string', default: '42' },
      },
      strict: false,
    });

    let questions = [];
    if (fs.existsSync(values.input)) {
      try {
        questions = JSON.parse(fs.readFileSync(values.input, 'utf8'));
      } catch {
        questions = [];
      }
    }

    const csv = exportRubricCsv({
      questions,
      seed: parseInt(values.seed, 10) || 42,
    });

    const dir = path.dirname(values.output);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(values.output, csv, 'utf8');
    console.log(
      `Exported question rubric template (${questions.length} available) to ${values.output}`,
    );
    return;
  }

  if (subCommand === 'score') {
    const csvPath =
      args[1] && !args[1].startsWith('--') ? args[1] : 'docs/evaluation/question-rubric.csv';
    const outputPath = 'docs/evaluation/questions-rubric.json';

    let csvContent = '';
    if (fs.existsSync(csvPath)) {
      csvContent = fs.readFileSync(csvPath, 'utf8');
    }

    const report = scoreRubricCsv(csvContent);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`Scored rubric CSV from ${csvPath} -> ${outputPath}`);
    console.log('\n' + formatRubricMarkdown(report));
    return;
  }

  // Default: Pipeline statistics + Rubric score if CSV present
  const bankPath = 'apps/api/seed/question-bank.approved.json';
  let bankItems = [];
  if (fs.existsSync(bankPath)) {
    try {
      bankItems = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
    } catch {
      bankItems = [];
    }
  }

  const pipelineReport = evaluateQuestionPipeline({ bankItems });
  const pipelineOutput = 'docs/evaluation/questions-pipeline.json';
  const dir = path.dirname(pipelineOutput);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(pipelineOutput, JSON.stringify(pipelineReport, null, 2), 'utf8');

  console.log(`Wrote question pipeline evaluation to ${pipelineOutput}`);
  console.log('\n' + formatPipelineMarkdown(pipelineReport));

  const rubricCsvPath = 'docs/evaluation/question-rubric.csv';
  if (fs.existsSync(rubricCsvPath)) {
    const csvContent = fs.readFileSync(rubricCsvPath, 'utf8');
    const rubricReport = scoreRubricCsv(csvContent);
    const rubricOutput = 'docs/evaluation/questions-rubric.json';
    fs.writeFileSync(rubricOutput, JSON.stringify(rubricReport, null, 2), 'utf8');
    console.log('\n' + formatRubricMarkdown(rubricReport));
  }
}

if (process.argv[1]?.endsWith('eval-questions.js')) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
