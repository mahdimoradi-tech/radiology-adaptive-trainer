## Task

- **Task ID:** T07
- **Branch:** feat/T07-llm-core
- **Review:** AI review per `docs/WORKFLOW.md`

## Summary

### What

- Built complete, quota-safe LLM core and feedback layer for chest radiograph training:
  - **Contracts & Schemas (`packages/contracts/src/llm.js`):** Defined `LLM_MODES` (`live`, `cache-only`, `fake`), `LangSchema` (`fa`, `en`), `LlmSourceSchema` (`llm`, `cache`, `fallback`), `ExplanationPairSchema`, `ExplanationItemSchema`, `ExplanationsResponseSchema`, `NarrativeSchema` (with length caps and exactly 3 recommendations), `NarrativeResponseSchema`, and `AdminLlmStatusSchema`.
  - **Digit Normalization & Anti-Hallucination Guard (`guard.js`):** Pure verification functions converting Persian/Arabic-Indic digits to ASCII, detecting percent signs (`%` and `٪`), and rejecting any unstated numbers not present in the input integer whitelist (whitelisting '3' for recommendations and '19' for COVID-19).
  - **Provider Abstraction (`provider.js`, `fake.provider.js`, `gemini.provider.js`):** Uniform provider interface `generateJson({ promptId, version, system, input, schema, images, timeoutMs })`. Deterministic fake provider with call inspection and queued outcomes for offline testing. Gemini provider using official `@google/genai` (version 2.32.0) Interactions API with structured JSON output and 429 quota handling.
  - **Mongo Cache & Daily Quota Guard (`cache.js`, `budget.js`):** SHA-256 keyed cache (`llm_cache`). Atomic daily reservation in `llm_usage` tracking Pacific calendar days (`America/Los_Angeles`). Inter-call process throttle (`LLM_MIN_INTERVAL_MS=13000`), and circuit breaker marking `exhausted=true` on repeated 429 errors.
  - **Medical Knowledge Base & Retrieval (`kb/*.md`, `retrieval.js`):** 6 markdown files with strictly grounded, non-hallucinated medical facts (`reviewed: false`, `sources: []`). Simple keyword-scoring retrieval ranking pair comparison articles first (max 3 chunks).
  - **Deterministic Fallbacks & Explanation Endpoint (`fallback.js`, `controller.js`, `routes.js`):** Pre-crafted Persian and English templates for all 6 confusion pairs and narrative reports. `POST /api/sessions/:id/explanations` serving strictly from cache or fallback (never calling Gemini live).
  - **Session Narrative & Instructor Status Endpoints:** `POST /api/sessions/:id/report-narrative` with per-user rate limiting (30 req/user/hour), cache -> live -> fallback routing, and `GET /api/admin/llm/status` for instructor quota monitoring.
  - **Portable Cache Export/Import (`portable.js`):** `npm run llm:cache:export` and `import` for `apps/api/seed/llm-cache.portable.json` to enable instant offline demo execution on fresh databases.
  - **Frontend LLM Integration (`LlmPanel.jsx`, `NarrativePanel.jsx`, `QuestionExplanationPanel.jsx`):** Shared responsive card with source badges (AI, Cached, Template), draft badge, educational disclaimer, skeleton loader, integrated into `ReportPage` and `ReviewPage`.
  - **ADR 0012 & Gemini Notes:** Authored ADR 0012 documenting decisions and `docs/GEMINI-NOTES.md` documenting verified SDK details.

### Why

- Provides radiology residents with immediate, pedagogically sound feedback on their diagnostic errors without risking quota exhaustion or displaying ungrounded AI hallucinations.

---

## Step 0: Gemini Reconnaissance Findings

1. **SDK & API:** Installed `@google/genai@2.32.0`. Uses client `new GoogleGenAI({ apiKey })` and `client.interactions.create({...})` (Interactions API).
2. **Structured Output:** Configured via `response_format: { type: 'text', mime_type: 'application/json', schema }`. Zod 4's `z.toJSONSchema` converts schemas directly to compliant JSON Schema.
3. **Response Parsing:** Read directly from `interaction.output_text` and validated against Zod schemas.
4. **Token Usage:** Populated in `interaction.usage.total_input_tokens`, `total_output_tokens`, and `total_tokens`.
5. **429 Handling:** Identified via `status: 429` and `code: 'RESOURCE_EXHAUSTED'`. Backoff protocol waits 65s and retries once before tripping the daily circuit breaker.

---

## Dependencies Added

| Workspace | Package | Version | Purpose |
|---|---|---|---|
| `@radiology/api` | `@google/genai` | `^2.32.0` | Official Google GenAI SDK for Gemini Interactions API |

---

## Verification Evidence

### 1. Test Suite Output
```
 Test Files  55 passed (55)
      Tests  347 passed (347)
   Start at  12:37:18
   Duration  17.97s
```

### 2. Lint Verification Output
```
> radiology-adaptive-trainer@0.0.1 lint
> eslint . && node scripts/check-rtl-classes.js

✔ RTL Violation Check Passed: All files in D:\university\pamphlet\bachelor-project\radiology-adaptive-trainer\apps\web\src use logical RTL utilities.
```

### 3. Build Verification Output
```
> radiology-adaptive-trainer@0.0.1 build
> npm run build --workspaces --if-present
✓ built in 397ms
```

---

## Review Checklist (Self-Review / AI Review per WORKFLOW)

- [x] Acceptance criteria met with concrete command evidence.
- [x] Zero network calls in tests or CI (`fake` provider fixtures throughout).
- [x] Quota guard, throttle, and 429 circuit breaker tested and verified.
- [x] Anti-hallucination guard tested against %, ٪, and unknown numbers.
- [x] Prompts contain no trainee personal data (user id, name, email).
- [x] KB files have `reviewed: false` and empty `sources: []`.
- [x] Clean offline seed file (`llm-cache.portable.json`) committed.
- [x] Postman collection updated with 3 new LLM endpoints.
- [x] ADR 0012 and `docs/GEMINI-NOTES.md` documented.
- [x] All 55 test files (347 tests) pass; lint and build pass.
