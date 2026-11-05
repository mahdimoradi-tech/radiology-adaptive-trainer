#!/usr/bin/env node

/**
 * Smoke script for live Gemini API integration.
 * Makes ONE live call with a tiny schema to verify end-to-end connectivity,
 * token usage reporting and budget tracking. Never prints secrets.
 */

import mongoose from 'mongoose';
import { z } from 'zod';
import { loadEnv } from '../src/config/env.js';
import { GeminiProvider } from '../src/modules/llm/gemini.provider.js';
import { reserveUsage, getUsageStatus } from '../src/modules/llm/budget.js';

async function main() {
  const env = loadEnv(process.env);

  console.log('--- Radiology Adaptive Trainer: Gemini Smoke Test ---');

  if (!env.GEMINI_API_KEY || !env.GEMINI_API_KEY.trim()) {
    console.error('Error: GEMINI_API_KEY is not set in environment or .env file.');
    console.error('Please configure GEMINI_API_KEY and run again.');
    process.exit(1);
  }

  // Connect to database to track budget
  await mongoose.connect(env.MONGODB_URI);

  try {
    const budget = env.LLM_DAILY_REQUEST_BUDGET;

    // Check status before call
    const initialStatus = await getUsageStatus({ budget });
    console.log(`Current Pacific Day: ${initialStatus.day}`);
    console.log(`Usage before test:   ${initialStatus.count} / ${budget} calls`);

    if (initialStatus.exhausted || initialStatus.count >= budget) {
      console.warn(
        'Warning: Daily budget is already reached or marked exhausted. Aborting live call.',
      );
      return;
    }

    // Reserve 1 request
    const reserve = await reserveUsage({ budget });
    if (!reserve.ok) {
      console.warn(`Reservation failed (${reserve.reason}). Aborting.`);
      return;
    }

    console.log('Sending 1 test request to Gemini Interactions API...');
    const provider = new GeminiProvider({
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL,
      timeoutMs: env.LLM_TIMEOUT_MS,
    });

    const SmokeOutputSchema = z.object({
      status: z.string(),
      message: z.string(),
    });

    const startTime = Date.now();
    const result = await provider.generateJson({
      promptId: 'smoke-test',
      version: 'v1',
      system: 'You are a health check system. Return a concise JSON greeting.',
      input: { ping: 'radiology-adaptive-trainer' },
      schema: SmokeOutputSchema,
    });
    const latencyMs = Date.now() - startTime;

    console.log('=== Smoke Test Success ===');
    console.log(`Model:            ${env.GEMINI_MODEL}`);
    console.log(`Latency:          ${latencyMs} ms`);
    console.log(`Response Status:  ${result.data.status}`);
    console.log(`Response Message: ${result.data.message}`);
    console.log(`Prompt Tokens:    ${result.usage.promptTokens}`);
    console.log(`Response Tokens:  ${result.usage.responseTokens}`);
    console.log(`Total Tokens:     ${result.usage.totalTokens}`);
    console.log(`Budget Used:      ${reserve.count} / ${budget}`);
  } catch (err) {
    console.error('=== Smoke Test Failed ===');
    console.error(`Error:   ${err.message}`);
    console.error(`Code:    ${err.code || 'UNKNOWN'}`);
    if (err.status) console.error(`Status:  ${err.status}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('Unhandled script error:', err);
  process.exit(1);
});
