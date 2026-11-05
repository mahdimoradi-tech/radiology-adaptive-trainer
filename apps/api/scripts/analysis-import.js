/**
 * analysis:import — Import image analyses and validations from seed/image-analyses.json
 *
 * Usage: node scripts/analysis-import.js [--input <path>]
 */

import { parseArgs } from 'node:util';
import { loadEnv } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/lib/db.js';
import {
  importImageAnalyses,
  DEFAULT_ANALYSES_EXPORT_PATH,
} from '../src/modules/analysis/portable.js';

export async function run() {
  const config = loadEnv();

  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      input: { type: 'string', default: DEFAULT_ANALYSES_EXPORT_PATH },
    },
    strict: false,
  });

  const inputPath = values.input;

  console.log('=== analysis:import ===');
  console.log(`Input: ${inputPath}\n`);

  await connectDb(config.MONGODB_URI);

  try {
    const result = await importImageAnalyses({ inputPath });
    console.log(`✓ Imported ${result.importedCount} entries from ${result.inputPath}`);
  } finally {
    await disconnectDb();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
