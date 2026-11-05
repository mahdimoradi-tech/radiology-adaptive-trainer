/**
 * analysis:select — Build the fixed 120-image analysis set and write seed/analysis-set.json
 *
 * Idempotent: running multiple times with the same catalog produces the same file.
 * Prints a summary table of counts per class × bucket × source.
 *
 * Usage: node scripts/analysis-select.js [--seed <string>] [--per-class <n>]
 */

import { parseArgs } from 'node:util';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, fileURLToPath } from 'node:path';
import { loadEnv } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/lib/db.js';
import { ImageModel } from '../src/modules/catalog/model.js';
import { selectAnalysisSet } from '../src/modules/analysis/sampling.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_DIR = resolve(__dirname, '../seed');

export async function run() {
  const config = loadEnv();

  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      seed: { type: 'string', default: 'analysis-v1' },
      'per-class': { type: 'string', default: '40' },
    },
    strict: false,
  });

  const seed = values.seed;
  const perClass = parseInt(values['per-class'], 10);

  console.log('=== analysis:select ===');
  console.log(`Seed: ${seed} | Per-class: ${perClass}`);

  await connectDb(config.MONGODB_URI);

  try {
    const allImages = await ImageModel.find({}, '_id trueClass bucket source').lean();
    console.log(`\nCatalog total: ${allImages.length} images`);

    const set = selectAnalysisSet(allImages, { seed, perClass });

    // Print summary table
    const tally = {};
    for (const e of set) {
      const key = `${e.trueClass}:${e.bucket}:${e.source}`;
      tally[key] = (tally[key] || 0) + 1;
    }
    console.log('\n--- Analysis Set: class × bucket × source ---');
    console.table(tally);

    const classCounts = {};
    for (const e of set) {
      classCounts[e.trueClass] = (classCounts[e.trueClass] || 0) + 1;
    }
    console.log('\nPer class:');
    console.table(classCounts);

    // Write seed file
    await mkdir(SEED_DIR, { recursive: true });
    const outPath = resolve(SEED_DIR, 'analysis-set.json');
    await writeFile(outPath, JSON.stringify(set, null, 2));
    console.log(`\nWritten: ${outPath} (${set.length} entries)`);
  } finally {
    await disconnectDb();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
