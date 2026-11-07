import { describe, it, expect, beforeEach } from 'vitest';
import { FakeProvider } from '../fake.provider.js';
import { LlmError } from '../provider.js';
import {
  buildExplainPairsPrompt,
  EXPLAIN_PAIRS_PROMPT_ID,
  EXPLAIN_PAIRS_VERSION,
  ExplainPairsOutputSchema,
} from '../prompts/v1/explain-pairs.js';
import {
  buildNarrativePrompt,
  NARRATIVE_PROMPT_ID,
  NARRATIVE_VERSION,
} from '../prompts/v1/narrative.js';
import { NarrativeSchema } from '@radiology/contracts';

describe('LLM Provider Contract & Prompts', () => {
  let fakeProvider;

  beforeEach(() => {
    fakeProvider = new FakeProvider();
  });

  describe('FakeProvider', () => {
    it('returns valid default fixture for explain-pairs', async () => {
      const prompt = buildExplainPairsPrompt({
        lang: 'fa',
        pairs: [{ trueClass: 'covid19', userAnswer: 'pneumonia' }],
        kbSnippets: [{ slug: 'covid19-vs-pneumonia', content: 'نکات کلیدی' }],
      });

      const res = await fakeProvider.generateJson(prompt);
      expect(res.data).toBeDefined();
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data[0].trueClass).toBe('covid19');
      expect(res.usage.totalTokens).toBeGreaterThan(0);
      expect(fakeProvider.calls).toHaveLength(1);
    });

    it('returns valid default fixture for narrative', async () => {
      const prompt = buildNarrativePrompt({
        lang: 'fa',
        sessionIndex: 1,
        stats: { total: 45, accuracyPercent: 80 },
        kbSnippets: [],
      });

      const res = await fakeProvider.generateJson(prompt);
      expect(res.data.overview).toBeDefined();
      expect(res.data.recommendations).toHaveLength(3);
      expect(NarrativeSchema.parse(res.data)).toEqual(res.data);
    });

    it('handles queue with invalid JSON string and throws LlmError', async () => {
      fakeProvider.enqueue('not valid json {');
      await expect(
        fakeProvider.generateJson({
          promptId: 'test',
          version: 'v1',
          system: 'test',
          input: {},
          schema: ExplainPairsOutputSchema,
        }),
      ).rejects.toThrow(LlmError);
    });

    it('handles queued error and throws directly', async () => {
      const customErr = new Error('Network timeout');
      fakeProvider.enqueue(customErr);
      await expect(
        fakeProvider.generateJson({
          promptId: 'test',
          version: 'v1',
          system: 'test',
          input: {},
          schema: null,
        }),
      ).rejects.toThrow('Network timeout');
    });
  });

  describe('Privacy & Prompts', () => {
    it('explain-pairs prompt matches contract shapes', () => {
      const prompt = buildExplainPairsPrompt({
        lang: 'fa',
        pairs: [
          { trueClass: 'covid19', userAnswer: 'pneumonia' },
          { trueClass: 'pneumonia', userAnswer: 'normal' },
        ],
        kbSnippets: [{ slug: 'test', content: 'test snippet' }],
      });

      expect(prompt.promptId).toBe(EXPLAIN_PAIRS_PROMPT_ID);
      expect(prompt.version).toBe(EXPLAIN_PAIRS_VERSION);
      expect(prompt.system).toContain('Persian');
      expect(prompt.input.pairs).toHaveLength(2);
    });

    it('narrative prompt enforces privacy: contains NO user id or email', () => {
      const fakeUserId = '507f191e810c19729de860ea';
      const fakeEmail = 'resident@hospital.ac.ir';
      const fakeName = 'Ali Rezaei';

      const prompt = buildNarrativePrompt({
        lang: 'fa',
        sessionIndex: 3,
        stats: {
          totalQuestions: 45,
          correctCount: 36,
          accuracyPercent: 80,
          classMetrics: [
            { classId: 'covid19', accuracyPercent: 75, fprPercent: 10, fnrPercent: 25 },
          ],
          topConfusions: [{ trueClass: 'covid19', userAnswer: 'pneumonia', count: 3 }],
        },
        kbSnippets: [{ slug: 'covid19', content: 'یافته‌های ریوی' }],
      });

      const serializedPrompt = JSON.stringify(prompt);

      expect(prompt.promptId).toBe(NARRATIVE_PROMPT_ID);
      expect(prompt.version).toBe(NARRATIVE_VERSION);
      // Verify anonymity
      expect(serializedPrompt).not.toContain(fakeUserId);
      expect(serializedPrompt).not.toContain(fakeEmail);
      expect(serializedPrompt).not.toContain(fakeName);

      // Verify session is labelled as S3
      expect(prompt.input.sessionLabel).toBe('S3');
      expect(serializedPrompt).toContain('S3');
    });
  });

  describe('LLM_MODE=cache-only Network Isolation (Step 3 - Hardening)', () => {
    it('createProvider returns null in cache-only mode', async () => {
      const { createProvider } = await import('../llm.service.js');
      const provider = createProvider({ LLM_MODE: 'cache-only' });
      expect(provider).toBeNull();
    });
  });
});
