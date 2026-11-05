#!/usr/bin/env node

/**
 * Script to pre-generate the 6 confusion pair explanations.
 * Supports --lang (fa|en) and --dry-run flags.
 * Refuses to run if less than 2 requests of budget remain.
 */

import mongoose from 'mongoose';
import { loadEnv } from '../src/config/env.js';
import { pregenerateExplanations } from '../src/modules/llm/llm.service.js';
import { getUsageStatus } from '../src/modules/llm/budget.js';

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const langIdx = args.indexOf('--lang');
  const lang = langIdx !== -1 && args[langIdx + 1] ? args[langIdx + 1] : 'fa';

  const env = loadEnv(process.env);
  console.log(`--- Pre-generate LLM Explanations (${lang}) ---`);
  if (isDryRun) {
    console.log('[DRY-RUN MODE] No API calls will be made.');
  }

  await mongoose.connect(env.MONGODB_URI);

  try {
    const budget = env.LLM_DAILY_REQUEST_BUDGET;
    const status = await getUsageStatus({ budget });

    console.log(`Current Pacific Day: ${status.day}`);
    console.log(`Usage:               ${status.count} / ${budget} calls`);

    if (!isDryRun && (status.exhausted || status.count > budget - 2)) {
      console.error(
        `Error: Insufficient budget remaining (${status.count}/${budget}). Script requires at least 2 remaining requests to run safely.`,
      );
      process.exit(1);
    }

    const result = await pregenerateExplanations({
      lang,
      dryRun: isDryRun,
      env,
    });

    if (isDryRun) {
      console.log('Dry run successful!');
      console.log(`Missing pairs in cache: ${result.missingCount}`);
      console.log('Pairs to generate:', result.pairs);
    } else {
      console.log('Pre-generation complete!');
      console.log(`Newly generated pairs: ${result.newlyGenerated}`);
      console.log(`Total cached pairs:    ${result.cachedCount}`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('Pre-generation script failed:', err);
  process.exit(1);
});
