# Developer log

Name (as in git): Mahdi Moradi · GitHub: mahdimoradi-tech

## Environment (no secrets)

OS/shell: Windows 11 / PowerShell 5.1 · Node/npm: v24.11.0 / 11.21.1 · MongoDB/mongosh: 8.3 / 2.13.0 · Python/uv: Python 3.11.0 (Python 3.12 + uv pending T01) · Antigravity skills/workflows visible: yes · paper.pdf: present

## Current task

- T14: Bug hunt and security verification (branch `chore/T14-qa-security`, in-review, PR #25).
  - Completed Part B execution (zero application code changes):
    - Authored API route inventory `docs/qa/ROUTE-INVENTORY.md` covering all 31 Express 5 routes.
    - Executed 26-point security audit (`docs/qa/SECURITY-REPORT.md`): 23 PASS, 3 PARTIAL (S06, S16, S22), 0 FAIL.
    - Authored 43 new automated security regression tests across 5 test suites under `apps/api/src/__tests__/security/`:
      - `auth.security.test.js` (12 tests)
      - `authz.security.test.js` (11 tests)
      - `input.security.test.js` (10 tests)
      - `headers.security.test.js` (4 tests)
      - `lifecycle.security.test.js` (6 tests)
    - Logged all findings in `docs/qa/BUG-LOG.md` (BUG-001 through BUG-004) with reproduction commands and proposed severities.
    - Initialized Part A manual browser test run matrix in `docs/qa/manual-run-2026-11-12.md` (M01-M38).
    - Monorepo quality gates verified: `npm run lint` clean, `npm test` passed (771/771 tests across 94 files), `npm run build` clean.
    - Opened PR #25: `chore(qa): security verification report, route inventory, and regression tests (T14)`.

## Done (newest first)

- Completed T13: Real LLM data run, approved question bank, and evaluation seeds (PR #24 merged):
  - Completed all 40/40 analysis batches (120 chest X-ray images, dual-run redundancy with 81.7% raw agreement and Cohen's Kappa 0.713).
  - Validated and exported 69 consensus images to `apps/api/seed/image-analyses.json`.
  - Generated and approved 83 questions across all 3 question types (48 finding, 25 distribution, 10 differential) and 6 confusion pairs, exported to `apps/api/seed/question-bank.approved.json`.
  - Pregenerated 12 portable cache entries for all 6 confusion pairs in Persian and English (`apps/api/seed/llm-cache.portable.json`).
  - Scored 24-item human rubric in `docs/evaluation/question-rubric.csv` (100% scientific OK, mean clarity 4.50/5, distractor plausibility 4.00/5, 100% leak-free).
  - Verified Gate G3 offline import reproducibility with zero network traffic. All 728 tests pass across 89 test files.

- Completed T12: Solo-project documentation cleanup and workflow alignment:
  - Replaced `docs/SOLO-MODE.md` with official `docs/WORKFLOW.md` establishing 5-section development workflow and merge gates.
  - Renamed ADR 0003 to `docs/adr/0003-development-workflow.md` and updated all links.
  - Consolidated developer logging into single `docs/progress/developer-log.md` and removed unused template.
  - Replaced `team-collaboration` skill with `review-workflow` and updated all references.
  - Aligned `AGENTS.md` and agent workflows (`sync.md`, `start-task.md`, `finish-task.md`, `status.md`) for a unified developer workflow.
  - Updated progress board `docs/PROGRESS.md` with status `merged` for T11 and added rows T12-T16c.
  - Simplified pull request template `.github/pull_request_template.md`.
  - Neutralized legacy multi-operator phrasing across core documentation, historical task files, and ADRs without altering any technical data or test counts.
  - Replaced all absolute/local `file:///` hyperlinks with repository-relative references.
  - Zero functional code modified under `apps/`, `packages/`, `ml/`, `scripts/`; all 89 test files and 727 tests pass, lint passes, build passes.

- Completed T11: Hardening, documentation, security review pass, fresh-clone testing, demo script, and release preparation:
  - Authored comprehensive access matrix test in `apps/api/src/__tests__/access-matrix.test.js`:
    - Validates all 31 registered Express routes against `ENDPOINT_ACCESS_MATRIX` with strict bidirectional parity.
    - Proves unauthenticated requests return 401 on all protected endpoints, and public endpoints pass.
    - Proves resident role cannot access instructor routes (403).
    - Proves instructor role cannot access resident training routes (403).
    - Proves foreign resident resource access (sessions, practice sets, private radiograph images) is strictly denied (404).
    - Verified by 67 passing tests.
  - Authored global diagnostic label leakage test in `apps/api/src/__tests__/global-leak.test.js`:
    - Deep recursive scanning for prohibited keys (`trueClass`, `confusedWith`, `bucket`, `difficulty`, `source`, `catalogId`, `imageId`, `filename`, `passwordHash`) across full resident session lifecycle before finish and on all practice endpoints.
    - Scans for forbidden dataset substrings (`cohen`, `kermany`, `figure1`).
    - Verified by 8 passing tests.
  - Completed 11-point security review pass:
    - Enforced `Secure: true` cookie flag in production (`apps/api/src/modules/auth/service.js`, `controller.js`).
    - Disallowed wildcard `*` with credentials in `CORS_ORIGIN` (`apps/api/src/config/env.js`).
    - Verified network isolation in `LLM_MODE=cache-only` with provider error stubs (`provider.test.js`, `endpoints.test.js`).
    - Validated zero committed Gemini API keys (`git grep -n -I -E "AIza..."` returns nothing).
    - Verified 0 vulnerabilities in production dependencies via `npm audit --omit=dev`.
    - Documented all environment variables in `.env.example`.
  - Replaced non-ASCII characters with clean ASCII output in API scripts and `scripts/check-rtl-classes.js` to ensure clean Windows PowerShell output without mojibake.
  - Completely rewrote root `README.md` with educational disclaimer, architecture diagram (Mermaid), prerequisites, quickstart, credentials, environment variables, npm scripts, evaluation reference, limitations, and licenses.
  - Successfully executed fresh-clone test in temp directory outside repo, proving automated setup in 24.9 seconds with zero errors; added `--defaults` flag support to `create-instructor.js` for non-interactive scripting.
  - Authored `docs/DEMO-SCRIPT.md` (12-15 minute live demo guide, screen expectations, failure recovery steps, and defense Q&A) and `docs/DEMO-CHECKLIST.md` (pre-defense hardware, database, browser, and backup checklist).
  - Authored `docs/KNOWN-ISSUES.md` documenting technical debt, dataset confounders, and scientific limitations.
  - Monorepo quality gates: 89 test files, 727 passing unit and integration tests, 0 ESLint warnings, 0 logical RTL utility errors, clean production builds.

- Completed T10: Empirical evaluation pipeline, pure statistical helpers, and reproducible report generator:
  - Authored pure statistical helpers in `@radiology/engine`:
    - `wilsonInterval(k, n, z=1.96)` returning `{ p, low, high }` (clamped to [0,1], nulls for n=0).
    - `cohenKappa(table)` accepting 2D matrix or object-of-objects confusion tables, returning `{ kappa, po, pe }` (nulls for n=0).
    - Re-exported from `@radiology/engine` root.
    - Verified by 10 unit tests in `packages/engine/src/__tests__/stats.test.js`.
  - Implemented E1: Adaptive engine simulation evaluation (`scripts/eval-simulation.js`, `npm run eval:simulation`):
    - Runs 50 paired resident seeds comparing `adaptive`, `random`, and `fixed` policies.
    - Computes mastery rate with Wilson 95% CI, mean ± SD, median [min-max] sessions, and per-class FPR/FNR.
    - Generates `docs/evaluation/simulation.json` and formatted markdown table.
  - Fixed empty denominator formatting across API status scripts:
    - Updated `getAnalysisStatusSummary` in `apps/api/src/modules/analysis/portable.js` to return `null` instead of `1.0` or `0` when totals are zero.
    - Updated `analysis-status.js` and `questions-status.js` to print `N/A` for empty denominators.
    - Verified by unit tests in `apps/api/scripts/__tests__/status-scripts.test.js`.
  - Implemented E2: LLM multimodal image analysis evaluation (`scripts/eval-analysis.js`, `npm run eval:analysis`):
    - Reads portable `apps/api/seed/image-analyses.json` and `ml/artifacts/difficulty.json` without requiring live MongoDB.
    - Evaluates schema validity, auto-validation pass rate, Run A vs Run B agreement and Cohen's kappa.
    - Computes per-class recall, precision, and 3x3 confusion matrix vs trueClass with Wilson CIs.
    - Evaluates DenseNet-121 baseline on the identical subset of images.
    - Breaks down diagnostic accuracy by image source and difficulty bucket.
    - Verified by 3 unit tests in `apps/api/scripts/__tests__/eval-analysis.test.js`.
  - Implemented E3: Question bank quality, rubric export & scoring (`scripts/eval-questions.js`, `npm run eval:questions`):
    - `export-rubric`: Deterministic stratified sampling of up to 24 questions (8 per type) with fixed seed 42 into RFC 4180 CSV `docs/evaluation/question-rubric.csv`.
    - `score`: Aggregates human ratings (scientific OK, clarity, distractor plausibility, leak-free) with Wilson CIs and mandatory disclaimer notice.
    - Pipeline stats: Tracks bank status (approved, pending, rejected, edited), edit rate, counts by type and pair, and automatic generation rejection reasons.
    - Verified by 4 unit tests in `apps/api/scripts/__tests__/eval-questions.test.js`.
  - Implemented E4: ML per-source performance and confounder evaluation (`scripts/eval-ml.js`, `npm run eval:ml`):
    - Analyzes DenseNet-121 out-of-fold predictions on all 6,004 images and 1,177 catalog images.
    - Computes OOF accuracy with Wilson CIs overall, per-source, and per class × source.
    - Discloses source confounders: 100% of normal (1,582) and pneumonia (4,245) originate from Kermany; COVID-19 (177) is split between Cohen (80.2%) and Figure1 (19.8%).
    - Evaluates bucket distribution per source.
    - Verified by 2 unit tests in `apps/api/scripts/__tests__/eval-ml.test.js`.
  - Implemented master evaluation orchestrator (`scripts/eval-all.js`, `npm run eval:all`):
    - Executes E1, E2, E3, and E4 sequentially and injects generated markdown between marker comments in `docs/EVALUATION.md`.
    - Preserves external sections including the qualitative "Interpretation and Limitations" section containing TODO bullets.
    - Verified deterministic reproducibility across consecutive runs.
  - Monorepo quality gates: 85 test files, 650 passing tests, 0 lint warnings, green builds.

- Completed T09c: Resident Education page, Instructor Catalog monitoring, and complete elimination of placeholder routes:
  - Built resident education guide in `apps/web/src/pages/resident/EducationPage.jsx`:
    - Strict static page (zero API calls verified by unit tests).
    - Medical disclaimer banner explicitly establishing the educational-only non-clinical nature of the platform.
    - 4-step adaptive cycle explanation: 1. Baseline/adaptive testing -> 2. Error pattern extraction (FPR/FNR) -> 3. Intelligent weight reallocation -> 4. Targeted practice & mastery threshold (80%).
    - Plain-Persian interpretations of confusion metrics (False Positive vs False Negative).
    - Radiological findings for the 3 disease classes grounded directly and verbatim in approved knowledge base files (`apps/api/src/modules/llm/kb/covid19.md`, `pneumonia.md`, `normal.md`) with explicit source attribution tags.
    - Verified by 5 unit tests in `EducationPage.test.jsx`.
  - Built instructor catalog monitoring page in `apps/web/src/pages/instructor/InstructorCatalogPage.jsx` and `features/catalog/`:
    - Query hooks (`useCatalogStats`, `useCatalogImages`) and API layer connecting to `GET /api/catalog/stats` and `GET /api/catalog/images`.
    - Prominent ADR 0005 technical notice disclosing source and demographic confounders (adult COVID-19 vs pediatric Kermany) and the 500-image quota cap.
    - Class x bucket distribution matrix and source distribution breakdown with formatted counts and percentages.
    - 3-axis filter bar (`trueClass`, `bucket`, `source`) with automatic page reset.
    - Paginated image records table with lazy-loaded thumbnails (`XrayImage`), true class / bucket / confused-with badges, and difficulty scores.
    - Handled loading, empty, and network error states with retry actions.
    - Verified by 6 unit tests in `InstructorCatalogPage.test.jsx`.
  - Removed `PlaceholderPage.jsx` and all placeholder route references:
    - Wired `EducationPage` to `/app/education` and `InstructorCatalogPage` to `/instructor/catalog` in `apps/web/src/app/router.jsx`.
    - Deleted `apps/web/src/pages/system/PlaceholderPage.jsx`.
    - Verified `Get-ChildItem -Path apps\web\src -Recurse | Select-String -Pattern "PlaceholderPage"` returns zero occurrences across the entire codebase.
    - Connected active navigation cards in `ResidentHomePage` and `InstructorHomePage`.
    - Extended route guard tests in `guards.test.jsx` verifying strict 403 Forbidden protection preventing resident trainees from accessing `/instructor/catalog`.
  - Enforced 100% bilingual key parity between `fa.json` and `en.json` (verified by `i18n.test.js`) and verified logical RTL utilities across all new components (`check-rtl-classes.js`).
  - Achieved 100% green monorepo test suite (82 test files, 629 passing unit tests) and verified production build.

- Completed T09b: Targeted practice API, option shuffling, zero label leakage guard, and resident practice interface:
  - Authored contracts in `packages/contracts/src/practice.js` and exported from index:
    - Strict schemas: `PracticeCreateRequest`, `PracticeQuestionAnswerResident`, `PracticeQuestionResident`, `PracticeSetResident`, `PracticeAnswerRequest`, `PracticeAnswerResponse`, `PracticeSummary`.
    - Enforced `.strict()` on all resident-facing objects, rejecting forbidden diagnostic keys (`trueClass`, `confusedWith`, `bucket`, `difficulty`, etc.).
    - Verified by 41 contract unit tests.
  - Authored MongoDB model `PracticeSetModel` in `apps/api/src/modules/practice/model.js` storing set metadata, permutations, and answers.
  - Implemented service layer and pure adapter `buildEngineHistory` in `apps/api/src/modules/practice/service.js`:
    - Pure adapter extracting `Response[]` strictly from finished test sessions.
    - Integrated with existing `selectTargetedQuestions` from `@radiology/engine`.
    - Shuffled options using deterministic seeded PRNG `createRng` to eliminate answer position bias.
    - Handled `NO_HISTORY` (409) and `PRACTICE_POOL_EXHAUSTED` (409) gracefully.
    - Extended `canViewImage` in `catalog/service.js` to authorize residents for images belonging to their own practice sets via indexed `publicIds`.
    - Verified by 10 service unit tests and 4 image access authorization tests.
  - Implemented Express 5 REST endpoints in `apps/api/src/modules/practice/`:
    - `POST /api/practice` (resident only, create set)
    - `GET /api/practice` (resident only, paginated list of sets)
    - `GET /api/practice/:id` (resident only, full set with answered rationale)
    - `PUT /api/practice/:id/questions/:no/answer` (resident only, submit answer, returns immediate rationale)
    - Comprehensive leak scanning with `assertNoForbiddenKeys` across all responses and negative security checks for 401 unauthenticated, 403 instructor, and 404 foreign ownership.
  - Built frontend features and pages in `apps/web`:
    - TanStack Query hooks in `apps/web/src/features/practice/`.
    - `PracticeHomePage` displaying practice set history, pagination, and special alerts for `NO_HISTORY` and `PRACTICE_POOL_EXHAUSTED`.
    - `PracticeSetPage` offering single-question presentation, accessible radio group, un-mirrored medical radiograph display, instant feedback and rationale reveal, and completion celebration score screen.
    - Linked targeted practice from `ReportPage` whenever error pairs exist in the confusion matrix.
    - Verified zero leakage in frontend via `PracticeLeak.test.jsx` and user flows via `PracticePages.test.jsx`.
  - Documented architectural decisions in `docs/adr/0014-targeted-practice.md`, updated Postman collection with 4 new requests, and synced skill documentation.

- Completed T09a: Synthetic demo resident seed, resident learning progress page, accessible SVG line chart, and instructor residents management views:
  - Authored `apps/api/scripts/demo-seed.js` and npm script `demo:seed`:
    - Strict refusal to run in `production` environment with exit code 1 and error code `PRODUCTION_REFUSED`.
    - Idempotently creates or reuses synthetic demo resident `demo.resident@example.com` (`Demo Resident (synthetic)`).
    - Simulates 4 finished training sessions (size 45) through the real `sessionService` methods (`createSession`, `answerQuestion`, `finishSession`), driven by the engine's `VirtualResident` simulator with deterministic seed `demo-synthetic-resident-2026`.
    - Accuracy improves progressively across sessions while strictly never reaching 100%.
    - `--reset` flag cleanly deletes ONLY the demo resident and its sessions/responses, leaving all other users and records untouched.
    - Added comprehensive unit tests in `apps/api/scripts/__tests__/demo-seed.test.js`.
  - Exported shared constant `MASTERY_THRESHOLD = 0.8` from `packages/contracts/src/engine.js` and wired it into `packages/engine` (`isMastered`), with contract and engine test coverage.
  - Implemented accessible SVG `LineChart` component in `apps/web/src/components/charts/LineChart.jsx`:
    - Zero third-party chart dependencies (hand-written SVG).
    - Enforced `dir="ltr"` canvas for time-series left-to-right progression in accordance with ADR 0009 and Persian RTL rules.
    - Series distinguished by dash patterns (`solid`, `dashed`, `dotted`, `dash-dot`), geometric marker shapes (circle, square, triangle, diamond), and text legend with high-contrast palette.
    - Dashed 80% mastery threshold line with localized label.
    - Accessible plain `<table>` rendered beneath the chart as accessible screen-reader and fallback table.
    - Tested in `LineChart.test.jsx`.
  - Built resident learning progress feature (`apps/web/src/features/progress/` and `apps/web/src/pages/resident/ProgressPage.jsx`):
    - TanStack Query hook `useProgress` fetching `GET /api/progress`.
    - Handles loading (spinner), error (alert with retry), empty (card with start test action), and full analytics states.
    - Deployed reusable presentational component `ProgressView` containing per-class accuracy trajectory line chart, finished test history table with links to reports, most frequent confusions breakdown with frequency counts, class mastery status badges calculated strictly from the latest session, and celebration banner upon mastering all classes.
    - Tested in `ProgressPage.test.jsx`.
  - Built instructor residents roster (`apps/web/src/features/residents/` and `apps/web/src/pages/instructor/InstructorResidentsPage.jsx`):
    - Connects to paginated `GET /api/admin/users`.
    - Table displaying trainee display name, email, finished session counts, latest accuracy, and last active timestamp.
    - Row click navigates to `/instructor/residents/:userId`.
    - Pagination controls with localized page numbers and disable states.
    - Tested in `InstructorResidentsPage.test.jsx`.
  - Built instructor resident detail inspector (`apps/web/src/pages/instructor/ResidentDetailPage.jsx`):
    - Connects to `GET /api/admin/users/:userId/progress` via `useAdminUserProgress(userId)`.
    - Reuses `ProgressView` in instructor mode.
    - Handles 404/invalid user IDs gracefully with error alert and return navigation.
    - Tested in `ResidentDetailPage.test.jsx` and extended `guards.test.jsx` verifying strict 403 Forbidden protection for resident roles.
  - Replaced placeholders in `router.jsx` so that only `/education` and `/instructor/catalog` (T09c) remain as placeholders.
  - Added full bilingual translations in `fa.json` and `en.json` (100% key parity).
  - Updated `apps/api/README.md` documenting `npm run demo:seed`.

- Completed T08c (Part A): Authored comprehensive LLM & Data Generation Operational Runbook (`docs/LLM-RUNBOOK.md`):
  - Cataloged all 14 scripts across image analysis, question bank, and LLM feedback with verified CLI flags, input/output files, MongoDB mutations, and exact source code line references.
  - Formulated exact mathematical request budgets: 40 requests across 3 calendar days for 120-image dual-run analysis (at 6 images/batch), ~8-10 requests for question generation (8 images/batch), and 1-2 requests for confusion pair explanations (all 6 pairs per language in 1 request).
  - Outlined exact Pacific reset boundary (00:00 America/Los_Angeles corresponding to ~11:30 AM Tehran Standard Time) and established the rule to inspect `Day` output from status scripts rather than wall clocks.
  - Specified recovery procedures for HTTP 429 RPM backoff, HTTP 429 RPD daily circuit-breaker, HTTP 503 retry semantics, schema validation fallbacks, and network/VPN dropouts.
  - Documented known empirical unknowns (MCQ candidate validation yield, VLM consensus pass rate on hard cases, real-world VPN latency) explicitly in Section 8.
  - Zero code modifications; 100% green lint, build, and test suite (524 / 524 passing tests).

- Fixed HTTP 415 `UnsupportedMediaTypeError` on state-changing requests without a payload (`fix/finish-session-415`):
  - In `apps/web/src/lib/api.js`: configured `apiFetch` to automatically inject `Content-Type: application/json` and serialize an empty JSON object `{}` for state-changing HTTP methods (`POST`, `PUT`, `PATCH`) when `body` is undefined (unless the payload is `FormData`), satisfying the backend's CSRF-prevention `jsonOnly` middleware.
  - In `apps/web/src/features/sessions/api.js`: explicitly set `body: {}` in `finishSession`.
  - In `apps/web/src/features/auth/hooks.js`: explicitly set `body: {}` in `useLogout`.
  - In `apps/web/src/pages/resident/QuizPage.jsx`: mapped API error codes using `getErrorI18nKey(err.code)` instead of hardcoded generic error messages to provide meaningful user feedback.
  - Added regression test suites across `api.test.js`, `api.test.jsx`, `auth-hooks.test.jsx`, and `QuizPage.test.jsx`, reaching 524 / 524 passing unit tests (100% green) and passing lint and build.

- Completed T08b: Question generation, question bank, tied-keys validation engine, and instructor review panel.
  - Defined comprehensive shared contracts in `packages/contracts/src/questionBank.js` with Zod schemas for question types (`finding`, `distribution`, `differential`), statuses (`pending_review`, `approved`, `rejected`), candidate generation outputs, tied-keys options, admin query parameters, audit history, and review statistics.
  - Built Mongoose models `QuestionBankModel` (`question_bank`) and `QuestionGenAttemptModel` (`question_gen_attempts`) in `apps/api/src/modules/bank/model.js` with stable unique indexes and audit tracking.
  - Implemented pure validation engine in `apps/api/src/modules/bank/validate.js` with 10 deterministic reason codes: schema validity, exactly 4 unique options, normalized deduplication, bounds check on `correctIndex`, non-empty stem, zero class label leakage in stems, absolute prohibition of digits (0-9, ۰-۹) and percentages (% / ٪), >=60% Persian script ratio, tied-keys consistency with consensus findings/vocabulary, and 300-char rationale cap.
  - Implemented offline question generation service (`apps/api/src/modules/bank/generate.js`) and prompt (`prompts/v1/generate-questions.js`) using text-only inputs (consensus findings + KB snippets) in batches of up to 8 images, with SHA-1 stable ID idempotency skipping previously generated items at zero API cost.
  - Created operational CLI scripts: `npm run questions:generate`, `npm run questions:status`, `npm run bank:export` (writing `apps/api/seed/question-bank.approved.json`), and `npm run bank:import`.
  - Built Express admin endpoints with role `instructor` authorization: `GET /api/admin/questions`, `GET /api/admin/questions/stats`, `GET /api/admin/questions/:id`, `POST /api/admin/questions/:id/approve`, `POST /api/admin/questions/:id/reject`, and `PUT /api/admin/questions/:id` (with audit diff history and reset to `pending_review`). Verified strict resident isolation (HTTP 403 and zero leakage into resident sessions).
  - Built complete instructor review panel in `apps/web/src/pages/instructor/InstructorReviewPage.jsx` and `features/bank/` components (`BankStatsStrip`, `BankFilterBar`, `BankQuestionList`, `BankQuestionDetail`), featuring split-view image inspection, highlighted correct answers, consensus finding badges, draft KB warnings, full audit history, and rapid keyboard review shortcuts (`A` approve, `R` reject, `J` next, `K` prev) with strictly ZERO bulk actions.
  - Authored ADR 0013 Addendum, updated Postman collection with 6 new endpoints, updated `apps/api/README.md`, and synced `.agents/skills/question-generation/SKILL.md`.
  - Expanded automated test coverage across contracts, API validation, generator, portable import/export, admin endpoints, and frontend components, reaching 520 / 520 tests passing across 69 test files (100% green).

- Merged PR #12 (`feat(api,contracts): offline quota-aware image analysis pipeline (T08a)`) into `main` with merge commit after all quality gates, green CI, and verification.

- Completed T08a code and test suite: built offline, quota-aware, resumable chest X-ray image analysis pipeline with closed vocabulary and automatic cross-run validation.
- Defined shared closed vocabulary in `packages/contracts/src/vocabulary.js` (`laterality`, `zones`, `patterns`, `distribution`, `predictedClass`, `certainty`, `imageQuality`) and analysis contracts in `packages/contracts/src/analysis.js` (`AnalysisBatchSchema`, `ImageAnalysisSchema`, `AnalysisValidationSchema`).
- Built Mongoose models in `apps/api/src/modules/analysis/model.js` (`AnalysisBatch`, `ImageAnalysis`, `AnalysisValidation`) with unique indexes and automatic batch ID assignment.
- Implemented pure seeded stratified sampler `selectAnalysisSet` in `sampling.js` selecting 120 images (40 per class; oversampling medium/hard for COVID-19, largest remainder by source, 14 hard / 13 med / 13 easy for pneumonia and normal).
- Implemented batch planner `planBatches` in `planner.js` grouping into mixed-class batches of 6 images, with Run B order reversed-and-rotated.
- Implemented Prompt A and Prompt B builders in `prompts/v1/` ensuring zero label, source, or catalog ID leakage into prompt text or system instructions.
- Implemented pure 9-reason validation rules in `validate.js` checking schema validity, quality, label match, clear-lung exclusivity, normal patterns, and non-empty consensus pattern intersection ($A \cap B$).
- Implemented resumable runner `runner.js` and CLI scripts (`analysis-select`, `analysis-plan`, `analysis-run`, `analysis-validate`, `analysis-status`, `analysis-export`, `analysis-import`).
- Authored ADR 0013, updated `docs/DATA-SOURCES.md` and `apps/api/README.md`, and synced `question-generation` skill.
- Expanded automated test coverage with 49 new unit and integration tests across 5 new test files (106 analysis-related tests passing).

- Merged PR #11 (`feat(api,web): llm core, quota guard, cache, kb and feedback panels (T07)`) into `main` with merge commit after all quality gates, green CI, and verification.

- Completed T07: built comprehensive, quota-safe LLM core, provider abstraction, daily budget guard, anti-hallucination verification, knowledge base, explanations, and narrative feedback panels.
- Defined shared LLM schemas in `packages/contracts/src/llm.js` (`LLM_MODES`, `LangSchema`, `LlmSourceSchema`, `ExplanationPairSchema`, `ExplanationItemSchema`, `ExplanationsResponseSchema`, `NarrativeSchema`, `NarrativeResponseSchema`, `AdminLlmStatusSchema`).
- Implemented pure anti-hallucination guard in `guard.js` normalizing Persian and Arabic-Indic digits to ASCII, detecting percent symbols (`%` and `٪`), and rejecting any unstated numbers not present in the input whitelist (whitelisting '3' for recommendations and '19' for COVID-19).
- Created uniform provider abstraction (`provider.js`), offline `FakeProvider` with queued outcomes and call inspection, and official `GeminiProvider` using `@google/genai@2.32.0` Interactions API with structured JSON output and 429 quota handling.
- Implemented daily request budget and throttle in `budget.js` tracking Pacific calendar days (`America/Los_Angeles`), reserving slots via atomic `findOneAndUpdate` in MongoDB (`llm_usage`), spacing calls with 13s inter-call interval (`LLM_MIN_INTERVAL_MS`), and tripping a daily circuit breaker on repeated 429s.
- Created 6 grounded medical knowledge base markdown files in `apps/api/src/modules/llm/kb/` with `reviewed: false` and empty sources; built keyword-scoring retrieval in `retrieval.js` prioritizing exact pair comparisons.
- Implemented deterministic Persian and English fallbacks in `fallback.js` for all 6 confusion pairs and report narratives.
- Built error explanations endpoint `POST /api/sessions/:id/explanations` serving strictly from cache or fallback (never calling Gemini live).
- Built narrative report endpoint `POST /api/sessions/:id/report-narrative` with per-user rate limiting (30 req/user/hour), cache -> live -> fallback routing, and instructor status endpoint `GET /api/admin/llm/status`.
- Built portable cache export and import utilities in `portable.js` (`npm run llm:cache:export` and `import`) and checked in clean offline seed `apps/api/seed/llm-cache.portable.json`.
- Built frontend LLM components in `apps/web/src/features/llm/` (`LlmPanel`, `NarrativePanel`, `QuestionExplanationPanel`) with source badges (AI, Cached, Template), draft badge, educational disclaimer, and skeleton loader; integrated into `ReportPage` and `ReviewPage`.
- Authored ADR 0012 and `docs/GEMINI-NOTES.md`, updated Postman collection with 3 new LLM endpoints, and synced `llm-feedback` skill.
- Expanded automated test coverage from 264 to 347 passing tests across 55 test files with 100% pass rate.

- Completed T06: built resident training UI (`apps/web`) covering tests overview, interactive quiz, performance report, and question review.
- Implemented sessions API client and TanStack Query hooks in `features/sessions/` (`keys.js`, `api.js`, `hooks.js`) with optimistic cache updates and rollbacks.
- Built `TestsPage` (`/app/tests`) supporting test resumption, new test creation with size picker (45, 60, 90, 120), and handling 409 `SESSION_IN_PROGRESS` and `POOL_EXHAUSTED`.
- Built `QuestionNavigator` with responsive two-column layout (naturally placed on the right in RTL mode) and accessible color/icon status markers.
- Built `QuizPage` (`/app/tests/:sessionId`) with dark X-ray viewer, 3 fixed options (COVID-19, Pneumonia, Normal), keyboard keys 1/2/3, immediate autosave, response time tracking, and next-image prefetching.
- Built `FinishDialog` with accessible focus management, modal backdrop, and unanswered question warnings.
- Built `ReportPage` (`/app/reports/:sessionId`) presenting overall accuracy, 3x3 confusion matrix, one-vs-rest metrics table, difficulty breakdown tables, mastery indicators without hardcoded cutoffs, and pedagogical plan explanations without revealing catalog deficits.
- Built `ReviewPage` (`/app/reports/:sessionId/review`) with question filter tabs, trainee vs ground truth comparisons, and an `extra` slot for LLM feedback (T07).
- Authored strict privacy security test `QuizLeak.test.jsx` verifying zero leakage of forbidden diagnostic tokens (`trueClass`, `bucket`, `difficulty`, `confusedWith`, dataset prefixes).
- Authored ADR 0011 documenting autosave deviation, information hiding, and evaluation review; updated `apps/web/README.md` and synced `persian-rtl-ui` skill.
- Expanded automated test coverage from 241 to 264 passing tests across 43 test files with 100% pass rate.

- Merged PR #8 (T05): Training session API, adaptive loop, metrics and progress tracking into `main`.

- Completed T05: built complete training session lifecycle in `apps/api` using `@radiology/engine` and local MongoDB.
- Defined robust shared schemas in `packages/contracts/src/session.js` (`CreateSessionBodySchema`, `AnswerBodySchema`, `QuestionPublicSchema`, `SessionPublicSchema`, `SessionSummarySchema`, `ClassMetricsSchema`, `ReportItemSchema`, `SessionReportSchema`, `ProgressSchema`, `AdminResidentSummarySchema`) and appended 6 new error codes to `API_ERROR_CODES`.
- Created `Session` and `Response` Mongoose models with unique compound indexes (`{ userId, index }` and `{ sessionId, questionNo }`) and a partial unique compound index on `{ userId: 1, status: 1 }` for `status: 'in_progress'` preventing double-click session creation races.
- Built `engine.adapter.js` as the strict single gateway to `@radiology/engine` (`loadPool`, `loadHistory`, `buildTest`, and math helpers).
- Implemented pure evaluation metrics in `metrics.js` (`computeClassMetrics`, `topConfusions`, `buildReport`, `buildProgress`) with hand-computed arithmetic tests across 3 classes and 12 answers with exact precision, recall, FPR, FNR, F1, and mastery verification.
- Built session creation and retrieval endpoints (`POST /api/sessions`, `GET /api/sessions`, `GET /api/sessions/:id`) enforcing the single active session rule (409 `SESSION_IN_PROGRESS`) and deterministic seeding (`${userId}:${index}`).
- Enforced strict privacy boundary: resident questions expose ONLY `{ no, imageUrl, answered, answer }`, completely redacting ground truth labels, buckets, difficulty, sources, and internal IDs. Verified via deep leak scanning.
- Implemented idempotent question answering (`PUT /api/sessions/:id/questions/:no/answer`) by question number 1..N without exposing correctness or ground truth.
- Implemented atomic session completion (`POST /api/sessions/:id/finish`) computing metrics once and locking the session against repeat completions (409 `SESSION_ALREADY_FINISHED`).
- Verified adaptive behavior end to end: simulated a resident with a specific COVID-19 weakness; the engine adapted the next session with expected hand-computed error weights (~0.61 vs 0.34 vs 0.04) and class distribution, with zero image repeats.
- Implemented resident progress endpoint (`GET /api/progress`) aggregating historical performance into learning curves and identifying top off-diagonal confusion pairs (`covid19 -> pneumonia`).
- Implemented instructor administration endpoints (`GET /api/admin/users`, `GET /api/admin/users/:userId/progress`, `GET /api/admin/sessions/:id/report`) with role-based guards (403 for residents).
- Replaced `canViewImage`: residents can only access image file bytes (`/api/images/:publicId/file`) for images present in one of their own sessions; instructors have global access.
- Executed real catalog verification with PowerShell and mongosh: demonstrated baseline test, answering, finishing, report generation, and adaptive test creation. Documented catalog shortfalls (COVID-19 medium: requested 6, available 2; hard: requested 7, available 1) and confirmed zero-deficit fallback resolution.
- Authored ADR 0010 documenting session lifecycle, feedback timing, and metrics; updated Postman collection with 10 new requests; synced `api-conventions` skill.
- Expanded automated test coverage from 190 to 241 passing tests across 39 test files with 100% pass rate.

- Merged PR #7 (T04): Web foundation (React 19, Vite, Tailwind CSS 4 RTL, i18n, auth pages, panel shells) into `main`.

- Completed T04: built Persian right-to-left React 19 application in `apps/web` with Vite 8 and Tailwind CSS 4 logical utilities.
- Configured dev server proxy topology routing `/api` to Express on `127.0.0.1:4000`, enabling seamless same-origin `SameSite=Lax` cookie sessions without cross-origin complexity.
- Implemented robust UI component kit (`Button`, `Input`, `Field`, `Card`, `Alert`, `Badge`, `Spinner`, `LanguageSwitcher`, `XrayImage`) with 100% test coverage.
- Created `XrayImage` container enforcing `dir="ltr"` and prohibiting CSS transforms to prevent anatomical diagnostic marker inversion.
- Configured `i18next` + `react-i18next` with complete Persian (`fa.json`) and English (`en.json`) locale parity and automated parity regression testing.
- Created `useDirection` hook dynamically maintaining `<html lang dir>` and synchronizing language choice with `localStorage` (`rt_lang`).
- Implemented localized `fmt` formatting helpers for numbers, percentages, and Jalali dates (`fa-IR-u-ca-persian`).
- Built typed API client (`lib/api.js`) throwing structured `ApiError`s and mapping backend error codes to i18n keys without leaking raw server text.
- Implemented TanStack Query 5 auth hooks (`useMe`, `useLogin`, `useRegister`, `useLogout`) with graceful 401 handling.
- Configured React Router 7 (`createBrowserRouter`) in library mode with `RequireAuth` and `RequireRole` guards, role-based landing redirection, and placeholder shells for upcoming tasks.
- Built accessible login and registration pages with client-side validation against shared `@radiology/contracts` schemas.
- Developed resident dashboard shell (`/app`) with 4 cards matching the paper's design and instructor dashboard shell (`/instructor`).
- Created automated RTL class scanner (`scripts/check-rtl-classes.js`) catching physical directional classes (`ml-`, `mr-`, `pl-`, `pr-`, `text-left`, `text-right`, `scale-x-`) with `rtl-ok` escape hatch and wired into `npm run lint` and CI.
- Authored ADR 0009 documenting web architecture, RTL enforcement, router choice, and proxy topology; synced `.agents/skills/persian-rtl-ui/SKILL.md`.
- Expanded automated test coverage from 140 to 190 passing tests across 31 test files with 100% pass rate.

- Merged PR #6 (T03): Contracts and API foundation into `main`.

- Completed T03: built secure Express 5 REST API in `apps/api` on local MongoDB with Mongoose 9 and Zod 4 runtime contracts.
- Configured Vitest 4 monorepo projects runner (`test.projects: ['packages/*', 'apps/*']`), expanding automated test coverage from 57 to 140 passing tests across 22 test files with 100% pass rate.
- Implemented cookie-based JWT session authentication (`rt_session`) with HS256, `httpOnly`, `SameSite=Lax`, and 12-hour expiration, including dummy bcrypt hash comparison to eliminate email enumeration timing attacks.
- Added strict `toPublicUser` mapper preventing `passwordHash` leaks and enforced 8..72 byte password limits (accounting for 2-byte Persian UTF-8 characters).
- Implemented role-based authorization guard (`requireRole`) distinguishing `resident` (default) and `instructor`, along with terminal prompt script `scripts/create-instructor.js`.
- Generated deterministic 20-character HMAC-SHA256 opaque `publicId`s (`apps/api/src/modules/catalog/publicId.js`) to decouple image identifiers from dataset sources (Cohen, Figure1, Kermany), completely preventing data-source label leakage to trainees.
- Built image file serving endpoint (`GET /api/images/:publicId/file`) with path traversal guards, private caching (`Cache-Control: private, max-age=86400`), and strict header redaction (no filenames or dataset clues exposed).
- Developed idempotent catalog seeder (`scripts/seed-catalog.js`) supporting batch bulk writes of 500, pruning, and automated pool-health capacity warnings for cells with < 6 images.
- Authored ADR 0007 (API architecture, auth, CSRF stance, dev proxy topology) and ADR 0008 (opaque public IDs and label leakage prevention).
- Created Postman collection in `docs/postman/radiology-api.postman_collection.json` and comprehensive documentation in `apps/api/README.md`.
- Synced `.agents/skills/api-conventions/SKILL.md` to reflect the production architecture.
- Completed T01b: fixed Pneumonia and Normal class swap in `ml/src/report.py` by enforcing `CLASS_ORDER = ["covid19", "pneumonia", "normal"]` and setting `labels=CLASS_ORDER` in `classification_report`.
- Regenerated `ml/reports/ml-report.md` with verified supports (177 covid, 4245 pneumonia, 1582 normal) and exact precision/recall alignment with the confusion matrix.
- Developed comprehensive automated consistency test suite in `ml/tests/test_difficulty_consistency.py` (6 new unit tests, bringing total ML tests to 22, all passing). Proved that `difficulty.json` is 100% consistent with OOF predictions ($d = 1 - p_{\text{true}}$, 95.24% OOF accuracy, unique IDs, valid fold indices 0..4, and `confusedWith != trueClass` matching raw model argmax).
- Quantified source and age confounding in `ml/reports/ml-report.md`: added per-source OOF accuracy table (Cohen 98.59%, Figure1 97.14%, Kermany 95.14%), COVID-19 difficulty deciles (96.61% in [0.0, 0.1]), and explicit clinical/educational disclaimer.
- Documented deferral of Part B in ADR 0005 Addendum to maintain momentum and preserve catalog stability for downstream tasks (T08 question generation), delegating further evaluation to T10.
- Completed T01: implemented offline ML difficulty pipeline in `ml/` with Python 3.12 and `uv`.
- Addressed code review findings and resolved catalog bucket starvation in `ml/src/export_catalog.py`: the catalog now contains a rich mix of difficulty levels across all classes (COVID: 172 Easy, 2 Med, 3 Hard; Pneumonia: 201 Easy, 134 Med, 165 Hard; Normal: 412 Easy, 46 Med, 42 Hard; total 1,177 images).
- Aligned difficulty thresholds with canonical paper standard ($d < 0.34$, $0.34 \le d < 0.68$, $d \ge 0.68$) matching `@radiology/engine`'s `bucketOf()` function, documented in `docs/adr/0005-difficulty-thresholds-and-catalog-policy.md`.
- Unified schema contracts across `catalog.json` and `difficulty.json` (`id`, `imageId`, `trueClass`).
- Integrated uv, Python 3.12, ruff, and pytest into `.github/workflows/ci.yml`.
- Expanded test suite to 16 unit tests covering catalog diversity, schema symmetry, and data sources.
- Scanned raw datasets (`kermany`, `cohen`, `figure1`), identified and eliminated 171 duplicates via SHA-256 hashes, producing 6,004 clean images.
- Implemented image preprocessing generating 768px web JPEGs and 224px ImageNet-normalized PyTorch tensors for model input.
- Extracted 1024-dimensional DenseNet-121 features on CPU with frozen ImageNet backbone, saving `data/interim/features.npy`.
- Implemented 3-class MLP head matching the reference paper and executed Stratified 5-Fold cross validation, achieving 95.24% Out-of-Fold accuracy (0.9315 macro F1).
- Computed difficulty scores ($d = 1 - P(y_{\text{true}} \mid x)$) and `confusedWith` classes.
- Exported web app catalog of 1,177 images (`catalog.json`), created 130.40 MB `catalog-images.zip`, and generated `ml/artifacts/difficulty.json` metadata for all 6,004 images.
- Wrote evaluation report in `ml/reports/ml-report.md`.
- Opened Pull Request #3 (`feat/T01-ml-pipeline`).

- Completed T02: implemented pure JS adaptive question selection engine (`@radiology/engine`), Zod schemas and contracts (`@radiology/contracts`), and virtual-resident Monte Carlo simulator.
- Implemented Hamilton-Hare largest-remainder allocation, Laplace smoothed FPR/FNR/error rates, seeded Mulberry32 PRNG, baseline and adaptive test generators, and targeted practice selection.
- Wrote 40 comprehensive tests covering unit arithmetic, hand-calculated manual examples, and property-based invariant testing with `fast-check` across $N \in [45, 120]$.
- Documented mathematical deviations from the paper in `docs/adr/0004-adaptive-engine-allocation.md` and package documentation in `packages/engine/README.md`.
- Initialized Git repository, main branch, and pushed to GitHub (`mahdimoradi-tech/radiology-adaptive-trainer`).
- Configured monorepo workspaces (`packages/*`, `apps/*`), ESLint flat config, Prettier, and Vitest.
- Created package skeletons for `@radiology/contracts` and `@radiology/engine` with smoke tests.
- Set up Husky 9 hooks: conventional commitlint (scoped), lint-staged, and branch protection hook (`no-push-main.js`).
- Created GitHub Actions CI workflow (MongoDB 8 service, Node 24, test/lint/build) and PR template.

## Decisions and why

- Development workflow (Date: 2026-10-24, All design, implementation, and verification driven by Mahdi Moradi with AI coding agent per `docs/WORKFLOW.md`).
- Stack: Pure JavaScript ESM (no TypeScript) for complete inspectability and defensibility of every line.
- Native Windows installation (no Docker) with local MongoDB service.
- Prevent pushes to `main` branch via pre-push hook to enforce PR review workflow.

## Things I must be able to explain at the defense

- How Out-of-Fold (OOF) 5-fold cross-validation guarantees zero data leakage: each image is evaluated solely by a model that never trained on it.
- Why the DenseNet-121 backbone was frozen: to preserve generic visual features and avoid overfitting to cross-dataset acquisition artifacts.
- Why canonical linear thresholds (0.34 / 0.68) and catalog diversity sampling were chosen: to maintain strict semantic consistency with `@radiology/engine`'s `bucketOf()` function, ensuring high-confidence images ($d=0.001$) are clinically labeled Easy, while sampling all available hard and medium cases into the catalog to guarantee diversity and prevent engine shortfall (documented in ADR 0005).
- How binary image files (`catalog-images.zip`) are cleanly separated from version-controlled metadata (`difficulty.json`).
- Why Laplace smoothing ($\alpha = 1$) is mathematically required to prevent $0/0$ (`NaN`) in early training sessions.
- How the Largest Remainder (Hamilton-Hare) algorithm guarantees exact integer sum $N$ while maintaining class and bucket minimum shares.
- The differences between baseline test (40/30/30 bucket shares) and adaptive test allocation based on resident error patterns.
- What the virtual resident simulator proves (algorithmic convergence under modeled learning dynamics) and its limitations regarding human visual cognition.
- How the npm workspaces monorepo links `@radiology/contracts` to `@radiology/engine`.
- Why conventional commit enforcement and branch protection were put in place.
- Structure of the CI workflow and how MongoDB tests run in GitHub Actions.
- Why cookie-based auth with `httpOnly`, `SameSite=Lax`, and `Content-Type: application/json` enforcement completely mitigates CSRF without synchronization tokens (documented in ADR 0007).
- How the Vite dev server proxy topology allows same-origin cookie delivery in development without CORS complexity.
- How HMAC-SHA256 opaque `publicId`s protect against label and source leakage during training sessions (documented in ADR 0008).
- Why Express 5 requires `req.valid = { body, query, params }` instead of assigning to the read-only getter `req.query`.
- How isolated test databases (`radiology_test_<uuid>`) prevent test contamination and enable parallel test execution without Docker.
- How the "tied-keys" design guarantees that distractor options and correct answers in generated questions strictly reflect closed-vocabulary findings and consensus VLM observations rather than ungrounded LLM hallucinations (documented in ADR 0013 Addendum).
- Why question generation uses text-only inputs (validated VLM consensus + KB) instead of sending images directly to Gemini, saving bandwidth/quota and preventing multimodal hallucination.
- How the pure validation engine enforces academic integrity through 10 deterministic criteria (zero digits/percentages, no class label in stem, >=60% Persian script ratio, deduplication).
- Why bulk approval is strictly prohibited in the instructor review panel and why all approved items bear the honest labeling marker «بازبینی توسط مدرس (غیر بالینی)».

## Open questions

- Professor meeting agenda and delivery expectations.
