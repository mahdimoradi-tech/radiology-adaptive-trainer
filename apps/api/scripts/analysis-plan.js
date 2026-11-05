/**
 * analysis:plan — Create analysis_batches in MongoDB from seed/analysis-set.json
 *
 * Idempotent: existing batch docs are left unchanged (upsert by batchId with $setOnInsert).
 * Prints counts of new vs existing batches.
 *
 * Usage: node scripts/analysis-plan.js [--seed <string>] [--batch-size <n>] [--prompt-version <v>]
 */

import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, fileURLToPath } from 'node:path';
import { loadEnv } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/lib/db.js';
import { AnalysisBatchModel } from '../src/modules/analysis/model.js';
import { planBatches } from '../src/modules/analysis/planner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function run() {
  const config = loadEnv();

  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      seed: { type: 'string', default: 'analysis-v1' },
      'batch-size': { type: 'string', default: '6' },
      'prompt-version': { type: 'string', default: 'v1' },
    },
    strict: false,
  });

  const seed = values.seed;
  const batchSize = parseInt(values['batch-size'], 10);
  const promptVersion = values['prompt-version'];

  console.log('=== analysis:plan ===');
  console.log(`Seed: ${seed} | Batch size: ${batchSize} | Prompt version: ${promptVersion}`);

  const setPath = resolve(__dirname, '../seed/analysis-set.json');
  let analysisSet;
  try {
    analysisSet = JSON.parse(await readFile(setPath, 'utf-8'));
  } catch {
    console.error(`Cannot read ${setPath}. Run analysis:select first.`);
    process.exit(1);
  }

  console.log(`Analysis set: ${analysisSet.length} images`);

  await connectDb(config.MONGODB_URI);

  try {
    const model = config.GEMINI_MODEL || 'gemini-3.8-flash';
    const plans = planBatches(analysisSet, { seed, batchSize, promptVersion, model });

    let newCount = 0;
    let existingCount = 0;

    for (const plan of plans) {
      const result = await AnalysisBatchModel.updateOne(
        { batchId: plan.batchId },
        {
          $setOnInsert: {
            _id: plan.batchId,
            batchId: plan.batchId,
            group: plan.group,
            run: plan.run,
            imageIds: plan.imageIds,
            status: plan.status,
            attempts: plan.attempts,
            lastError: plan.lastError,
            requestedAt: plan.requestedAt,
            finishedAt: plan.finishedAt,
            model: plan.model,
            promptVersion: plan.promptVersion,
          },
        },
        { upsert: true },
      );
      if (result.upsertedCount > 0) {
        newCount++;
      } else {
        existingCount++;
      }
    }

    console.log(`\nPlanned ${plans.length} batches total:`);
    console.log(`  New:      ${newCount}`);
    console.log(`  Existing: ${existingCount}`);
    console.log(`\nRun A batches: ${plans.filter((p) => p.run === 'A').length}`);
    console.log(`Run B batches: ${plans.filter((p) => p.run === 'B').length}`);
  } finally {
    await disconnectDb();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
