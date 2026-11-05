/**
 * @fileoverview Core runner for the T08a resumable analysis pipeline.
 *
 * runAnalysis({ provider, budget, batchSize, maxRequests, maxBatches, runs, delayMs, dryRun })
 *   - Fetches pending/failed batches from MongoDB (ordered group, then run A before B)
 *   - For each batch: reserves budget, enforces throttle, calls the provider, parses
 *     response, validates response structure, stores ImageAnalysis docs, marks batch done.
 *   - On bad response: increments attempts, marks failed (max 2 attempts), stores lastError.
 *   - On 429: marks day exhausted, exits cleanly (exit code 0).
 *   - Resumable: a finished batch is never retried regardless of restarts.
 *   - No DB writes in dry-run mode.
 *
 * This module has NO side effects at import time. All DB access is passed in via deps.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BatchAnalysisResponseSchema } from '@radiology/contracts';
import { LlmError } from '../llm/provider.js';
import { markExhausted } from '../llm/budget.js';
import { buildPromptAInput, SYSTEM_INSTRUCTION_A } from './prompts/v1/analyze-a.js';
import { buildPromptBInput, SYSTEM_INSTRUCTION_B } from './prompts/v1/analyze-b.js';

export const MAX_ATTEMPTS = 2;
export const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sleep for ms milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Load image bytes from disk and encode as base64.
 * Returns null if the file is > MAX_FILE_BYTES (task rule: skip and log).
 * @param {string} filePath
 * @returns {Promise<string | null>}
 */
export async function loadImageBase64(filePath) {
  const buf = await readFile(filePath);
  if (buf.length > MAX_FILE_BYTES) {
    return null;
  }
  return buf.toString('base64');
}

/**
 * Strictly validate the batch response:
 *   - results must be an array of exactly N items
 *   - each index must be unique and in [1..N]
 *   - all items pass ImageAnalysisResultSchema (via BatchAnalysisResponseSchema)
 *
 * @param {unknown} parsed - Already-parsed JSON object
 * @param {number} expectedCount - Expected number of results
 * @returns {{ ok: true, data: import('@radiology/contracts').BatchAnalysisResponse } | { ok: false, error: string }}
 */
export function validateBatchResponse(parsed, expectedCount) {
  const result = BatchAnalysisResponseSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: `Schema invalid: ${result.error.message}` };
  }
  const { results } = result.data;
  if (results.length !== expectedCount) {
    return {
      ok: false,
      error: `Expected ${expectedCount} results, got ${results.length}`,
    };
  }
  // Check unique indices in [1..N]
  const indices = results.map((r) => r.index);
  const indexSet = new Set(indices);
  if (indexSet.size !== expectedCount) {
    return { ok: false, error: `Duplicate indices in results: [${indices}]` };
  }
  for (const idx of indices) {
    if (idx < 1 || idx > expectedCount) {
      return { ok: false, error: `Index ${idx} out of range [1..${expectedCount}]` };
    }
  }
  return { ok: true, data: result.data };
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} RunnerOptions
 * @property {object} provider - LLM provider instance (Gemini or Fake)
 * @property {object} reserveUsageFn - Budget reservation function (from budget.js)
 * @property {object} enforceThrottleFn - Throttle enforcement function (from budget.js)
 * @property {object} BatchModel - Mongoose model for AnalysisBatch
 * @property {object} AnalysisModel - Mongoose model for ImageAnalysis
 * @property {object} ImageModel - Mongoose model for catalog Images
 * @property {string} imageDir - Absolute path to catalog image directory
 * @property {number} budget - Daily request budget
 * @property {number} [maxRequests=Infinity] - Cap on requests for this invocation
 * @property {number} [maxBatches=Infinity] - Cap on batches for this invocation
 * @property {string[]} [runs=['A','B']] - Which runs to process
 * @property {number} [delayMs=0] - Additional delay between requests (testing)
 * @property {boolean} [dryRun=false] - If true: use fake responses, no DB writes
 * @property {string} [model='gemini-3.8-flash'] - Model identifier (for stored metadata)
 * @property {string} [promptVersion='v1']
 */

/**
 * Run the analysis pipeline — resumable, quota-aware.
 *
 * @param {RunnerOptions} opts
 * @returns {Promise<{ requestsMade: number, batchesDone: number, batchesFailed: number, exitReason: string }>}
 */
export async function runAnalysis(opts) {
  const {
    provider,
    reserveUsageFn,
    enforceThrottleFn,
    BatchModel,
    AnalysisModel,
    ImageModel,
    imageDir,
    loadImageBase64Fn = loadImageBase64,
    budget,
    maxRequests = Infinity,
    maxBatches = Infinity,
    runs = ['A', 'B'],
    delayMs = 0,
    dryRun = false,
    model = 'gemini-3.8-flash',
    promptVersion = 'v1',
  } = opts;

  let requestsMade = 0;
  let batchesDone = 0;
  let batchesFailed = 0;

  // Fetch batches: pending first (also retry failed with attempts < MAX_ATTEMPTS),
  // ordered by group asc, run A before B.
  const eligibleBatches = await BatchModel.find({
    $or: [
      { status: 'pending', run: { $in: runs } },
      { status: 'failed', attempts: { $lt: MAX_ATTEMPTS }, run: { $in: runs } },
    ],
  })
    .sort({ group: 1, run: 1 })
    .lean();

  for (const batch of eligibleBatches) {
    if (requestsMade >= maxRequests || batchesDone + batchesFailed >= maxBatches) {
      return { requestsMade, batchesDone, batchesFailed, exitReason: 'CAP_REACHED' };
    }

    // Check/reserve budget (skip in dry-run)
    if (!dryRun) {
      const reserved = await reserveUsageFn({ budget });
      if (!reserved.ok) {
        console.log(
          `Budget exhausted (${reserved.reason}): used ${reserved.count}/${reserved.budget} today. Resume tomorrow.`,
        );
        return { requestsMade, batchesDone, batchesFailed, exitReason: 'BUDGET_EXHAUSTED' };
      }

      // Throttle
      if (enforceThrottleFn) {
        await enforceThrottleFn({ minIntervalMs: delayMs });
      }
    }

    // Additional explicit delay (for --delay-ms or testing)
    if (delayMs > 0) await sleep(delayMs);

    // Load image bytes
    const imageInputs = [];
    let skipBatch = false;
    for (const imageId of batch.imageIds) {
      // Look up the filename from the catalog
      const imgQuery = ImageModel.findById(imageId);
      const imgDoc = await (imgQuery?.lean ? imgQuery.lean() : imgQuery);
      if (!imgDoc) {
        console.warn(
          `  [WARN] imageId ${imageId} not found in catalog — skipping batch ${batch.batchId}`,
        );
        skipBatch = true;
        break;
      }
      const filePath = resolve(imageDir, imgDoc.filename);
      let b64;
      try {
        b64 = await loadImageBase64Fn(filePath);
      } catch {
        console.warn(`  [WARN] Could not read ${filePath} — skipping batch ${batch.batchId}`);
        skipBatch = true;
        break;
      }
      if (b64 === null) {
        console.warn(`  [WARN] ${filePath} > 4MB — skipping batch ${batch.batchId}`);
        skipBatch = true;
        break;
      }
      imageInputs.push({ imageId, jpegBase64: b64 });
    }

    if (skipBatch) {
      if (!dryRun) {
        await BatchModel.updateOne(
          { batchId: batch.batchId },
          {
            $inc: { attempts: 1 },
            $set: { status: 'failed', lastError: 'Could not load one or more images' },
          },
        );
      }
      batchesFailed++;
      continue;
    }

    // Build prompt input
    const isRunA = batch.run === 'A';
    const inputParts = isRunA ? buildPromptAInput(imageInputs) : buildPromptBInput(imageInputs);
    const systemInstruction = isRunA ? SYSTEM_INSTRUCTION_A : SYSTEM_INSTRUCTION_B;

    // Mark requestedAt
    if (!dryRun) {
      await BatchModel.updateOne({ batchId: batch.batchId }, { $set: { requestedAt: new Date() } });
    }

    // Call the provider
    let rawText;
    let parsed;
    try {
      const result = await provider.generateJson({
        promptId: `analysis-${batch.run.toLowerCase()}`,
        version: promptVersion,
        system: systemInstruction,
        input: inputParts,
        schema: null, // We validate manually below for strict index checking
      });
      rawText = result.rawText;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = result.data; // Provider may already have parsed it
      }
      requestsMade++;
    } catch (err) {
      requestsMade++;
      // 429 → mark exhausted, exit cleanly
      if (err instanceof LlmError && err.status === 429) {
        console.log(`429 quota error — marking day exhausted. ${err.message}`);
        if (!dryRun) await markExhausted();
        return { requestsMade, batchesDone, batchesFailed, exitReason: 'QUOTA_429' };
      }
      // Other error → fail the batch
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`  [ERROR] Batch ${batch.batchId} provider error: ${errMsg}`);
      if (!dryRun) {
        await BatchModel.updateOne(
          { batchId: batch.batchId },
          {
            $inc: { attempts: 1 },
            $set: { status: 'failed', lastError: errMsg.slice(0, 500) },
          },
        );
      }
      batchesFailed++;
      continue;
    }

    // Validate response
    const validation = validateBatchResponse(parsed, batch.imageIds.length);
    if (!validation.ok) {
      console.error(`  [ERROR] Batch ${batch.batchId} bad response: ${validation.error}`);
      if (!dryRun) {
        await BatchModel.updateOne(
          { batchId: batch.batchId },
          {
            $inc: { attempts: 1 },
            $set: { status: 'failed', lastError: validation.error.slice(0, 500) },
          },
        );
      }
      batchesFailed++;
      continue;
    }

    // Store ImageAnalysis docs — results come back indexed 1..N,
    // map index → imageId via batch.imageIds (0-based array, index is 1-based)
    const { results } = validation.data;
    if (!dryRun) {
      for (const item of results) {
        const imageId = batch.imageIds[item.index - 1];
        await AnalysisModel.findOneAndUpdate(
          { imageId, run: batch.run, promptVersion },
          {
            $set: {
              imageId,
              run: batch.run,
              promptVersion,
              model,
              batchId: batch.batchId,
              output: item,
            },
          },
          { upsert: true },
        );
      }

      // Mark batch done
      await BatchModel.updateOne(
        { batchId: batch.batchId },
        {
          $set: { status: 'done', finishedAt: new Date(), model, lastError: null },
        },
      );
    }

    console.log(`  ✓ Batch ${batch.batchId} done (${results.length} images)`);
    batchesDone++;
  }

  return { requestsMade, batchesDone, batchesFailed, exitReason: 'ALL_DONE' };
}
