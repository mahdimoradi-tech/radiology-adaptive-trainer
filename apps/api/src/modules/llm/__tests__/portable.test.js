import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { setupTestDb } from '../../../../test/helpers/testDb.js';
import { LlmCache, setCachedResponse } from '../cache.js';
import { exportPortableCache, importPortableCache } from '../portable.js';

describe('LLM Cache Portable Export & Import', () => {
  let testDb;
  let tempFilePath;

  beforeAll(async () => {
    testDb = await setupTestDb();
    await LlmCache.syncIndexes();
    tempFilePath = path.join(os.tmpdir(), `test-llm-cache-portable-${Date.now()}.json`);
  });

  afterAll(async () => {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    if (testDb) {
      await testDb.teardown();
    }
  });

  beforeEach(async () => {
    await testDb.clearCollections();
  });

  it('performs complete round trip export and import on temporary database', async () => {
    // 1. Seed two portable entries and one non-portable entry
    await setCachedResponse({
      promptId: 'explain-pairs',
      version: 'v1',
      input: { lang: 'fa', trueClass: 'covid19', userAnswer: 'pneumonia' },
      response: { whatToLookFor: ['یافته ۱'], whyConfused: 'دلیل ۱', tip: 'نکته ۱' },
      portable: true,
      lang: 'fa',
    });

    await setCachedResponse({
      promptId: 'explain-pairs',
      version: 'v1',
      input: { lang: 'fa', trueClass: 'pneumonia', userAnswer: 'normal' },
      response: { whatToLookFor: ['یافته ۲'], whyConfused: 'دلیل ۲', tip: 'نکته ۲' },
      portable: true,
      lang: 'fa',
    });

    // Non-portable narrative entry
    await setCachedResponse({
      promptId: 'narrative',
      version: 'v1',
      input: { sessionLabel: 'S1' },
      response: { overview: 'گزارش غیرقابل حمل' },
      portable: false,
      lang: 'fa',
    });

    // Verify initial DB state
    expect(await LlmCache.countDocuments()).toBe(3);
    expect(await LlmCache.countDocuments({ portable: true })).toBe(2);

    // 2. Export portable entries
    const exportResult = await exportPortableCache(tempFilePath);
    expect(exportResult.exportedCount).toBe(2);
    expect(fs.existsSync(tempFilePath)).toBe(true);

    const fileContent = JSON.parse(fs.readFileSync(tempFilePath, 'utf8'));
    expect(fileContent).toHaveLength(2);
    expect(fileContent[0].promptId).toBe('explain-pairs');

    // 3. Wipe database completely
    await testDb.clearCollections();
    expect(await LlmCache.countDocuments()).toBe(0);

    // 4. Import from file
    const importResult = await importPortableCache(tempFilePath);
    expect(importResult.importedCount).toBe(2);

    // 5. Verify restored state
    expect(await LlmCache.countDocuments()).toBe(2);
    const restored = await LlmCache.find().sort({ key: 1 }).lean();
    expect(restored[0].portable).toBe(true);
    expect(restored[0].response.whatToLookFor).toBeDefined();
  });
});
