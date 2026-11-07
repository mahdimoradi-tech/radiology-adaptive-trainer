/**
 * eval:simulation — Evaluates adaptive vs random vs fixed training policies
 * using the seeded virtual-resident simulator in @radiology/engine.
 *
 * Usage: node scripts/eval-simulation.js [--residents <n>] [--seed <s>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { CLASS_IDS } from '@radiology/contracts';
import {
  createSimulatorPool,
  simulateResident,
  wilsonInterval,
} from '../packages/engine/src/index.js';

function getGitSha() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function computeStats(arr) {
  if (!arr || arr.length === 0) {
    return { mean: null, std: null, min: null, median: null, max: null };
  }
  const n = arr.length;
  const mean = arr.reduce((acc, v) => acc + v, 0) / n;
  const variance = n > 1 ? arr.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1) : 0;
  const std = Math.sqrt(variance);

  const sorted = [...arr].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mid = Math.floor(n / 2);
  const median = n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  return { mean, std, min, median, max };
}

export function evaluateSimulation({
  numResidents = 50,
  maxSessions = 12,
  seed = 42,
  date = new Date().toISOString(),
} = {}) {
  const gitSha = getGitSha();
  const pool = createSimulatorPool();
  const policies = /** @type {const} */ (['adaptive', 'random', 'fixed']);

  const results = {};

  for (const policy of policies) {
    const residentRecords = [];
    for (let i = 0; i < numResidents; i++) {
      const residentSeed = (seed * 10007 + i * 37) >>> 0;
      const res = simulateResident({
        policy,
        pool,
        residentParams: {
          initialSkills: { covid19: 0.4, pneumonia: 0.5, normal: 0.6 },
          learningRate: 0.03,
          difficultyPenalty: 0.25,
        },
        engineConfig: { totalQuestions: 60, masteryThreshold: 0.8 },
        maxSessions,
        seed: residentSeed,
      });
      residentRecords.push(res);
    }

    const masteredCount = residentRecords.filter((r) => r.mastered).length;
    const masteryWilson = wilsonInterval(masteredCount, numResidents);

    const sessions = residentRecords.map((r) => r.sessionsToMastery);
    const sessionStats = computeStats(sessions);

    const avgFpr = {};
    const avgFnr = {};
    for (const c of CLASS_IDS) {
      avgFpr[c] = residentRecords.reduce((acc, r) => acc + r.finalFpr[c], 0) / numResidents;
      avgFnr[c] = residentRecords.reduce((acc, r) => acc + r.finalFnr[c], 0) / numResidents;
    }

    results[policy] = {
      policy,
      numResidents,
      masteredCount,
      masteryRate: masteryWilson.p,
      masteryCi: { low: masteryWilson.low, high: masteryWilson.high },
      sessionsToMastery: {
        mean: sessionStats.mean,
        std: sessionStats.std,
        min: sessionStats.min,
        median: sessionStats.median,
        max: sessionStats.max,
      },
      avgFpr,
      avgFnr,
      rawSessions: sessions,
    };
  }

  return {
    metadata: {
      command: 'npm run eval:simulation',
      date,
      gitSha,
      seeds: { masterSeed: seed, numResidents, maxSessions },
      note: 'simulated residents, not human data; known limitations in packages/engine README',
    },
    results,
  };
}

export function formatSimulationMarkdown(report) {
  const { metadata, results } = report;
  const lines = [
    `### E1 — Adaptive Engine Simulation Evaluation`,
    ``,
    `> **Note:** ${metadata.note}`,
    `> Command: \`${metadata.command}\` | Seeds: master=${metadata.seeds.masterSeed}, n=${metadata.seeds.numResidents} | SHA: \`${metadata.gitSha}\``,
    ``,
    `| Policy | N | Mastery Rate (Wilson 95% CI) | Sessions to Mastery (Mean ± SD) | Sessions (Median [Min–Max]) | Avg FPR (Covid / Pneu / Norm) | Avg FNR (Covid / Pneu / Norm) |`,
    `|---|---|---|---|---|---|---|`,
  ];

  for (const policy of ['adaptive', 'random', 'fixed']) {
    const r = results[policy];
    if (!r) continue;
    const masteryStr =
      r.masteryRate !== null
        ? `${(r.masteryRate * 100).toFixed(1)}% [${(r.masteryCi.low * 100).toFixed(1)}%–${(r.masteryCi.high * 100).toFixed(1)}%]`
        : 'N/A';
    const meanStdStr =
      r.sessionsToMastery.mean !== null
        ? `${r.sessionsToMastery.mean.toFixed(2)} ± ${r.sessionsToMastery.std.toFixed(2)}`
        : 'N/A';
    const medRangeStr =
      r.sessionsToMastery.median !== null
        ? `${r.sessionsToMastery.median.toFixed(1)} [${r.sessionsToMastery.min}–${r.sessionsToMastery.max}]`
        : 'N/A';
    const fprStr = `${r.avgFpr.covid19.toFixed(3)} / ${r.avgFpr.pneumonia.toFixed(3)} / ${r.avgFpr.normal.toFixed(3)}`;
    const fnrStr = `${r.avgFnr.covid19.toFixed(3)} / ${r.avgFnr.pneumonia.toFixed(3)} / ${r.avgFnr.normal.toFixed(3)}`;

    lines.push(
      `| **${r.policy.toUpperCase()}** | ${r.numResidents} | ${masteryStr} | ${meanStdStr} | ${medRangeStr} | ${fprStr} | ${fnrStr} |`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

export async function run() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      residents: { type: 'string', default: '50' },
      seed: { type: 'string', default: '42' },
      output: { type: 'string', default: 'docs/evaluation/simulation.json' },
    },
    strict: false,
  });

  const numResidents = parseInt(values.residents, 10) || 50;
  const seed = parseInt(values.seed, 10) || 42;
  const outputPath = values.output;

  const report = evaluateSimulation({ numResidents, seed });

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Wrote simulation evaluation data to ${outputPath}`);

  const mdTable = formatSimulationMarkdown(report);
  console.log('\n' + mdTable);
}

if (process.argv[1]?.endsWith('eval-simulation.js')) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
