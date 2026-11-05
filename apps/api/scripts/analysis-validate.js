/**
 * analysis:validate — (Re)computes AnalysisValidation for all images having both runs.
 *
 * Usage: node scripts/analysis-validate.js [--prompt-version <v>]
 */

import { parseArgs } from 'node:util';
import { loadEnv } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/lib/db.js';
import { validateAllAnalyses } from '../src/modules/analysis/portable.js';

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

  console.log('=== analysis:validate ===');
  console.log(`Prompt version: ${promptVersion}\n`);

  await connectDb(config.MONGODB_URI);

  try {
    const summary = await validateAllAnalyses({ promptVersion });

    console.log('--- Validation Summary ---');
    console.log(`Total images validated: ${summary.totalValidated}`);
    console.log(`Auto passed:            ${summary.passedCount}`);
    console.log(`Auto rejected:          ${summary.rejectedCount}\n`);

    console.log('--- Rejection Reasons Tally ---');
    if (Object.keys(summary.reasonsTally).length === 0) {
      console.log('None.');
    } else {
      console.table(summary.reasonsTally);
    }
  } finally {
    await disconnectDb();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
