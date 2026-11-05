import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { FakeProvider } from '../../llm/fake.provider.js';
import { LlmError } from '../../llm/provider.js';
import { runAnalysis, validateBatchResponse } from '../runner.js';

// ---------------------------------------------------------------------------
// DB setup — isolated test database per test file
// ---------------------------------------------------------------------------

const TEST_DB = `radiology_test_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
const MONGODB_URI = `mongodb://127.0.0.1:27017/${TEST_DB}`;

// Mongoose models for tests (re-registered to avoid cross-test contamination)
import { AnalysisBatchModel, ImageAnalysisModel } from '../model.js';

// Minimal ImageModel stub for the runner (needs .findById)
class FakeImageModel {
  constructor(catalog) {
    this._catalog = catalog; // { [imageId]: { filename: 'somefile.jpg' } }
  }
  findById(id) {
    const doc = this._catalog[id] ? { filename: this._catalog[id].filename } : null;
    // Return a thenable with .lean() that returns the doc
    return {
      lean: () => Promise.resolve(doc),
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function goodItem(index) {
  return {
    index,
    imageQuality: 'ok',
    predictedClass: 'pneumonia',
    certainty: 'high',
    laterality: 'bilateral',
    zones: ['lower'],
    patterns: ['consolidation'],
    distribution: 'diffuse',
  };
}

function goodBatchResponse(n) {
  return { results: Array.from({ length: n }, (_, i) => goodItem(i + 1)) };
}

/** Make a minimal batch doc ready to insert */
function batchDoc(overrides = {}) {
  const id = overrides.batchId ?? `v1-g${String(overrides.group ?? 0).padStart(2, '0')}-A`;
  return {
    _id: id, // AnalysisBatchModel uses batchId as _id
    batchId: id,
    group: overrides.group ?? 0,
    run: overrides.run ?? 'A',
    imageIds: overrides.imageIds ?? ['img-0', 'img-1', 'img-2', 'img-3', 'img-4', 'img-5'],
    status: overrides.status ?? 'pending',
    attempts: overrides.attempts ?? 0,
    lastError: null,
    requestedAt: null,
    finishedAt: null,
    model: 'gemini-3.8-flash',
    promptVersion: 'v1',
  };
}

/** Build a fake image dir resolver — returns a fixed fake path */
const FAKE_IMAGE_DIR = '/fake/images';

// ---------------------------------------------------------------------------
// Reusable options builder
// ---------------------------------------------------------------------------

function makeOpts(overrides = {}) {
  const fakeImageModel = new FakeImageModel(
    Object.fromEntries(
      ['img-0', 'img-1', 'img-2', 'img-3', 'img-4', 'img-5'].map((id) => [
        id,
        { filename: `${id}.jpg` },
      ]),
    ),
  );
  return {
    provider: new FakeProvider(),
    reserveUsageFn: async () => ({ ok: true, day: 'test', count: 1, budget: 999 }),
    enforceThrottleFn: null,
    BatchModel: AnalysisBatchModel,
    AnalysisModel: ImageAnalysisModel,
    ImageModel: fakeImageModel,
    imageDir: FAKE_IMAGE_DIR,
    budget: 16,
    delayMs: 0,
    dryRun: true, // dry-run by default to avoid file I/O in most tests
    model: 'gemini-3.8-flash',
    promptVersion: 'v1',
    // Inject a fake image loader so tests never hit the filesystem
    loadImageFn: async (_filePath) => 'ZmFrZWJhc2U2NA==', // fake base64
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Connect to test DB before tests, clean up after
// ---------------------------------------------------------------------------

beforeEach(async () => {
  await mongoose.connect(MONGODB_URI);
  // Clean slate for each test
  await AnalysisBatchModel.deleteMany({});
  await ImageAnalysisModel.deleteMany({});
});

afterEach(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

// ---------------------------------------------------------------------------
// Test 4: Bad response → batch failed, attempts incremented, nothing partial stored
// ---------------------------------------------------------------------------

describe('runner — bad response handling (Test 4)', () => {
  it('marks batch failed when LLM returns wrong item count', async () => {
    // Insert a pending batch
    await AnalysisBatchModel.create(batchDoc());

    const provider = new FakeProvider();
    // Return only 3 items instead of 6
    provider.enqueue(goodBatchResponse(3));

    const opts = makeOpts({ provider, dryRun: false });
    const result = await runAnalysis(opts);

    expect(result.batchesFailed).toBe(1);
    expect(result.batchesDone).toBe(0);

    const batch = await AnalysisBatchModel.findOne({ batchId: 'v1-g00-A' }).lean();
    expect(batch.status).toBe('failed');
    expect(batch.attempts).toBe(1);
    expect(batch.lastError).toMatch(/Expected 6 results, got 3/);

    // No ImageAnalysis docs stored
    const count = await ImageAnalysisModel.countDocuments();
    expect(count).toBe(0);
  });

  it('marks batch failed when LLM returns duplicate index', async () => {
    await AnalysisBatchModel.create(batchDoc());

    const provider = new FakeProvider();
    // 6 items but index 1 appears twice
    const badResponse = {
      results: [1, 1, 2, 3, 4, 5].map((idx) => goodItem(idx)),
    };
    provider.enqueue(badResponse);

    const opts = makeOpts({ provider, dryRun: false });
    await runAnalysis(opts);

    const batch = await AnalysisBatchModel.findOne({ batchId: 'v1-g00-A' }).lean();
    expect(batch.status).toBe('failed');
    expect(batch.lastError).toMatch(/Duplicate indices/);
  });

  it('marks batch failed when LLM returns out-of-vocabulary predictedClass', async () => {
    await AnalysisBatchModel.create(batchDoc());

    const provider = new FakeProvider();
    const badResponse = {
      results: Array.from({ length: 6 }, (_, i) => ({
        ...goodItem(i + 1),
        predictedClass: 'tuberculosis', // out-of-vocab
      })),
    };
    provider.enqueue(badResponse);

    const opts = makeOpts({ provider, dryRun: false });
    await runAnalysis(opts);

    const batch = await AnalysisBatchModel.findOne({ batchId: 'v1-g00-A' }).lean();
    expect(batch.status).toBe('failed');
    expect(batch.attempts).toBe(1);
    const count = await ImageAnalysisModel.countDocuments();
    expect(count).toBe(0);
  });

  it('does not store any docs when provider throws a non-429 error', async () => {
    await AnalysisBatchModel.create(batchDoc());

    const provider = new FakeProvider();
    provider.enqueue(new LlmError('Network error', { code: 'LLM_CALL_FAILED' }));

    const opts = makeOpts({ provider, dryRun: false });
    await runAnalysis(opts);

    const batch = await AnalysisBatchModel.findOne({ batchId: 'v1-g00-A' }).lean();
    expect(batch.status).toBe('failed');
    const count = await ImageAnalysisModel.countDocuments();
    expect(count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Test 6: Resumability — finished batches not repeated
// ---------------------------------------------------------------------------

describe('runner — resumability (Test 6)', () => {
  it('skips already-done batches and processes remaining ones', async () => {
    // Create 3 batches: group 0 done, group 1 pending, group 2 pending
    await AnalysisBatchModel.create({
      ...batchDoc({ batchId: 'v1-g00-A', group: 0 }),
      status: 'done',
      finishedAt: new Date(),
    });
    await AnalysisBatchModel.create(batchDoc({ batchId: 'v1-g01-A', group: 1 }));
    await AnalysisBatchModel.create(batchDoc({ batchId: 'v1-g02-A', group: 2 }));

    const provider = new FakeProvider();
    // Only 2 responses needed (group 1 and 2)
    provider.enqueue(goodBatchResponse(6));
    provider.enqueue(goodBatchResponse(6));

    const opts = makeOpts({ provider, dryRun: false });
    const result = await runAnalysis(opts);

    expect(result.batchesDone).toBe(2);
    expect(provider.calls).toHaveLength(2); // only 2 calls made

    // Group 0 still done
    const g0 = await AnalysisBatchModel.findOne({ batchId: 'v1-g00-A' }).lean();
    expect(g0.status).toBe('done');
  });

  it('after simulated kill (--max-batches 1), re-run processes the rest', async () => {
    // Use DIFFERENT imageIds for each batch so the unique index allows 6+6=12 docs
    const idsG0 = ['img-0', 'img-1', 'img-2', 'img-3', 'img-4', 'img-5'];
    const idsG1 = ['img-6', 'img-7', 'img-8', 'img-9', 'img-10', 'img-11'];

    // Build a FakeImageModel that knows all 12 images
    const allImages = [...idsG0, ...idsG1].reduce((acc, id) => {
      acc[id] = { filename: `${id}.jpg` };
      return acc;
    }, {});

    await AnalysisBatchModel.create(batchDoc({ batchId: 'v1-g00-A', group: 0, imageIds: idsG0 }));
    await AnalysisBatchModel.create(batchDoc({ batchId: 'v1-g01-A', group: 1, imageIds: idsG1 }));

    const provider = new FakeProvider();
    provider.enqueue(goodBatchResponse(6));

    // First run: limited to 1 batch
    const opts = makeOpts({
      provider,
      dryRun: false,
      maxBatches: 1,
      ImageModel: new FakeImageModel(allImages),
    });
    const result1 = await runAnalysis(opts);
    expect(result1.batchesDone).toBe(1);
    expect(result1.exitReason).toBe('CAP_REACHED');

    // Second run: processes the remaining batch
    const provider2 = new FakeProvider();
    provider2.enqueue(goodBatchResponse(6));
    const opts2 = makeOpts({
      provider: provider2,
      dryRun: false,
      ImageModel: new FakeImageModel(allImages),
    });
    const result2 = await runAnalysis(opts2);
    expect(result2.batchesDone).toBe(1);
    expect(result2.exitReason).toBe('ALL_DONE');

    // Total ImageAnalysis docs = 6 + 6 = 12 (different imageIds)
    const count = await ImageAnalysisModel.countDocuments();
    expect(count).toBe(12);
  });

  it('no duplicate ImageAnalysis docs on repeated run of the same batch (upsert)', async () => {
    await AnalysisBatchModel.create(batchDoc());

    const provider = new FakeProvider();
    provider.enqueue(goodBatchResponse(6));

    const opts = makeOpts({ provider, dryRun: false });
    await runAnalysis(opts);

    // Manually reset batch to pending to simulate a hypothetical double-run
    await AnalysisBatchModel.updateOne(
      { batchId: 'v1-g00-A' },
      { $set: { status: 'pending', attempts: 0 } },
    );

    const provider2 = new FakeProvider();
    provider2.enqueue(goodBatchResponse(6));
    const opts2 = makeOpts({ provider: provider2, dryRun: false });
    await runAnalysis(opts2);

    // Still 6 unique docs (upsert by { imageId, run, promptVersion })
    const count = await ImageAnalysisModel.countDocuments();
    expect(count).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Test 7: Budget exhaustion — exits cleanly when budget is exhausted
// ---------------------------------------------------------------------------

describe('runner — budget exhaustion (Test 7)', () => {
  it('exits cleanly when reserveUsageFn returns not-ok', async () => {
    await AnalysisBatchModel.create(batchDoc({ batchId: 'v1-g00-A', group: 0 }));
    await AnalysisBatchModel.create(batchDoc({ batchId: 'v1-g01-A', group: 1 }));

    const provider = new FakeProvider();
    // Budget exhausted from the start
    const exhaustedReserve = async () => ({
      ok: false,
      reason: 'BUDGET_REACHED',
      day: 'test',
      count: 16,
      budget: 16,
    });

    const opts = makeOpts({
      provider,
      dryRun: false,
      reserveUsageFn: exhaustedReserve,
    });
    const result = await runAnalysis(opts);

    expect(result.exitReason).toBe('BUDGET_EXHAUSTED');
    expect(result.requestsMade).toBe(0);
    expect(result.batchesDone).toBe(0);

    // No batches were processed — still pending
    const batch = await AnalysisBatchModel.findOne({ batchId: 'v1-g00-A' }).lean();
    expect(batch.status).toBe('pending');
  });

  it('exits cleanly when provider returns 429 LlmError', async () => {
    await AnalysisBatchModel.create(batchDoc());

    const provider = new FakeProvider();
    provider.enqueue(
      new LlmError('Quota exceeded', { code: 'LLM_RATE_LIMIT', status: 429, retryable: true }),
    );

    const opts = makeOpts({ provider, dryRun: false });
    const result = await runAnalysis(opts);

    expect(result.exitReason).toBe('QUOTA_429');
    expect(result.requestsMade).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// validateBatchResponse unit tests
// ---------------------------------------------------------------------------

describe('validateBatchResponse', () => {
  it('passes a valid 6-item response', () => {
    const r = validateBatchResponse(goodBatchResponse(6), 6);
    expect(r.ok).toBe(true);
  });

  it('fails when count mismatches', () => {
    const r = validateBatchResponse(goodBatchResponse(3), 6);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Expected 6 results, got 3/);
  });

  it('fails when index is out of range', () => {
    // index=0 fails Zod validation (min 1), reported as SCHEMA_INVALID
    const bad = { results: [goodItem(0), ...Array.from({ length: 5 }, (_, i) => goodItem(i + 2))] };
    const r = validateBatchResponse(bad, 6);
    expect(r.ok).toBe(false);
    // Zod catches index < 1 as schema invalid before our range check
    expect(r.error).toMatch(/Schema invalid|out of range/);
  });

  it('fails when indices are duplicated', () => {
    const bad = {
      results: [goodItem(1), goodItem(1), goodItem(2), goodItem(3), goodItem(4), goodItem(5)],
    };
    const r = validateBatchResponse(bad, 6);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Duplicate/);
  });

  it('fails on schema violation', () => {
    const bad = { results: [{ ...goodItem(1), predictedClass: 'unknown' }] };
    const r = validateBatchResponse(bad, 1);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Schema invalid/);
  });
});
