# T09b - Targeted practice (API + UI)

- Branch: `feat/T09b-targeted-practice`
- Depends on: T08b merged, T09a merged (demo resident makes manual testing easy). Unit/API tests use fixtures, so they do not need real LLM data. The manual demo needs approved questions (T08c gate G2).
- Estimate: about 8-10 h including review. This is the most security-sensitive task of the batch.
- Skills to read first: adaptive-engine, question-generation, api-conventions, persian-rtl-ui. ADRs: 0004, 0008 (opaque ids, label leakage), 0010, 0013 + its addendum, 0007.
- Also read: packages/contracts/src/questionBank.js, packages/engine (`selectTargetedQuestions`, `isMastered`, `createRng`), apps/api code of the question bank model and of sessions (how a catalog id becomes an opaque `publicId`, how the image endpoint authorizes), apps/web QuizPage + QuizLeak test (pattern for the leak test).

## Goal
After a resident has finished at least one test, they can start a "targeted practice set": about 10 APPROVED bank questions chosen by the existing engine function `selectTargetedQuestions` (weighted by the resident's error pairs). They answer one question at a time and see the correct answer and the instructor-approved rationale right after answering. NO live Gemini call anywhere in this task.

## Design decisions (already made - implement, do not redesign; put them in ADR 0014)
1. Only questions with status `approved` can ever be served.
2. A practice set is a server-side document `PracticeSet`: `{ userId, status ('in_progress'|'completed'), questionIds[], optionOrder[] (per question: permutation of option indexes), plan (engine plan snapshot), answers[{ questionId, selectedIndex (in the ORIGINAL option order), correct, timeMs, answeredAt }], createdAt }`. Practice answers are separate from test sessions and never change test metrics.
3. History for the engine is built from the resident's FINISHED test sessions only (contract-shaped `Response[]`). Write a small, pure, tested adapter function for this. `answeredQuestionIds` = all question ids the resident answered in any earlier practice set (no repeats).
4. If the resident has no finished session -> 409 with code `NO_HISTORY`. If no unanswered approved question is left -> 409 `PRACTICE_POOL_EXHAUSTED`. If fewer than `size` are left, return the smaller set.
5. Option order is shuffled per delivery with `createRng` seeded from the set id (LLM answer keys are often biased toward one position). The permutation is stored in the set; the server maps `selectedIndex` back to the original index. The resident only ever sees the shuffled order and the shuffled index.
6. A question can be answered once. Second attempt -> 409 `ALREADY_ANSWERED`. The set becomes `completed` when the last question is answered (no finish endpoint).
7. Only residents use practice. Instructors get 403.
8. Ownership: other users' sets -> same status the project already uses for foreign sessions (read api-conventions / session code and copy it).

## LABEL LEAKAGE RULES (ADR 0008 - the reviewer will test these first)
A resident-facing response must NEVER contain these keys, at any depth: `trueClass`, `confusedWith`, `bucket`, `difficulty`, `source`, `status`, `note`, `consensus`, `analysis`, `catalogId`, `imageId`, `filename`, `generatedBy`, review metadata.
- `correctIndex` and `rationale` appear ONLY inside the answer response and ONLY for a question that has just been answered (and in GET of the set for already-answered questions).
- Images are referenced only by the opaque `publicId` URL (`/api/images/:publicId/file`). The catalog id must never appear (it contains `kermany`/`cohen`/`figure1`).
- The Zod resident schemas are `.strict()` so an extra key fails in tests.

## Step 1 - Contracts (tests first)
`packages/contracts/src/practice.js` (export from index.js): `PracticeCreateRequest` ({ size?: int 5..20, default 10 }), `PracticeQuestionResident` ({ no, type, stem, options[], imageUrl, answered, answer? }), `PracticeSetResident`, `PracticeAnswerRequest` ({ selectedIndex: int 0..optionsLength-1, timeMs? }), `PracticeAnswerResponse` ({ correct, correctIndex, rationale, completed }), `PracticeSummary`. Option count comes from the existing question-bank contract; reuse its constants.
Tests: strict schemas reject each forbidden key; valid examples parse.
Commit: `feat(contracts): add practice schemas`.

## Step 2 - Model and selection service (tests first)
- Mongoose model `PracticeSet` in apps/api (follow the existing model style).
- Pure function `buildEngineHistory(finishedSessions)` and a service `createPracticeSet(userId, size)` that: checks history (NO_HISTORY), loads approved bank items, calls `selectTargetedQuestions(bank, history, { seed }, n, answeredIds)`, builds opaque image URLs, builds shuffled `optionOrder`, saves the set.
- Do NOT modify packages/engine unless you find a real bug; if so, write a failing test in the engine package first and describe it in the PR body.
Tests: adapter output matches the contract; only approved questions are chosen; no repeats across two sets; exhausted pool; fewer-than-size pool; same seed -> same set (determinism); shuffle: for 200 random sets the mapped answer is always the original correct option.
Commit: `feat(api): add practice set model and selection service`.

## Step 3 - Endpoints (tests first)
All under `/api/practice`, auth required, resident only, Zod validation on params/body, errors in the project's error format:
- `POST /api/practice` -> create set -> resident-shaped set.
- `GET /api/practice` -> own sets, newest first, paginated like sessions.
- `GET /api/practice/:id` -> own set (answered questions include `answer`).
- `PUT /api/practice/:id/questions/:no/answer` -> `PracticeAnswerResponse`.
Remember Express 5: `req.query` is read-only; Zod 4 idioms.
Tests: 401 unauthenticated; 403 instructor; NO_HISTORY; foreign set; invalid `no`; out-of-range selectedIndex; ALREADY_ANSWERED; completion flag on the last answer; LEAK SCAN: a helper `assertNoForbiddenKeys(json)` walks every response (create, get, list, answer) and also asserts the serialized JSON contains none of the strings `kermany`, `cohen`, `figure1`, and that `correctIndex`/`rationale` are absent before answering.
Commit: `feat(api): add practice endpoints`.

## Step 4 - Image access
`GET /api/images/:publicId/file` currently allows residents only for images in their own test sessions. Extend: also allowed when the image belongs to a question in one of the resident's own practice sets. Keep instructors global.
Tests (negative first): resident requesting an image that is in neither a session nor a practice set of theirs -> same denial as today; resident A cannot fetch an image served only to resident B; image of a practice set is fetchable by its owner.
Commit: `feat(api): allow practice images for the owning resident`.

## Step 5 - Web
- API hooks in `apps/web/src/features/practice/` (TanStack Query; create set, list, get, answer).
- Routes + nav item "practice" (resident only, under the existing resident guard).
- `PracticeHomePage`: list of sets (date, answered/total, correct count), button "start new set"; explain states `NO_HISTORY` (go take a test first, with a link) and `PRACTICE_POOL_EXHAUSTED` (no more questions; ask instructor/come back later).
- `PracticeSetPage`: one question at a time: image (alt text generic, e.g. "chest X-ray", never a class), stem, options as an accessible radio group, "submit" button; after submit show correct/incorrect, the correct option highlighted (not by colour alone), the rationale, and "next". Final screen: score + link back.
- Link from ReportPage ("targeted practice") when the report lists error pairs.
- Persian text through i18next, RTL logical classes only, educational-only disclaimer visible.
Tests: `PracticeLeak.test.jsx` in the style of QuizLeak (feed a server payload that wrongly contains forbidden keys; assert none of those values is rendered and that rationale is not in the DOM before answering); keyboard operation; states; error toast on 409s.
Commit: `feat(web): add targeted practice pages`.

## Step 6 - Docs
ADR 0014 (decisions 1-8 above + leak rules + "no live LLM"), README endpoints table, Postman collection (4 new requests), sync `.agents/skills/api-conventions` and `question-generation` if they list endpoints, docs/PROGRESS.md row. Commit: `docs: add ADR 0014 and record T09b`.

## Verification commands
```powershell
npm run lint
npm test
npm run demo:seed -w apps/api
npm run questions:status -w apps/api   # needs approved questions for the manual run
```
Manual: log in as the demo resident -> practice -> answer 3 questions in the browser; open DevTools -> Network: check every JSON response for forbidden keys (use the browser's search box); try opening a practice image URL in a private window (must be denied).

## Acceptance criteria
- All new tests pass; the leak scan runs on every resident practice response.
- No Gemini call happens in any practice code path (grep for the provider import in the practice files).
- Instructor 403, foreign set denied, image authorization negative tests exist and pass.
- `packages/engine` unchanged, or changed with a failing-test-first commit explained in the PR body.

## Out of scope
Live LLM explanations, spaced repetition, per-question timing analytics, instructor-side practice analytics, changing the question bank schema, deployment.
