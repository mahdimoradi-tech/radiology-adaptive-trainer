---
name: llm-feedback
description: Core spec for all LLM (Gemini) usage in the platform (plain JavaScript) - provider abstraction, modes (live, cache-only, fake), structured JSON outputs, knowledge-base grounding, caching, rate limits, fallbacks, safety rules, per-error explanations and session narrative reports, plus tests with a fake provider. Use this skill whenever you touch apps/api/src/modules/llm, any prompt, the Gemini SDK, explanations, feedback text, the knowledge base, or when anyone mentions LLM, Gemini, prompt, AI feedback, or tutor. For image analysis and question generation also load the question-generation skill.
---

# LLM core + feedback (apps/api/src/modules/llm)

## Non-negotiable safety rules
1. The LLM never decides a diagnostic label and never computes statistics. Labels come from the dataset; every number (FPR, FNR, accuracy, counts) comes from `packages/engine`. The LLM only narrates/explains what it is given.
2. Educational use only: never treatment advice or a diagnosis for a real person. Every LLM panel shows `disclaimer.educational`.
3. Grounding: use ONLY the knowledge-base (KB) snippets and statistics passed in the prompt. If they do not cover the question, say so briefly.
4. KB files have front-matter `reviewed: false` until the instructor/clinician approves; the UI shows a "draft content" badge while false.
5. No personal data in prompts (no name/email/user id); only an anonymous session label. Images sent are public-dataset images only.
6. Output must parse with a Zod schema. If it fails after 1 retry, or contains a `%` sign or a digit sequence not present in the input, discard it and use the deterministic fallback template.

## Gemini facts (verified Oct 2026; re-check docs before coding)
- npm `@google/genai` >= 2.3.0; use the **Interactions API** (default since June 2026; `generateContent` is legacy). Do NOT use the old `@google/generative-ai` package. Client: `new GoogleGenAI({})` reads `GEMINI_API_KEY` from the environment.
- Model id from env `GEMINI_MODEL` (default `gemini-3.8-flash`). Do NOT send `temperature`, `top_p`, `top_k` or prefilled model turns for Gemini 3.x.
- Structured outputs: build the JSON Schema from Zod (`z.toJSONSchema`, Zod 4).
- Before writing call code, read the current Interactions + structured-output pages on ai.google.dev (Context7 or fetch) and copy the exact request shape. Optional official skill: `npx skills add google-gemini/gemini-skills --skill gemini-interactions-api` (ask the operator before installing any third-party skill).
- The team has VPN access to the API. Free-tier quotas are limited: throttle, retry with backoff on 429, resume interrupted batches.

## Modes (`LLM_MODE`)
`live` (call Gemini, cache results) · `cache-only` (never call the network; only stored results; used for demos and offline work) · `fake` (deterministic fixtures; used by ALL tests). `LLM_ENABLED=false` disables LLM panels (fallback templates).

## Quota guard & Throttling (ADR 0012)
- Real free quota is 5 req/min, 250k tokens/min, 20 requests/day (Pacific day: `America/Los_Angeles`).
- Hard daily budget: `LLM_DAILY_REQUEST_BUDGET=16` reserved atomically in Mongo collection `llm_usage`.
- Throttle spacing: `LLM_MIN_INTERVAL_MS=13000` between consecutive live calls across all processes.
- 429 Handling: wait 65s and retry ONCE; a second 429 marks `exhausted = true` for the Pacific day.
- Deviation on explanations: Keyed by `(lang, trueClass, userAnswer)` for 6 canonical confusion pairs (not per-image), pre-generated and stored in portable cache (`apps/api/seed/llm-cache.portable.json`). The `/api/sessions/:id/explanations` endpoint serves strictly from cache/fallback and NEVER calls Gemini live. Only `/api/sessions/:id/report-narrative` may trigger a live call.
- Anti-hallucination guard (`guard.js`): Rejects `%` or `٪`, normalizes Persian/Arabic digits, and verifies all numbers against input integers (including '3' recommendations and '19' for COVID-19).

## Architecture
```
modules/llm/
  provider.js          // contract: generateJson({ promptId, version, system, input, schema, images? })
  gemini.provider.js   // real implementation: timeout 30s, 2 retries, backoff 500ms/1500ms, 429-aware
  fake.provider.js     // deterministic fixtures
  prompts/v1/*.js      // prompt builders; version is part of the cache key
  schemas.js           // Zod schemas of all outputs (shared shapes live in packages/contracts)
  kb/*.md              // knowledge base (front-matter: reviewed, tags, classes)
  retrieval.js         // keyword retrieval: top-3 KB chunks by class pair + tags (no vector DB)
  cache.js             // Mongo `llm_cache`: key = sha256(promptId+version+canonical input JSON)
  fallback.js          // deterministic fa/en templates
  llm.service.js       // retrieve -> cache -> provider -> validate -> fallback
```
Env: `LLM_MODE`, `LLM_ENABLED`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `LLM_RATE_LIMIT_PER_USER_PER_HOUR=30`. Log provider, model, promptVersion, latency, cacheHit, validation result (never personal data).

## Features in this skill
- **F1 Error explanation (Must)** `POST /api/sessions/:id/explanations`: input `{ lang, trueClass, userAnswer, bucket, kbSnippets[] }` for WRONG answers only, batched up to 10 per call. Output `{ items: [{ questionId, whatToLookFor: string[<=3], whyConfused, tip }] }`, each string <= 160 chars in `lang`.
- **F2 Session narrative (Must)** `POST /api/sessions/:id/report-narrative`: input = engine stats JSON (confusion matrix, per-class FPR/FNR/accuracy, trend, top confusion pairs, next-test plan). Output `{ overview, strengths[<=3], weaknesses[<=3], patterns[<=3], recommendations[3] }`.
- **F3 Study plan (Should)**: text from the engine's `plan`. **F4 Tutor chat (Could)**: grounded Q&A, refuses out-of-scope, never medical advice, max 6 turns.

## Prompt skeleton (system part, v1)
"You are a teaching assistant for radiology residents using a training tool. Write in {lang}. Use ONLY the provided knowledge-base snippets and statistics. Do not invent findings, numbers, percentages or references. Do not give medical advice or diagnose real patients. Be concise and concrete. Return JSON that matches the schema exactly." Keep prompts in files, never inline in services.

## Tests (never hit the real API)
Fake provider fixtures; schema validation; retry-then-fallback; cache hit/miss; `cache-only` never calls the provider; rate limit; `%`/unknown-digit guard; language switch; KB retrieval for (covid19 vs pneumonia). One manual script `apps/api/scripts/llm-smoke.js` (not in CI) calls the real API once using the operator's `.env`.
