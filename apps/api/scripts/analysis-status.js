/**
 * analysis:status — Status of batches, runs, accuracy, agreement, and validations.
 *
 * Usage: node scripts/analysis-status.js [--prompt-version <v>]
 */

import { parseArgs } from 'node:util';
import { loadEnv } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/lib/db.js';
import { getAnalysisStatusSummary } from '../src/modules/analysis/portable.js';

export async function run() {
  const config = loadEnv();

  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'prompt-version': { type: 'string', default: 'v1' },
    },
    strict: false,
  });

  const promptVersion = values['prompt-version'];

  await connectDb(config.MONGODB_URI);

  try {
    const status = await getAnalysisStatusSummary({
      promptVersion,
      budget: config.LLM_DAILY_REQUEST_BUDGET,
    });

    console.log('====================================================');
    console.log('       Radiology Trainer - Analysis Pipeline Status');
    console.log('====================================================\n');

    console.log('--- Batches ---');
    console.log(`Total:   ${status.batches.total}`);
    console.log(`Done:    ${status.batches.done}`);
    console.log(`Pending: ${status.batches.pending}`);
    console.log(`Failed:  ${status.batches.failed}`);
    console.log(`  Run A: ${status.batches.runA.done} / ${status.batches.runA.total} done`);
    console.log(`  Run B: ${status.batches.runB.done} / ${status.batches.runB.total} done\n`);

    console.log('--- Image Coverage ---');
    console.log(`Distinct images seen:  ${status.images.distinctCount}`);
    console.log(`Both runs available:   ${status.images.bothRuns}`);
    console.log(`Run A only:            ${status.images.runAOnly}`);
    console.log(`Run B only:            ${status.images.runBOnly}\n`);

    console.log('--- Schema Validity & Reliability ---');
    const validRateStr =
      status.schemaValidRate !== null && !Number.isNaN(status.schemaValidRate)
        ? `${(status.schemaValidRate * 100).toFixed(1)}%`
        : 'N/A';
    console.log(`Schema valid rate:     ${validRateStr}`);

    const agreementRateStr =
      status.agreement.rate !== null && !Number.isNaN(status.agreement.rate)
        ? `${(status.agreement.rate * 100).toFixed(1)}%`
        : 'N/A';
    console.log(
      `Run A vs B agreement:  ${agreementRateStr} (${status.agreement.total} paired images)\n`,
    );

    console.log('--- Accuracy vs Dataset Ground Truth ---');
    const runAOverallStr =
      status.runA.accuracy !== null && !Number.isNaN(status.runA.accuracy)
        ? `${(status.runA.accuracy * 100).toFixed(1)}%`
        : 'N/A';
    console.log(`Run A overall: ${runAOverallStr} (${status.runA.total} images)`);
    for (const [cls, stats] of Object.entries(status.runA.byClass)) {
      const acc = stats.total > 0 ? `${((stats.correct / stats.total) * 100).toFixed(1)}%` : 'N/A';
      console.log(`  - ${cls.padEnd(10)}: ${acc} (${stats.correct}/${stats.total})`);
    }

    const runBOverallStr =
      status.runB.accuracy !== null && !Number.isNaN(status.runB.accuracy)
        ? `${(status.runB.accuracy * 100).toFixed(1)}%`
        : 'N/A';
    console.log(`\nRun B overall: ${runBOverallStr} (${status.runB.total} images)`);
    for (const [cls, stats] of Object.entries(status.runB.byClass)) {
      const acc = stats.total > 0 ? `${((stats.correct / stats.total) * 100).toFixed(1)}%` : 'N/A';
      console.log(`  - ${cls.padEnd(10)}: ${acc} (${stats.correct}/${stats.total})`);
    }

    console.log('\n--- Validations ---');
    console.log(`Total validated: ${status.validations.total}`);
    console.log(`Auto passed:     ${status.validations.autoPassed}`);
    console.log(`Auto rejected:   ${status.validations.autoRejected}`);

    if (Object.keys(status.validations.byClassBucket).length > 0) {
      console.log('\nClass x Bucket Breakdown:');
      console.table(status.validations.byClassBucket);
    }

    if (status.validations.topRejectReasons.length > 0) {
      console.log('\nTop Rejection Reasons:');
      for (const [reason, cnt] of status.validations.topRejectReasons) {
        console.log(`  - ${reason.padEnd(30)}: ${cnt}`);
      }
    }

    console.log('\n--- Gemini Pacific Daily Budget ---');
    console.log(`Day:       ${status.budget.day} (Pacific)`);
    console.log(`Used:      ${status.budget.count} / ${status.budget.budget}`);
    console.log(`Remaining: ${Math.max(0, status.budget.budget - status.budget.count)}`);
    console.log(`Exhausted: ${status.budget.exhausted}`);
    console.log('====================================================\n');
  } finally {
    await disconnectDb();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
