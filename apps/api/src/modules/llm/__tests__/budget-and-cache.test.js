import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb } from '../../../../test/helpers/testDb.js';
import {
  computeCacheKey,
  canonicalJson,
  getCachedResponse,
  setCachedResponse,
  countCacheEntries,
  LlmCache,
} from '../cache.js';
import {
  getPacificDay,
  reserveUsage,
  enforceThrottle,
  markExhausted,
  getUsageStatus,
  LlmUsage,
} from '../budget.js';

describe('LLM Cache and Budget Management', () => {
  let testDb;

  beforeAll(async () => {
    testDb = await setupTestDb();
    await LlmCache.syncIndexes();
    await LlmUsage.syncIndexes();
  });

  afterAll(async () => {
    if (testDb) {
      await testDb.teardown();
    }
  });

  beforeEach(async () => {
    await testDb.clearCollections();
  });

  describe('Cache', () => {
    it('canonicalJson sorts keys deterministically', () => {
      const obj1 = { z: 1, a: 2, m: { b: 3, a: 4 } };
      const obj2 = { a: 2, m: { a: 4, b: 3 }, z: 1 };
      expect(canonicalJson(obj1)).toBe(canonicalJson(obj2));
    });

    it('computeCacheKey produces deterministic hash for key order variations', () => {
      const key1 = computeCacheKey('promptA', 'v1', { beta: 2, alpha: 1 });
      const key2 = computeCacheKey('promptA', 'v1', { alpha: 1, beta: 2 });
      expect(key1).toBe(key2);
    });

    it('computeCacheKey produces different hash on version or prompt change', () => {
      const keyV1 = computeCacheKey('promptA', 'v1', { a: 1 });
      const keyV2 = computeCacheKey('promptA', 'v2', { a: 1 });
      const keyPromptB = computeCacheKey('promptB', 'v1', { a: 1 });
      expect(keyV1).not.toBe(keyV2);
      expect(keyV1).not.toBe(keyPromptB);
    });

    it('stores and retrieves cached items and handles misses', async () => {
      const input = { lang: 'fa', trueClass: 'covid19', userAnswer: 'pneumonia' };
      const responseData = { whatToLookFor: ['کدورت محیطی'] };

      // Cache miss initially
      const miss = await getCachedResponse('explain-pairs', 'v1', input);
      expect(miss).toBeNull();

      // Store in cache
      await setCachedResponse({
        promptId: 'explain-pairs',
        version: 'v1',
        input,
        response: responseData,
        portable: true,
        lang: 'fa',
      });

      // Cache hit
      const hit = await getCachedResponse('explain-pairs', 'v1', input);
      expect(hit).toEqual(responseData);

      // Version mismatch is a miss
      const versionMiss = await getCachedResponse('explain-pairs', 'v2', input);
      expect(versionMiss).toBeNull();

      // Count entries
      const counts = await countCacheEntries();
      expect(counts.totalEntries).toBe(1);
      expect(counts.portableEntries).toBe(1);
    });
  });

  describe('Budget & Usage', () => {
    it('calculates Pacific calendar day with timezone awareness', () => {
      // 2026-11-05T07:30:00Z is 23:30 on Nov 4 in Pacific Standard Time (UTC-8)
      const pstLateNov4 = new Date('2026-11-05T07:30:00Z');
      expect(getPacificDay(pstLateNov4)).toBe('2026-11-04');

      // 2026-11-05T08:30:00Z is 00:30 on Nov 5 in Pacific Standard Time (UTC-8)
      const pstEarlyNov5 = new Date('2026-11-05T08:30:00Z');
      expect(getPacificDay(pstEarlyNov5)).toBe('2026-11-05');
    });

    it('increments usage count atomically up to budget', async () => {
      const budget = 3;
      const date = new Date('2026-11-05T12:00:00Z');

      const res1 = await reserveUsage({ budget, date });
      expect(res1.ok).toBe(true);
      expect(res1.count).toBe(1);

      const res2 = await reserveUsage({ budget, date });
      expect(res2.ok).toBe(true);
      expect(res2.count).toBe(2);

      const res3 = await reserveUsage({ budget, date });
      expect(res3.ok).toBe(true);
      expect(res3.count).toBe(3);

      // 4th call exceeds budget
      const res4 = await reserveUsage({ budget, date });
      expect(res4.ok).toBe(false);
      expect(res4.reason).toBe('BUDGET_REACHED');
      expect(res4.count).toBe(3);
    });

    it('enforces atomic concurrency: two parallel reserves at count = budget - 1 -> exactly one succeeds', async () => {
      const budget = 2;
      const date = new Date('2026-11-05T12:00:00Z');

      // 1st call reaches budget - 1 (1 out of 2)
      const first = await reserveUsage({ budget, date });
      expect(first.ok).toBe(true);
      expect(first.count).toBe(1);

      // Launch two parallel reservations for the final slot
      const [attemptA, attemptB] = await Promise.all([
        reserveUsage({ budget, date }),
        reserveUsage({ budget, date }),
      ]);

      const successCount = [attemptA, attemptB].filter((r) => r.ok).length;
      const failCount = [attemptA, attemptB].filter((r) => !r.ok).length;

      expect(successCount).toBe(1);
      expect(failCount).toBe(1);

      const status = await getUsageStatus({ budget, date });
      expect(status.count).toBe(2);
    });

    it('stops reservations when marked exhausted (429 circuit breaker)', async () => {
      const budget = 16;
      const date = new Date('2026-11-05T12:00:00Z');

      const res1 = await reserveUsage({ budget, date });
      expect(res1.ok).toBe(true);

      // Mark exhausted (e.g. after second 429)
      await markExhausted(date);

      const res2 = await reserveUsage({ budget, date });
      expect(res2.ok).toBe(false);
      expect(res2.reason).toBe('EXHAUSTED');

      const status = await getUsageStatus({ budget, date });
      expect(status.exhausted).toBe(true);
    });

    it('handles Pacific day rollover with fresh budget', async () => {
      const budget = 2;
      const day1 = new Date('2026-11-05T12:00:00Z');
      const day2 = new Date('2026-11-06T12:00:00Z');

      // Fill day 1
      await reserveUsage({ budget, date: day1 });
      await reserveUsage({ budget, date: day1 });
      const fullDay1 = await reserveUsage({ budget, date: day1 });
      expect(fullDay1.ok).toBe(false);

      // Next Pacific day has a clean budget
      const nextDay = await reserveUsage({ budget, date: day2 });
      expect(nextDay.ok).toBe(true);
      expect(nextDay.count).toBe(1);
      expect(nextDay.day).toBe(getPacificDay(day2));
    });

    it('enforces throttle interval between consecutive calls', async () => {
      const minIntervalMs = 13000;
      const date1 = new Date('2026-11-05T12:00:00.000Z');
      await reserveUsage({ budget: 16, date: date1 });

      const sleepSpy = vi.fn().mockResolvedValue(undefined);

      // Call 5 seconds later (elapsed = 5000 < 13000 -> wait 8000)
      const date2 = new Date('2026-11-05T12:00:05.000Z');
      const waited = await enforceThrottle({
        minIntervalMs,
        date: date2,
        sleepFn: sleepSpy,
      });

      expect(waited).toBe(8000);
      expect(sleepSpy).toHaveBeenCalledWith(8000);

      // Call 15 seconds after date1 (elapsed = 15000 > 13000 -> no wait)
      const date3 = new Date('2026-11-05T12:00:15.000Z');
      const waitedZero = await enforceThrottle({
        minIntervalMs,
        date: date3,
        sleepFn: sleepSpy,
      });

      expect(waitedZero).toBe(0);
    });
  });
});
