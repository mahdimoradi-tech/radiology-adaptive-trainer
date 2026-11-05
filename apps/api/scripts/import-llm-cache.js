#!/usr/bin/env node

/**
 * Imports portable LLM cache entries from apps/api/seed/llm-cache.portable.json
 */

import mongoose from 'mongoose';
import { loadEnv } from '../src/config/env.js';
import { importPortableCache } from '../src/modules/llm/portable.js';

async function main() {
  const env = loadEnv(process.env);
  await mongoose.connect(env.MONGODB_URI);

  try {
    const res = await importPortableCache();
    console.log(`Imported ${res.importedCount} portable entries from ${res.inputPath}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('Failed to import portable LLM cache:', err);
  process.exit(1);
});
