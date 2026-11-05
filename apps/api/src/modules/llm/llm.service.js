import { loadEnv } from '../../config/env.js';
import { FakeProvider } from './fake.provider.js';
import { GeminiProvider } from './gemini.provider.js';
import { getCachedResponse, setCachedResponse } from './cache.js';
import { reserveUsage, enforceThrottle, markExhausted } from './budget.js';
import { retrieveKbSnippets } from './retrieval.js';
import { getExplanationFallback, getNarrativeFallback } from './fallback.js';
import { extractNumbers, passesGuard } from './guard.js';
import {
  buildExplainPairsPrompt,
  EXPLAIN_PAIRS_PROMPT_ID,
  EXPLAIN_PAIRS_VERSION,
} from './prompts/v1/explain-pairs.js';
import { buildNarrativePrompt } from './prompts/v1/narrative.js';
import { CLASS_IDS } from '@radiology/contracts';

let singletonFakeProvider = null;

/**
 * Returns the singleton fake provider for tests or creates a new one.
 * @returns {FakeProvider}
 */
export function getFakeProvider() {
  if (!singletonFakeProvider) {
    singletonFakeProvider = new FakeProvider();
  }
  return singletonFakeProvider;
}

/**
 * Instantiates the appropriate provider based on environment mode.
 * @param {ReturnType<typeof loadEnv>} env
 * @returns {import('./fake.provider.js').FakeProvider | GeminiProvider}
 */
export function createProvider(env) {
  if (env.LLM_MODE === 'fake') {
    return getFakeProvider();
  }
  if (env.LLM_MODE === 'live') {
    return new GeminiProvider({
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL,
      timeoutMs: env.LLM_TIMEOUT_MS,
    });
  }
  // cache-only mode does not instantiate a live provider
  return null;
}

/**
 * Generates explanations for a session's wrong answers.
 * Serves strictly from cache or deterministic fallbacks (never calls Gemini live).
 *
 * @param {Object} options
 * @param {any} options.session
 * @param {any[]} options.responses
 * @param {'fa'|'en'} [options.lang='fa']
 * @returns {Promise<{ source: 'cache'|'fallback', reviewed: boolean, items: any[] }>}
 */
export async function getSessionExplanations({ session: _session, responses, lang = 'fa' }) {
  // Filter for questions answered incorrectly
  const wrongResponses = responses
    .filter((r) => r.answer && r.trueClass && r.answer !== r.trueClass)
    .sort((a, b) => (a.questionNo ?? a.no ?? 0) - (b.questionNo ?? b.no ?? 0));

  if (wrongResponses.length === 0) {
    return {
      source: 'cache',
      reviewed: false,
      items: [],
    };
  }

  let anyCached = false;
  let allCached = true;
  const items = [];

  for (const resp of wrongResponses) {
    const questionNo = resp.questionNo ?? resp.no;
    const pairInput = {
      lang,
      trueClass: resp.trueClass,
      userAnswer: resp.answer,
    };

    // Look up in cache
    const cached = await getCachedResponse(
      EXPLAIN_PAIRS_PROMPT_ID,
      EXPLAIN_PAIRS_VERSION,
      pairInput,
    );

    if (cached) {
      anyCached = true;
      items.push({
        no: questionNo,
        trueClass: resp.trueClass,
        userAnswer: resp.answer,
        whatToLookFor: cached.whatToLookFor,
        whyConfused: cached.whyConfused,
        tip: cached.tip,
      });
    } else {
      allCached = false;
      const fallback = getExplanationFallback(resp.trueClass, resp.answer, lang);
      items.push({
        no: questionNo,
        trueClass: resp.trueClass,
        userAnswer: resp.answer,
        whatToLookFor: fallback.whatToLookFor,
        whyConfused: fallback.whyConfused,
        tip: fallback.tip,
      });
    }
  }

  const source = allCached || anyCached ? 'cache' : 'fallback';

  return {
    source,
    reviewed: false,
    items,
  };
}

/**
 * Sanitizes metrics input by rounding all percentages and metrics to integers.
 * @param {any} rawStats
 * @returns {any}
 */
export function sanitizeStatsForPrompt(rawStats) {
  const accuracy = Math.round(rawStats.accuracy ?? rawStats.overallAccuracyPercent ?? 0);
  const total = rawStats.total ?? rawStats.totalQuestions ?? 0;
  const correct = rawStats.correct ?? rawStats.correctCount ?? 0;

  const classMetrics = Array.isArray(rawStats.classMetrics)
    ? rawStats.classMetrics.map((cm) => ({
        classId: cm.classId,
        support: cm.support ?? 0,
        correctCount: cm.correctCount ?? 0,
        accuracyPercent: Math.round(cm.accuracyPercent ?? (cm.accuracy ? cm.accuracy * 100 : 0)),
        fprPercent: Math.round(cm.fprPercent ?? (cm.fpr ? cm.fpr * 100 : 0)),
        fnrPercent: Math.round(cm.fnrPercent ?? (cm.fnr ? cm.fnr * 100 : 0)),
      }))
    : [];

  const topConfusions = Array.isArray(rawStats.topConfusions)
    ? rawStats.topConfusions.map((c) => ({
        trueClass: c.trueClass,
        userAnswer: c.userAnswer,
        count: c.count ?? 0,
      }))
    : [];

  return {
    totalQuestions: total,
    correctCount: correct,
    overallAccuracyPercent: accuracy,
    classMetrics,
    topConfusions,
    trend: rawStats.trend || 'stable',
  };
}

/**
 * Generates or retrieves the session narrative report.
 * Tries cache -> live (if permitted and budget available) -> fallback.
 *
 * @param {Object} options
 * @param {any} options.session
 * @param {any} options.rawStats
 * @param {'fa'|'en'} [options.lang='fa']
 * @param {ReturnType<typeof loadEnv>} [options.env]
 * @returns {Promise<{ source: 'llm'|'cache'|'fallback', reviewed: boolean, narrative: any }>}
 */
export async function getSessionNarrative({ session, rawStats, lang = 'fa', env = loadEnv() }) {
  const stats = sanitizeStatsForPrompt(rawStats);
  const sessionIndex = session.index || 1;

  const topClasses = stats.classMetrics.map((c) => c.classId);
  const kbSnippets = retrieveKbSnippets({ classes: topClasses, limit: 3 });

  const prompt = buildNarrativePrompt({
    lang,
    sessionIndex,
    stats,
    kbSnippets,
  });

  // 1. Check cache
  const cached = await getCachedResponse(prompt.promptId, prompt.version, prompt.input);

  if (cached) {
    return {
      source: 'cache',
      reviewed: false,
      narrative: cached,
    };
  }

  // 2. If LLM is disabled or in cache-only mode, jump to fallback
  if (!env.LLM_ENABLED || env.LLM_MODE === 'cache-only') {
    const fallback = getNarrativeFallback(stats, lang);
    return {
      source: 'fallback',
      reviewed: false,
      narrative: fallback,
    };
  }

  // 3. Attempt live / fake provider call with budget and throttle
  const budget = env.LLM_DAILY_REQUEST_BUDGET;
  const reserve = await reserveUsage({ budget });

  if (!reserve.ok) {
    // Budget exhausted -> graceful fallback
    const fallback = getNarrativeFallback(stats, lang);
    return {
      source: 'fallback',
      reviewed: false,
      narrative: fallback,
    };
  }

  // Enforce throttle spacing
  await enforceThrottle({ minIntervalMs: env.LLM_MIN_INTERVAL_MS });

  const provider = createProvider(env);
  let liveResult = null;

  try {
    liveResult = await provider.generateJson(prompt);
  } catch (err) {
    // Handle 429: wait and retry ONCE if budget allows
    if (err.status === 429) {
      const retryReserve = await reserveUsage({ budget });
      if (retryReserve.ok) {
        try {
          await new Promise((r) => setTimeout(r, 1000));
          liveResult = await provider.generateJson(prompt);
        } catch (retryErr) {
          if (retryErr.status === 429) {
            await markExhausted();
          }
        }
      } else {
        await markExhausted();
      }
    }
  }

  // 4. Validate output with Guard (anti-hallucination check)
  if (liveResult && liveResult.data) {
    const allowedNumbers = extractNumbers(stats);
    // Include 3 because prompt specifically asks for 3 recommendations
    allowedNumbers.add('3');
    allowedNumbers.add(String(sessionIndex));
    // Include 19 for COVID-19 disease name
    allowedNumbers.add('19');

    const passes = passesGuard(liveResult.data, allowedNumbers);

    if (passes) {
      // Save to cache
      await setCachedResponse({
        promptId: prompt.promptId,
        version: prompt.version,
        input: prompt.input,
        response: liveResult.data,
        portable: false,
        lang,
      });

      return {
        source: 'llm',
        reviewed: false,
        narrative: liveResult.data,
      };
    }
  }

  // 5. Fallback if call failed or guard rejected
  const fallback = getNarrativeFallback(stats, lang);
  return {
    source: 'fallback',
    reviewed: false,
    narrative: fallback,
  };
}

/**
 * All 6 canonical confusion pairs
 */
export const ALL_CONFUSION_PAIRS = [
  { trueClass: 'covid19', userAnswer: 'pneumonia' },
  { trueClass: 'covid19', userAnswer: 'normal' },
  { trueClass: 'pneumonia', userAnswer: 'covid19' },
  { trueClass: 'pneumonia', userAnswer: 'normal' },
  { trueClass: 'normal', userAnswer: 'covid19' },
  { trueClass: 'normal', userAnswer: 'pneumonia' },
];

/**
 * Pre-generates the 6 confusion pair explanations in a single batch call.
 *
 * @param {Object} options
 * @param {'fa'|'en'} [options.lang='fa']
 * @param {boolean} [options.dryRun=false]
 * @param {ReturnType<typeof loadEnv>} [options.env]
 * @returns {Promise<{ ok: boolean, cachedCount: number, newlyGenerated: number, reason?: string }>}
 */
export async function pregenerateExplanations({ lang = 'fa', dryRun = false, env = loadEnv() }) {
  // Check which pairs are missing from cache
  const missing = [];
  for (const pair of ALL_CONFUSION_PAIRS) {
    const pairInput = { lang, trueClass: pair.trueClass, userAnswer: pair.userAnswer };
    const cached = await getCachedResponse(
      EXPLAIN_PAIRS_PROMPT_ID,
      EXPLAIN_PAIRS_VERSION,
      pairInput,
    );
    if (!cached) {
      missing.push(pair);
    }
  }

  if (missing.length === 0) {
    return { ok: true, cachedCount: ALL_CONFUSION_PAIRS.length, newlyGenerated: 0 };
  }

  // Build prompt
  const kbSnippets = retrieveKbSnippets({ classes: [...CLASS_IDS], limit: 6 });
  const prompt = buildExplainPairsPrompt({
    lang,
    pairs: missing,
    kbSnippets,
  });

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      missingCount: missing.length,
      pairs: missing,
      prompt,
    };
  }

  // Check budget reserve (must have at least 2 requests left)
  const budget = env.LLM_DAILY_REQUEST_BUDGET;
  const reserve = await reserveUsage({ budget });

  if (!reserve.ok || reserve.count > budget - 1) {
    return {
      ok: false,
      reason: 'INSUFFICIENT_BUDGET_RESERVE',
      count: reserve.count,
      budget,
    };
  }

  const provider = createProvider(env);
  const result = await provider.generateJson(prompt);

  if (!Array.isArray(result.data)) {
    throw new Error('Expected array of explanation pairs from LLM');
  }

  // Cache each generated pair as portable
  for (const item of result.data) {
    const pairInput = {
      lang,
      trueClass: item.trueClass,
      userAnswer: item.userAnswer,
    };
    await setCachedResponse({
      promptId: EXPLAIN_PAIRS_PROMPT_ID,
      version: EXPLAIN_PAIRS_VERSION,
      input: pairInput,
      response: {
        whatToLookFor: item.whatToLookFor,
        whyConfused: item.whyConfused,
        tip: item.tip,
      },
      portable: true,
      lang,
    });
  }

  return {
    ok: true,
    cachedCount: ALL_CONFUSION_PAIRS.length,
    newlyGenerated: result.data.length,
  };
}
