## Task & Team

- **Task ID:** T05
- **Driver:** Operator A (solo)
- **Reviewer:** none (solo) -> AI review per `docs/SOLO-MODE.md`

## Summary

### What

- Built the complete server-side adaptive training loop in `apps/api`:
  - `POST /api/sessions`: Creates balanced baseline or adaptive training session (size 45..120, deterministic seed `${userId}:${index}`).
  - `GET /api/sessions`: Paginated list of resident's own sessions.
  - `GET /api/sessions/:id`: Full session details exposing strictly sanitized question items (`no`, `imageUrl`, `answered`, `answer`).
  - `PUT /api/sessions/:id/questions/:no/answer`: Idempotent question answering by question number 1..N without leaking correctness.
  - `POST /api/sessions/:id/finish`: Atomic session finish and one-time metrics calculation (`SessionReport`).
  - `GET /api/sessions/:id/report`: Retrieves performance report for a finished session (with full item review, ground truth, and confusion matrix).
  - `GET /api/progress`: Learning trajectory and top off-diagonal confusion pairs for the authenticated resident.
  - `GET /api/admin/users`: Instructor dashboard list of residents with metrics and last activity.
  - `GET /api/admin/users/:userId/progress`: Instructor inspection of any resident's progress.
  - `GET /api/admin/sessions/:id/report`: Instructor inspection of any finished session report.
  - `canViewImage`: Restricted image file serving (`GET /api/images/:publicId/file`) so residents can only view images in their own sessions; instructors have global access.
- Defined all contracts and schemas in `packages/contracts/src/session.js` and added 6 error codes to `API_ERROR_CODES`.
- Created Mongoose models `SessionModel` and `ResponseModel` with unique compound and partial indexes.
- Implemented `engine.adapter.js` as the single gateway to `@radiology/engine`, and pure metrics calculations in `metrics.js`.
- Documented architecture in ADR 0010, updated Postman collection with 10 new requests, and synced `api-conventions` skill.

### Why

- Powers the core educational requirement of the platform: evaluating resident performance, learning error patterns, and adaptively biasing subsequent training tests toward weaknesses.

---

## Step 0: Verified Engine Signatures

As required by Step 0 of T05, the real signatures of `@radiology/engine` were inspected without guessing and adhered to:
- `selectFirstTest(imagePool, userConfig = {})`: returns `{ imageIds: string[], plan: { classCounts, bucketCounts, weights, errors: null, shortfalls, deficit } }`
- `selectNextTest(imagePool, responseHistory = [], userConfig = {})`: returns `{ imageIds: string[], plan: { classCounts, bucketCounts, weights, errors, shortfalls, deficit } }`
- `rates(responses, alpha = 1, classIds = CLASS_IDS)`: returns `Record<ClassId, { tp, fn, fp, tn, fnr, fpr, error }>`
- `classWeights(ratesResult, classIds = CLASS_IDS)`: returns `Record<ClassId, number>`
- `confusionMatrix(responses, classIds = CLASS_IDS)`: returns `Record<ClassId, Record<ClassId, number>>`
- `perClassCounts(responses, classIds = CLASS_IDS, buckets = BUCKETS)`: returns `Record<ClassId, { total, incorrect, byBucket }>`
- `isMastered(latestSessionResponses, threshold = 0.8, classIds = CLASS_IDS)`: returns `boolean`

---

## Empirical Verification with the Real Catalog (1,177 Images)

Executed end-to-end against local MongoDB (`mongodb://127.0.0.1:27017/radiology`):

### 1. Baseline Session (Finished)
- **Session ID:** `6ae7a76660d2dba8dbca0cec` (`kind: baseline`, `size: 60`)
- **Answered Count:** 10 (questions 1..10 answered with 'normal')
- **Unanswered Count:** 50 (excluded from metrics calculation)
- **Overall Accuracy:** 0.5 (5 correct / 10 answered)
- **Mastered:** `false`
- **Per-Class Accuracy:** `covid19=0`, `pneumonia=0`, `normal=1`

### 2. Adaptive Session Plan & Shortfall Analysis
- **Session ID:** `6ae7a76660d2dba8dbca0ced` (`kind: adaptive`, `index: 2`, `size: 60`)
- **Engine Allocation:**
  - `classCounts`: `{ covid19: 20, pneumonia: 19, normal: 21 }`
  - `bucketCounts`:
    - `covid19`: `{ easy: 7, medium: 6, hard: 7 }`
    - `pneumonia`: `{ easy: 6, medium: 6, hard: 7 }`
    - `normal`: `{ easy: 8, medium: 7, hard: 6 }`
  - `weights`: `{ covid19: 0.3529, pneumonia: 0.2789, normal: 0.3682 }`
  - `shortfalls`:
    ```json
    [
      { "classId": "covid19", "bucket": "medium", "requested": 6, "available": 2, "shortfall": 4 },
      { "classId": "covid19", "bucket": "hard", "requested": 7, "available": 1, "shortfall": 6 }
    ]
    ```
  - `deficit`: 0
- **Analysis of COVID-19 Pool Shortfalls:**
  The catalog reflects real-world clinical chest X-ray scarcity: COVID-19 has 172 Easy images, but only 2 Medium and 3 Hard images. When the adaptive engine requested 6 medium and 7 hard COVID-19 images for session 2, shortfalls of 4 and 6 occurred. The engine's nearest-bucket fallback successfully substituted images from the Easy COVID-19 pool, satisfying the quota with 0 overall deficit without failing the test.

---

## How to Test

```powershell
# 1. Run all lint checks (including RTL scanner)
npm run lint

# 2. Run all unit and integration tests across monorepo (241 tests)
npm test

# 3. Build workspaces
npm run build

# 4. Verify manual session lifecycle against live server
powershell -ExecutionPolicy Bypass -File scripts/verify-session-flow.ps1
```

---

## Contract Changes

- **Contract changed?** [x] Yes / [ ] No
- _Justification (Operator A):_ Added `packages/contracts/src/session.js` schemas (`CreateSessionBodySchema`, `AnswerBodySchema`, `QuestionPublicSchema`, `SessionPublicSchema`, `SessionSummarySchema`, `ClassMetricsSchema`, `ReportItemSchema`, `SessionReportSchema`, `ProgressSchema`, `AdminResidentSummarySchema`) and appended 6 error codes to `API_ERROR_CODES` (`SESSION_IN_PROGRESS`, `SESSION_NOT_IN_PROGRESS`, `SESSION_NOT_FINISHED`, `SESSION_ALREADY_FINISHED`, `POOL_EXHAUSTED`, `QUESTION_NOT_FOUND`). Fully covered with 17 contract tests.

## Dependencies Added

| Package | Version | Why Needed |
| ------- | ------- | ---------- |
| None    | —       | Standard Express, Mongoose, Zod, and engine packages already present |

---

## What the Reviewer Must Understand

1. **Information Hiding During Testing:** The question endpoint (`PUT .../questions/:no/answer`) indexes strictly by sequential number (1..N) and never reveals correctness or ground truth. Ground truth appears only in finished session reports.
2. **Single Active Session Rule:** Backed by a MongoDB partial unique index on `{ userId: 1, status: 1 }` with `{ partialFilterExpression: { status: 'in_progress' } }`, preventing concurrent double-click session creation races.
3. **Engine Gateway:** `apps/api/src/modules/sessions/engine.adapter.js` is the ONLY file in `apps/api` importing `@radiology/engine`.
4. **Adaptive Feedback Loop:** The end-to-end adaptive test proves that resident errors on COVID-19 images directly shift class weights and question quotas in subsequent sessions according to the reference paper's mathematical formulation.
5. **Non-Disclosure Principle:** Accessing another resident's session or image returns 404 rather than 403, preventing resource enumeration.

---

## Checklist

- [x] `npm run lint` passes
- [x] `npm test` passes (241 tests across 39 files)
- [x] `npm run build` passes
- [x] `docs/PROGRESS.md` board row updated
- [x] Developer log updated in `docs/progress/developer-log.md`
- [x] No secrets (`.env`), datasets, images, or large binary files committed
- [x] Commit history follows Conventional Commits
