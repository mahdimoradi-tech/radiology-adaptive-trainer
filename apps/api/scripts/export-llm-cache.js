#!/usr/bin/env node

/**
 * Exports portable LLM cache entries to apps/api/seed/llm-cache.portable.json
 */

import mongoose from 'mongoose';
import { loadEnv } from '../src/config/env.js';
import { exportPortableCache } from '../src/modules/llm/portable.js';

async function main() {
  const env = loadEnv(process.env);
  await mongoose.connect(env.MONGODB_URI);

  try {
    const res = await exportPortableCache();
    console.log(`Exported ${res.exportedCount} portable entries to ${res.outputPath}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('Failed to export portable LLM cache:', err);
  process.exit(1);
});
