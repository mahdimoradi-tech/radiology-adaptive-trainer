/**
 * analysis:run — Run the resumable image analysis pipeline.
 *
 * Options:
 *   --max-requests N   Cap total API calls this invocation (default: unlimited)
 *   --max-batches N    Cap total batches (default: unlimited)
 *   --runs A|B|A,B     Which runs to process (default: A,B)
 *   --delay-ms N       Extra inter-request delay ms (default: 0, uses env LLM_MIN_INTERVAL_MS)
 *   --dry-run          Use FakeProvider, no DB writes, no budget consumed
 *   --prompt-version v Prompt version (default: v1)
 *
 * Exit codes: 0 always (quota exhaustion is not an error; check exitReason).
 *
 * Usage: node scripts/analysis-run.js [options]
 * Or via npm: npm run analysis:run -w @radiology/api -- --max-batches 2 --runs A
 */

import { parseArgs } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/lib/db.js';
import { GeminiProvider } from '../src/modules/llm/gemini.provider.js';
import { FakeProvider } from '../src/modules/llm/fake.provider.js';
import { reserveUsage, enforceThrottle } from '../src/modules/llm/budget.js';
import { AnalysisBatchModel, ImageAnalysisModel } from '../src/modules/analysis/model.js';
import { ImageModel } from '../src/modules/catalog/model.js';
import { runAnalysis } from '../src/modules/analysis/runner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function run() {
  const config = loadEnv();

  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'max-requests': { type: 'string' },
      'max-batches': { type: 'string' },
      runs: { type: 'string', default: 'A,B' },
      'delay-ms': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      'prompt-version': { type: 'string', default: 'v1' },
    },
    strict: false,
  });

  const maxRequests = values['max-requests'] ? parseInt(values['max-requests'], 10) : Infinity;
  const maxBatches = values['max-batches'] ? parseInt(values['max-batches'], 10) : Infinity;
  const runs = values['runs']
    .split(',')
    .map((r) => r.trim().toUpperCase())
    .filter((r) => r === 'A' || r === 'B');
  const delayMs = values['delay-ms']
    ? parseInt(values['delay-ms'], 10)
    : Math.max(config.LLM_MIN_INTERVAL_MS, 35000);
  const dryRun = Boolean(values['dry-run']);
  const promptVersion = values['prompt-version'];

  console.log('=== analysis:run ===');
  console.log(`Max requests: ${maxRequests === Infinity ? 'unlimited' : maxRequests}`);
  console.log(`Max batches:  ${maxBatches === Infinity ? 'unlimited' : maxBatches}`);
  console.log(`Runs:         ${runs.join(',')}`);
  console.log(`Delay:        ${delayMs}ms`);
  console.log(`Dry-run:      ${dryRun}`);
  console.log(`Prompt ver:   ${promptVersion}`);

  if (dryRun) {
    console.log('\n[DRY-RUN MODE] Using FakeProvider. No DB writes. No budget consumed.\n');
  }

  await connectDb(config.MONGODB_URI);

  try {
    // Set up provider
    let provider;
    if (dryRun) {
      provider = new FakeProvider();
      // Enqueue a valid fake response for each batch that might be called
      // The FakeProvider customHandler is used for analysis batches
      provider.setHandler((params) => {
        // Build a valid 6-item response (or N-item if smaller last batch)
        const inputParts = Array.isArray(params.input) ? params.input : [];
        // Count image parts
        const imageCount = inputParts.filter((p) => p.type === 'image').length;
        const n = imageCount || 6;
        return {
          results: Array.from({ length: n }, (_, i) => ({
            index: i + 1,
            imageQuality: 'ok',
            predictedClass: 'pneumonia',
            certainty: 'medium',
            laterality: 'bilateral',
            zones: ['lower'],
            patterns: ['consolidation'],
            distribution: 'diffuse',
          })),
        };
      });
    } else {
      if (!config.GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is required for live mode.');
        process.exit(1);
      }
      provider = new GeminiProvider({
        apiKey: config.GEMINI_API_KEY,
        model: config.GEMINI_MODEL,
        timeoutMs: Math.max(config.LLM_TIMEOUT_MS, 180000),
      });
    }

    const imageDir = resolve(__dirname, '..', '..', '..', config.CATALOG_IMAGE_DIR);

    const result = await runAnalysis({
      provider,
      reserveUsageFn: dryRun
        ? async () => ({ ok: true, day: 'dry', count: 1, budget: 999 })
        : reserveUsage,
      enforceThrottleFn: dryRun ? null : enforceThrottle,
      BatchModel: AnalysisBatchModel,
      AnalysisModel: ImageAnalysisModel,
      ImageModel,
      imageDir,
      budget: config.LLM_DAILY_REQUEST_BUDGET,
      maxRequests,
      maxBatches,
      runs,
      delayMs: dryRun ? 0 : delayMs,
      dryRun,
      model: config.GEMINI_MODEL,
      promptVersion,
    });

    console.log('\n--- Run Summary ---');
    console.log(`Requests made: ${result.requestsMade}`);
    console.log(`Batches done:  ${result.batchesDone}`);
    console.log(`Batches failed: ${result.batchesFailed}`);
    console.log(`Exit reason:   ${result.exitReason}`);

    if (result.exitReason === 'BUDGET_EXHAUSTED' || result.exitReason === 'QUOTA_429') {
      console.log('\nBudget exhausted. Resume tomorrow by running analysis:run again.');
    }
  } finally {
    await disconnectDb();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
