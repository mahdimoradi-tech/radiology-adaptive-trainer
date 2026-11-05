import { parseArgs } from 'node:util';
import { loadEnv } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/lib/db.js';
import { GeminiProvider } from '../src/modules/llm/gemini.provider.js';
import { FakeProvider } from '../src/modules/llm/fake.provider.js';
import { generateQuestions } from '../src/modules/bank/generate.js';

export async function run() {
  const config = loadEnv();

  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'max-requests': { type: 'string', default: '12' },
      'batch-size': { type: 'string', default: '8' },
      limit: { type: 'string' },
      'delay-ms': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      'prompt-version': { type: 'string', default: 'v1' },
      'max-differential-per-pair': { type: 'string', default: '4' },
    },
    strict: false,
  });

  const maxRequests = values['max-requests'] ? parseInt(values['max-requests'], 10) : 12;
  const batchSize = values['batch-size'] ? parseInt(values['batch-size'], 10) : 8;
  const limit = values.limit ? parseInt(values.limit, 10) : undefined;
  const delayMs = values['delay-ms']
    ? parseInt(values['delay-ms'], 10)
    : config.LLM_MIN_INTERVAL_MS || 13000;
  const dryRun = Boolean(values['dry-run']);
  const promptVersion = values['prompt-version'] || 'v1';
  const maxDifferentialPerPair = values['max-differential-per-pair']
    ? parseInt(values['max-differential-per-pair'], 10)
    : 4;

  console.log('=== questions:generate ===');
  console.log(`Prompt version: ${promptVersion}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Max requests: ${maxRequests}`);
  console.log(`Batch size: ${batchSize}`);
  if (limit) console.log(`Limit: ${limit}`);

  await connectDb(config.MONGODB_URI);

  let provider;
  if (dryRun) {
    provider = new FakeProvider();
  } else {
    provider = new GeminiProvider({
      apiKey: config.GEMINI_API_KEY,
      model: config.GEMINI_MODEL,
      timeoutMs: Math.max(config.LLM_TIMEOUT_MS, 60000),
    });
  }

  try {
    const summary = await generateQuestions({
      provider,
      promptVersion,
      model: config.GEMINI_MODEL,
      batchSize,
      maxRequests,
      maxDifferentialPerPair,
      limit,
      dryRun,
      delayMs,
    });

    console.log('\n--- Question Generation Summary ---');
    console.log(`Exit reason:        ${summary.exitReason}`);
    console.log(`Requests made:      ${summary.requestsMade}`);
    console.log(`Batches processed:  ${summary.batchesProcessed}`);
    console.log(`Images processed:   ${summary.imagesProcessed}`);
    console.log(`Items created:      ${summary.itemsCreated.total}`);
    console.log(`  - Finding:        ${summary.itemsCreated.byType.finding}`);
    console.log(`  - Distribution:   ${summary.itemsCreated.byType.distribution}`);
    console.log(`  - Differential:   ${summary.itemsCreated.byType.differential}`);
    console.log(`Attempts rejected:  ${summary.attemptsRejected.total}`);

    if (summary.attemptsRejected.total > 0) {
      console.log('Rejection reasons:');
      for (const [reason, count] of Object.entries(summary.attemptsRejected.byReason)) {
        console.log(`  - ${reason}: ${count}`);
      }
    }
  } finally {
    await disconnectDb();
  }
}

if (process.argv[1]?.endsWith('questions-generate.js')) {
  run().catch((err) => {
    console.error('Fatal error in questions:generate:', err);
    process.exit(1);
  });
}
