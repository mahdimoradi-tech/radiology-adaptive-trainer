# T05 — Session API (baseline and adaptive tests, answers, finish, metrics, report, progress)

Developer: Mahdi · Branch: `feat/T05-session-api` · Skills: `api-conventions`, `adaptive-engine`, `git-workflow`, `review-workflow` · Estimate: 6-7 h · Folders: `packages/contracts`, `apps/api`, `docs/`.

If this task and a skill disagree, THIS TASK WINS (for example the answer route below differs from the one in `api-conventions`). Record deviations in ADR 0010 and sync the skill at the end.

## Goal
The full server side of the training loop: create a test (first test = balanced baseline; later tests = adaptive from ALL previous results), save answers, finish, compute metrics, produce a report, and expose progress. The engine from T02 does the selection; the API only adapts data in and out.

## Prerequisites
T02 and T03 merged (T04 may be merged or not). `/sync` done. Read, WITHOUT guessing: `packages/engine/README.md`, `packages/engine/src/{selection,rates,targeted,allocation}.js` and `packages/contracts/src/engine.js`. **Step 0 of this task: write down the real signatures** of `selectFirstTest`, `selectNextTest`, `confusionMatrix`, `perClassCounts`, `rates`, `classWeights`, `isMastered` (arguments, return shape, what `plan` contains incl. `shortfalls` and `deficit`, how `seed` is used) in the PR description. The pseudo-code below assumes `selectFirstTest(pool, config)` and `selectNextTest(pool, history, config)`; if the code differs, follow the CODE and adapt this task, never the engine (an engine change needs its own contract-approved PR).

## Human steps
None. (Have the real catalog seeded; the numbers you saw in T03's seed summary matter here.)

## Binding decisions
| Topic | Decision |
|---|---|
| Session kind | server decides: no finished session -> `baseline` (`selectFirstTest`), otherwise `adaptive` (`selectNextTest`); targeted practice comes in T09 |
| History | responses of FINISHED sessions, answered questions only; unanswered questions are excluded from metrics and history |
| One active session | at most one `in_progress` session per user; creating another returns 409 `SESSION_IN_PROGRESS` with the existing session id in `details` |
| Test size | body `size` (45..120, default 60); `EngineConfigSchema.parse({ totalQuestions: size, allowRepeats: config.ALLOW_REPEATS, seed: \`${userId}:${index}\` })` (deterministic per user and session number) |
| Pool exhausted | if the engine reports a deficit (`plan.deficit > 0`) respond 409 `POOL_EXHAUSTED` with `{ requested, available }`; env `ALLOW_REPEATS=true` lets the engine reuse images |
| Answer route | `PUT /api/sessions/:id/questions/:no/answer` (question number 1..N), NOT by image id: residents never handle image ids |
| Feedback timing | the answer endpoint never reveals correctness; correctness appears only in the report after `finish` |
| Resident DTO | questions expose ONLY `{ no, imageUrl, answered, answer }` — never `trueClass`, `bucket`, `difficulty`, `confusedWith`, `source`, internal ids |
| Finish | allowed with unanswered questions; sets metrics once; second call -> 409 `SESSION_ALREADY_FINISHED` |
| Not found vs forbidden | another user's session -> 404 (do not reveal existence) |

## Contract changes (`packages/contracts/src/session.js`; justified in the PR)
Append to `API_ERROR_CODES`: `SESSION_IN_PROGRESS`, `SESSION_NOT_IN_PROGRESS`, `SESSION_NOT_FINISHED`, `SESSION_ALREADY_FINISHED`, `POOL_EXHAUSTED`, `QUESTION_NOT_FOUND`. Schemas:
- `CreateSessionBodySchema { size: int 45..120, default 60 }`; `AnswerBodySchema { answer: ClassIdSchema, timeMs: int 0..600000 optional }`.
- `QuestionPublicSchema { no, imageUrl, answered: boolean, answer: ClassId|null }`; `SessionPublicSchema { id, index, kind: 'baseline'|'adaptive', status: 'in_progress'|'finished', size, startedAt, finishedAt|null, answeredCount, questions: QuestionPublic[] }`; `SessionSummarySchema` (same without `questions`, plus `overallAccuracy|null`).
- `ClassMetricsSchema { tp, fp, fn, tn, accuracy, precision, recall, f1, fpr, fnr }` (raw, unsmoothed, 0 when a denominator is 0; `accuracy` of a class = correct / questions of that class = recall).
- `ReportItemSchema { no, imageUrl, trueClass, answer|null, correct|null, bucket, difficulty (2 decimals) }`.
- `SessionReportSchema { sessionId, index, kind, size, answeredCount, unansweredCount, overall { correct, total, accuracy }, confusion (3x3, rows = true class, columns = answer, order = CLASS_IDS), perClass (record by ClassId of ClassMetrics), byClassBucket (class -> bucket -> { correct, incorrect }), mastered, perClassMastered, plan (classCounts, bucketCounts, weights, errors, shortfalls, deficit), review: ReportItem[] }`.
- `ProgressSchema { sessions: [{ id, index, kind, finishedAt, overallAccuracy, perClass: record of { accuracy, fpr, fnr }, mastered }], currentWeights, currentErrors (engine, smoothed), topConfusions: [{ trueClass, predicted, count }] (top 5 off-diagonal cells), totals { sessionsFinished, answered } }`.
Tests for every schema (valid/invalid/edge).

## Data model (Mongoose)
- `Session`: `userId`, `index` (1-based per user), `kind`, `status`, `size`, `configSnapshot`, `plan` (engine plan as returned), `questions: [{ no, imageId (internal), publicId, trueClass, bucket, difficulty, confusedWith }]` (server-side only), `startedAt`, `finishedAt`, `metrics` (the `SessionReport` without `review`, stored at finish). Indexes: unique `{ userId, index }`; `{ userId, status }`; `{ userId, 'questions.publicId': 1 }`.
- `Response`: `sessionId`, `userId`, `questionNo`, `imageId`, `trueClass`, `answer`, `bucket`, `correct`, `answeredAt`, `timeMs`; unique `{ sessionId, questionNo }`; index `{ userId: 1 }`.
- `ALLOW_REPEATS` (default `false`) is a new env variable (add to `.env.example`, validate in `env.js`).

## Endpoints (all require the cookie; `resident` unless stated)
| Method + path | Behavior |
|---|---|
| `POST /api/sessions` | body `CreateSessionBody`; 201 `{ data: SessionPublic }`; 409 `SESSION_IN_PROGRESS` / `POOL_EXHAUSTED` |
| `GET /api/sessions` | own sessions, newest first, paginated, `SessionSummary[]` |
| `GET /api/sessions/:id` | own session as `SessionPublic` (works while in progress and after finish) |
| `PUT /api/sessions/:id/questions/:no/answer` | idempotent upsert via `findOneAndUpdate(..., { upsert: true })`; 200 `{ data: { no, answered: true } }`; 409 `SESSION_NOT_IN_PROGRESS`; 404 `QUESTION_NOT_FOUND`; computes `correct` from the stored true class |
| `POST /api/sessions/:id/finish` | computes metrics from the stored responses, then updates the session with ONE conditional update (`status: 'in_progress'` -> `finished` + `metrics` + `finishedAt`); returns `SessionReport`; 409 `SESSION_ALREADY_FINISHED` |
| `GET /api/sessions/:id/report` | finished sessions only (409 `SESSION_NOT_FINISHED` while the session is still in progress); returns `SessionReport` incl. `review` built from the stored question data |
| `GET /api/progress` | `Progress` for the current user |
| `GET /api/admin/users` | instructor; residents list with `sessionsFinished`, `lastAccuracy`, `lastActiveAt`; paginated |
| `GET /api/admin/users/:userId/progress` | instructor; same shape as `/api/progress` |
| `GET /api/admin/sessions/:id/report` | instructor; any finished session's report |
Also replace `canViewImage(user, image)` from T03: a resident may fetch an image only if one of THEIR sessions contains its `publicId`; instructors may fetch any.

## Module layout (`apps/api/src/modules/sessions/`)
`routes.js`, `controller.js`, `service.js` (orchestration), `model.js` (Session, Response), `engine.adapter.js` (the ONLY file importing `@radiology/engine`: `loadPool()`, `loadHistory(userId)`, `buildTest()`), `metrics.js` (pure functions: `buildReport`, `buildProgress`, `topConfusions`), `mapper.js` (DB -> DTO), `admin.routes.js`. Business rules live in the service, not in routes.

## Algorithm: creating a session
```
active = Session.findOne({ userId, status: 'in_progress' })           -> 409 SESSION_IN_PROGRESS
finished = Session.countDocuments({ userId, status: 'finished' })
index = (last session index for this user) + 1
pool = Image.find().lean() -> ImageMeta[]  (id, trueClass, difficulty, bucket, confusedWith)
history = Response.find({ userId, sessionId in finished sessions }).lean() -> engine Response[]
config = EngineConfigSchema.parse({ totalQuestions: size, allowRepeats: ALLOW_REPEATS, seed: `${userId}:${index}` })
result = history.length === 0 ? selectFirstTest(pool, config) : selectNextTest(pool, history, config)
if (result.plan.deficit > 0) -> 409 POOL_EXHAUSTED
questions = result.imageIds.map((id, i) => ({ no: i + 1, imageId: id, publicId, trueClass, bucket, difficulty, confusedWith }))
Session.create({ ..., plan: result.plan })       // unique {userId,index} protects against a double click
```
Known limitation (write it in ADR 0010): images shown in a finished session but left unanswered count as unseen for the no-repeat rule.

## Metrics (pure, in `metrics.js`; reuse engine helpers where they exist)
From the answered responses of one session: confusion matrix; per class TP/FP/FN/TN one-vs-rest; accuracy, precision, recall, F1, FPR, FNR (raw); overall accuracy; `byClassBucket` correct/incorrect; `mastered` = `isMastered(...)` from the engine with the session's responses and the configured threshold; `perClassMastered`. `currentWeights`/`currentErrors` in Progress come from the engine on ALL finished history. Hand-computed unit test (write the arithmetic in comments): 3 classes, 12 answers with a known confusion matrix, expected precision/recall/FPR/FNR.

## Tests (supertest; real local MongoDB; fixture catalog of 126 images = 3 classes x 3 buckets x 14, ids shaped like real ones: `cohen_...` for covid19, `kermany_...` for the others)
1. Create -> baseline with N questions; class counts equal for the three classes (+-1) and the 40/30/30 bucket shares per class (+-1) (verify against T02's tests); 201 DTO.
2. **Leak test:** deep-scan every resident-facing JSON (create, get, answer, list) for the keys `trueClass, bucket, difficulty, confusedWith, source, imageId, passwordHash` and for the strings `cohen_`, `kermany_`, `figure1_`; there must be none (finished `report` and `review` are the only places labels appear).
3. Answer idempotency (same question twice -> one document; the later answer wins); invalid answer value -> 400; unknown `no` -> 404; answer after finish -> 409.
4. Finish with some unanswered questions: `answeredCount` and `unansweredCount` correct, metrics only from answered ones; finish twice -> 409; report before finish -> 409.
5. **Adaptive behavior end to end:** a simulated resident answers a whole baseline session with 'pneumonia' for every COVID-19 image (always wrong) and correctly for the rest; finish; create the next session. Expected (hand-computed with alpha = 1 and N = 60: covid19 error about 0.97, pneumonia about 0.55, normal about 0.07, weights about 0.61 / 0.34 / 0.04, class counts about 27 / 20 / 13): assert `counts.covid19 > counts.pneumonia >= counts.normal`, `counts.covid19 >= 1.5 * minClass`, `counts.normal <= minClass + 3`, no image repeated across the two sessions, `kind === 'adaptive'`. If your numbers differ, investigate before changing the test.
6. One active session rule (409 with the existing id), concurrent create double-click (second request fails cleanly), pool exhaustion 409 with a tiny fixture pool, `ALLOW_REPEATS=true` makes it succeed.
7. Authorization: another resident's session -> 404; resident calling `/api/admin/*` -> 403; instructor can read any report; image route: resident gets bytes only for images in own sessions (200 vs 404).
8. Progress: after two finished sessions the series has two points and `topConfusions[0]` is `covid19 -> pneumonia`.

## Steps (commit after each, push after every 1-3)
0. (no commit) Signatures note in the PR description + developer log.
1. `feat(contracts): add session, report and progress schemas` (+ tests).
2. `feat(api): add session and response models with indexes`.
3. `feat(api): add engine adapter and pure metrics with tests` (hand-computed metrics test first).
4. `feat(api): add create and get session endpoints` (+ tests 1, 2, 6).
5. `feat(api): add answer endpoint` (+ test 3).
6. `feat(api): add finish and report endpoints` (+ test 4).
7. `feat(api): add adaptive next-test flow and progress endpoint` (+ tests 5, 8).
8. `feat(api): add instructor user and progress endpoints and image ownership check` (+ test 7). If time is short this step is the first to cut; T09 can add it.
9. `docs(api): update postman collection, readme, ADR 0010 and sync api skill` — one request per new endpoint; ADR 0010 documents the binding decisions above and the known limitation; board and developer log.

## Verification (show real outputs)
`npm run lint`, `npm test`, `npm run build`. Manual PowerShell run with the REAL catalog: register a resident, `POST /api/sessions` (baseline), answer 10 questions in a loop (`1..10 | ForEach-Object { Invoke-RestMethod -Method Put -Uri "http://127.0.0.1:4000/api/sessions/$sid/questions/$_/answer" -ContentType 'application/json' -Body '{"answer":"normal"}' -WebSession $s }`), `finish`, read the report, create the next session and print the `plan.classCounts`/`plan.shortfalls` from the instructor view or from the database via `mongosh` (never to the resident response). Paste the report summary and the second plan into the PR. **Report what the shortfalls say about the small COVID-19 pool** — do not hide it.

## Acceptance criteria
- [ ] All endpoints and rules above implemented and tested; the leak test passes.
- [ ] The adaptive end-to-end test passes with the hand-computed expectations.
- [ ] No engine file changed (or a separate, approved contract/engine PR exists).
- [ ] CI green; ADR 0010 written; Postman updated; skill synced; board and log updated.
- [ ] AI review done in a fresh chat and its blockers fixed.

## Out of scope
UI, LLM calls, question bank / targeted practice (T08, T09), websockets, timers on the server, admin panels in the web app.
