# T08b — Question generation, question bank and instructor review panel

Driver: **A (solo)** · Reviewer: none (solo) -> AI review per `docs/SOLO-MODE.md` · Branch: `feat/T08b-question-bank` · Skills: `question-generation`, `llm-feedback`, `api-conventions`, `persian-rtl-ui`, `git-workflow`, `review-workflow` · Estimate: 9-10 h + 1 quota day · Folders: `packages/contracts`, `apps/api`, `apps/web`, `docs/`.

If this task and a skill disagree, THIS TASK WINS. Record deviations in an addendum to ADR 0013 and sync `question-generation`.

## Goal
Turn validated analyses into Persian multiple-choice questions, store them as `pending_review`, and let the instructor approve / edit / reject them in a web panel. Only `approved` items are ever served — and in this task NOTHING is served to residents (targeted practice is T09). Approved items can be exported/imported as text so demos work offline.

## Prerequisites
T06, T07 and T08a merged; `analysis:status` shows the analysis runs finished (or at least 80% of batches done — then say so in the PR). `/sync` done. Read, WITHOUT guessing: `.agents/skills/question-generation/SKILL.md`, `apps/api/src/modules/analysis/*`, `apps/api/src/modules/llm/{llm.service,retrieval,budget,cache}.js`, `docs/adr/0013-*`, how T03 builds `publicId` and the instructor catalog DTO (`CatalogImageAdminSchema`), the pagination response shape used by `GET /api/catalog/images`, `apps/web/src/app/layouts/InstructorLayout.jsx` and the T06 sessions feature (to reuse patterns).

## Human steps
1. Run `analysis:validate` and paste `analysis:status` (auto_passed per class x bucket). The number of `auto_passed` images decides the bank size; strict label agreement may reject many hard images — that is a finding, not a bug.
2. One quota day for generation: `npm run questions:generate -w @radiology/api -- --max-requests 12` (VPN on). Do not use the model in AI Studio that day.
3. Review questions in the panel yourself. Reviewer = operator A only (not a clinician). Therefore: approve only what you can verify against the image/KB text, prefer rejecting when unsure, and record in the PR how many were approved/rejected. If a medical student becomes available later, they review the same panel.

## Binding decisions
| Topic | Decision |
|---|---|
| Input to the model | TEXT ONLY: the validated consensus of one image (patterns, distribution, laterality, zones), its true class, `confusedWith`, bucket, and the KB snippets (slug + text) of the pair. No images in this task. |
| Batching | one request covers up to 8 images (`--batch-size 8`); shared KB snippets are sent once per pair. About 60-100 passed images -> 8-13 requests. |
| Question types per image | `finding` always; plus `distribution` if the consensus distribution is not null/`none` and the class is a disease; otherwise `differential`. `differential` is capped per ordered pair (`--max-differential-per-pair 4`) because its answer comes from the KB, not from the image. |
| Answers tied to code | For `finding`/`distribution` every option is `{ text, key }` where `key` is a vocabulary term. Code checks: exactly one option has a key inside the image's consensus (patterns for `finding`, distribution for `distribution`), the other three keys are NOT in the image's analysis, keys unique, and `correctIndex` points to the right option. For `differential` options have `key: null`, and `kbRef` must be one of the supplied KB slugs. |
| Extra checks | 4 unique options (after whitespace/diacritic normalization), stem not empty, no `%`, no digits at all, mostly Persian script (letters >= 60% Persian; short Latin terms allowed), `finding`/`distribution` stems must NOT contain class names (کووید، ذات‌الریه، covid, pneumonia), `rationale` <= 300 chars. Items failing a check are not stored in the bank; the attempt and its reasons are stored in `question_gen_attempts` (T10 uses them for rejection rates). |
| Status flow | New items are `pending_review` (never `approved`). Approve: from `pending_review` or `rejected`. Reject: from `pending_review` or `approved`. Edit: allowed in any state, sets `edited: true`, re-runs the checks, and resets status to `pending_review`. Every change appends to `history[]` (who, when, from/to, before/after of edited fields, note). **No bulk actions.** |
| Idempotency and cost | `stableId = sha1(imageId + type + promptVersion + slot)`; generation skips images that already have items for this prompt version; never regenerates without bumping the prompt version. Uses the T07 budget/throttle. |
| Access | Instructor only (`/api/admin/questions*`); resident -> 403. Nothing in this task reaches residents. |
| Honest labeling | Items carry `source { model, promptVersion, analysisIds }`; the panel shows «بازبینی توسط مدرس (غیر بالینی)» next to approved items unless a clinical reviewer flag is set later. |

## Contract changes (`packages/contracts/src/questionBank.js`; Operator A approves in the PR)
`QUESTION_TYPES ('finding'|'distribution'|'differential')`, `QUESTION_STATUSES ('pending_review'|'approved'|'rejected')`, `QuestionOptionSchema { text, key: string|null }`, `GeneratedQuestionSchema { type, stem, options[4], correctIndex 0..3, rationale, kbRef|null, tags[] }`, `GenerationOutputSchema { items: [{ imageIndex, questions[] }] }`, `QuestionBankAdminSchema` (id, stableId, type, pair { trueClass, confusedWith }, bucket, stem, options, correctIndex, rationale, kbRef, tags, status, edited, source, reviewedBy|null, reviewedAt|null, note|null, history[], imageUrl, analysis summary { consensus, certaintyA, certaintyB }), `QuestionBankStatsSchema` (counts by status and by type and by pair), edit/approve/reject bodies. Tests for every schema. Append no new error codes unless needed (use `NOT_FOUND`, `FORBIDDEN`, `VALIDATION_ERROR`).

## API (`apps/api/src/modules/bank/`: `model.js`, `validate.js` pure, `generate.js` service used by the script, `routes.js` under admin, `mapper.js`)
| Method + path | Behavior |
|---|---|
| `GET /api/admin/questions` | filters `status`, `type`, `trueClass`, `confusedWith`, pagination; newest first |
| `GET /api/admin/questions/stats` | counts for the panel |
| `GET /api/admin/questions/:id` | full item incl. image `url` (publicId, same helper as the catalog admin DTO) and analysis summary |
| `POST /api/admin/questions/:id/approve` | body `{ note? }`; sets `reviewedBy` = current user |
| `POST /api/admin/questions/:id/reject` | body `{ note? }` |
| `PUT /api/admin/questions/:id` | edit `stem`, `options[].text`, `correctIndex`, `rationale`; `key` values and `type` are NOT editable; re-validation errors -> 400 `VALIDATION_ERROR` with the reason codes |
Scripts: `questions:generate` (`--max-requests`, `--batch-size`, `--limit`, `--dry-run` with the fake provider), `questions:status`, `bank:export` (writes `apps/api/seed/question-bank.approved.json`, approved items only, text only, committed), `bank:import` (upsert by `stableId`, status approved, skips items whose image id is missing in the catalog with a warning).

## Web: instructor review panel (replace the T08 placeholder of `/instructor/review`; `residents` and `catalog` stay placeholders for T09)
- Layout: filter bar (status default «در انتظار بازبینی», type, pair), a list (20 per page) on the side, detail pane on the main side. In the detail pane: the image (instructor may see it with labels), the question (stem, four options with the correct one marked), rationale, KB reference with the «پیش‌نویس» badge, true class + bucket, auto-validation info (consensus patterns/distribution, certainty of runs A and B), history.
- Actions: «تأیید», «رد» (optional note), «ویرایش» (inline form: stem, four option texts, correct option, rationale; save returns the item to pending). Shortcuts: A approve, R reject, J/K or arrows next/previous in the list. After an action the list advances to the next item. No multi-select.
- Stats strip: pending/approved/rejected counts.
- Use RTL logical classes, existing UI components, i18n keys `instructor.review.*`. Instructor-only guard already exists.

## Tests
API (Vitest + supertest, fake provider): (1) generation parser/validator, one test per check and per failure reason (wrong key counts, 2 correct keys, duplicate options, digits, `%`, class name in a finding stem, missing `kbRef`, non-Persian text); (2) type assignment and the differential cap; (3) generation is idempotent (second run creates nothing) and respects the budget; (4) status transitions table, including edit -> pending and history entries; (5) authorization: resident 403 on every route; instructor ok; (6) **no resident-facing route returns bank items** (route scan of resident endpoints for `stem`/`options`); (7) export contains only approved items and no `pending_review`; import is an upsert; (8) filters/pagination. Web (Vitest): list/detail rendering, filters, approve/reject/edit flows with mocked API, shortcuts, no bulk controls exist.

## Steps (commit after each, push after every 1-3)
0. (no commit) read the files above; record in the PR the real `analysis:status` numbers.
1. `feat(contracts): add question bank schemas` (+ tests).
2. `feat(api): add question bank model and validation rules` (+ tests 1, 4 part: model-level).
3. `feat(api): add question generation service and script` (+ tests 2, 3). HUMAN RUNS the generation day here.
4. `feat(api): add admin question endpoints` (+ tests 4, 5, 6, 8).
5. `feat(api): add bank export and import scripts` (+ test 7).
6. `feat(web): add review panel list and detail` (web tests part 1).
7. `feat(web): add approve, reject and edit actions` (web tests part 2).
8. `docs(api): update ADR 0013 addendum, readme, postman and sync question-generation skill` — addendum: question types and checks, tied-keys design, status flow, that the reviewer is a non-clinician and the consequences (limitation for thesis); board and log.
Cut order if time is short: step 7's edit form (keep approve/reject) -> keyboard shortcuts -> `distribution` type.

## Verification (show real outputs)
`npm run lint`, `npm test`, `npm run build`. `questions:generate --dry-run`; the real run's summary (requests used, images processed, items created per type, attempts rejected per reason); `questions:status`; screenshots of the panel (list + detail); after you review: `bank:export` item count by type and pair. Say plainly how many hard/medium images survived and what that means for the bank.

## Acceptance criteria
- [ ] Generation, checks, bank, admin API, export/import, and panel work; nothing reaches residents (tested).
- [ ] Every approved item satisfies the tied-keys rule; no item can be approved without an instructor action.
- [ ] Review done by the operator with counts reported; limitations written down.
- [ ] CI green; ADR 0013 addendum; skill synced; board and log updated; AI review blockers fixed.

## Out of scope
Serving questions to residents, targeted practice sessions (T09); residents and catalog pages (T09); image generation of new questions with the image attached to the prompt; bulk approve; clinician review workflow beyond the flag.
