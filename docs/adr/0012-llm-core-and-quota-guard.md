# ADR 0012: LLM Core Architecture, Daily Quota Guard, and Output Verification

- **Status:** Accepted
- **Date:** 2026-11-05
- **Developer:** Mahdi Moradi
- **Review:** AI Review per `docs/WORKFLOW.md`
- **Context Task:** T07 (LLM Core)

---

## 1. Context and Problem Statement

The educational chest X-ray platform uses Google Gemini (`gemini-3.8-flash`) to generate radiological error explanations and pedagogical narrative reports. However, the operational reality of the free-tier Gemini API presents stringent quota constraints:
- **5 requests / minute**
- **250,000 tokens / minute**
- **20 requests / calendar day (resetting at midnight America/Los_Angeles)**

Furthermore, automated CI test suites must run completely offline without network dependencies, and medical education software must guarantee that hallucinated statistics or speculative diagnoses are never shown to radiology trainees.

---

## 2. Decision Summary

We established a comprehensive, quota-guarded LLM architecture across `@radiology/contracts`, `apps/api`, and `apps/web`:

### 2.1 Provider Abstraction & Execution Modes
Three distinct execution modes controlled by `LLM_MODE`:
1. `cache-only` (default): Serves stored responses or deterministic templates; network access is completely disabled.
2. `fake`: Deterministic in-memory provider used across all unit and integration test suites.
3. `live`: Connects to Gemini Interactions API (`@google/genai`) when explicitly enabled with `GEMINI_API_KEY`.

### 2.2 Quota Guard, Budgeting, and Process Throttling
- **Daily Budget:** Enforced via MongoDB collection `llm_usage` tracking calendar dates in `America/Los_Angeles` (`Intl.DateTimeFormat('en-CA', { timeZone })`).
- **Atomic Slot Reservation:** Live calls reserve a slot via atomic `findOneAndUpdate({ day, exhausted: false, count: { $lt: budget } }, { $inc: { count: 1 } })`. When budget is reached, calls fall back to deterministic templates without failing requests.
- **Inter-process Throttling:** Calls are spaced by at least `LLM_MIN_INTERVAL_MS` (default 13,000 ms) using stored `lastCallAt` in MongoDB.
- **429 Circuit Breaker:** On HTTP 429, the system waits and retries once; a second consecutive 429 sets `exhausted: true` for the remainder of the Pacific day.

### 2.3 Explanation Key Deviation (Deviation from Skill)
- **Design Deviation:** Diagnostic error explanations are keyed by `(lang, trueClass, userAnswer)` — covering 6 canonical confusion pairs (`covid19:pneumonia`, `covid19:normal`, `pneumonia:covid19`, `pneumonia:normal`, `normal:covid19`, `normal:pneumonia`) — rather than per-image or per-bucket.
- **Rationale:** Reduces required cache entries from hundreds down to exactly 6 items, enabling offline demonstration mode and batch pre-generation using a single request.
- **Trigger Rule:** The `/sessions/:id/explanations` endpoint serves strictly from cache or fallback; it never triggers live Gemini calls. Live calls are reserved exclusively for personalized session narratives (`/sessions/:id/report-narrative`).

### 2.4 Hallucination Guard & Digit Normalization
- All percentages and numerical inputs are rounded to integers before prompting.
- The output guard (`guard.js`) parses all strings in generated JSON:
  - Rejects any presence of literal percent characters (`%` or Persian `٪`).
  - Normalizes Persian digits (`۰-۹`) and Arabic-Indic digits (`٠-٩`) to ASCII digits.
  - Extracts all digit sequences and strictly verifies that every number exists in the allowed input numbers set (including '3' for recommendations and '19' for COVID-19). Any extraneous number triggers an immediate fallback.

### 2.5 Grounded Knowledge Base & Review Status
- 6 medical knowledge base markdown files in `apps/api/src/modules/llm/kb/` containing exclusively verified seed facts.
- Frontmatter maintains `reviewed: false` and `sources: []` until clinician review.
- UI displays a prominent «پیش‌نویس» (Draft) badge and the required educational disclaimer (`disclaimer.educational`).

### 2.6 Portable Cache Export & Import
- Pair explanations are marked `portable: true`.
- `npm run llm:cache:export` and `npm run llm:cache:import` allow checking in seed data (`apps/api/seed/llm-cache.portable.json`) so fresh deployments run offline without burning API quota.

---

## 3. Consequences

### Positive
- Zero risk of unexpected quota exhaustion or surprise billing.
- 100% offline test suite that executes in seconds without network calls.
- Trainees receive consistent, validated feedback even when offline or when quota is depleted.
- Complete privacy protection: prompts contain no trainee names, emails, or MongoDB identifiers.

### Negative / Trade-offs
- Explanations are disease-pair specific rather than image-specific; subtle intra-class variations depend on the trainee's visual inspection of the image.
