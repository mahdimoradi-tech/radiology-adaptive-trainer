/**
 * analysis:export — Export all completed image analyses and validations to seed/image-analyses.json
 *
 * Usage: node scripts/analysis-export.js [--output <path>] [--prompt-version <v>]
 */

import { parseArgs } from 'node:util';
import { loadEnv } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/lib/db.js';
import {
  exportImageAnalyses,
  DEFAULT_ANALYSES_EXPORT_PATH,
} from '../src/modules/analysis/portable.js';

export async function run() {
  const config = loadEnv();

  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      output: { type: 'string', default: DEFAULT_ANALYSES_EXPORT_PATH },
      'prompt-version': { type: 'string', default: 'v1' },
    },
    strict: false,
  });

  const outputPath = values.output;
  const promptVersion = values['prompt-version'];

  console.log('=== analysis:export ===');
  console.log(`Prompt version: ${promptVersion}`);
  console.log(`Output:         ${outputPath}\n`);

  await connectDb(config.MONGODB_URI);

  try {
    const result = await exportImageAnalyses({ outputPath, promptVersion });
    console.log(`✓ Exported ${result.exportedCount} entries to ${result.outputPath}`);
  } finally {
    await disconnectDb();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
