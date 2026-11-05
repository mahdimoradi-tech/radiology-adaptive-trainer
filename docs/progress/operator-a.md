# Operator A log (repo owner)

Name (as in git): Mahdi Moradi · GitHub: mahdimoradi-tech · Daily sync time: TBD

## Environment (no secrets)

OS/shell: Windows 11 / PowerShell 5.1 · Node/npm: v24.11.0 / 11.21.1 · MongoDB/mongosh: 8.3 / 2.13.0 · Python/uv: Python 3.11.0 (Python 3.12 + uv pending T01) · Antigravity skills/workflows visible: yes · paper.pdf: present

## Current task

- T06: Resident training UI (tests list, quiz, report, review) in `apps/web` (branch `feat/T06-resident-ui`). Claimed solo per `docs/SOLO-MODE.md`.

## Done (newest first)

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

- Temporary exception: solo mode (Date: 2026-10-24, Reason: Operator B is temporarily unavailable; Operator A switches to solo mode through at least T03 per `docs/SOLO-MODE.md` to keep project moving forward without stalling).
- Stack: Pure JavaScript ESM (no TypeScript) so both operators can fully understand and defend every line.
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

## Open questions

- Daily sync schedule with Operator B (Abolfazl).
- Professor meeting agenda and delivery expectations.
