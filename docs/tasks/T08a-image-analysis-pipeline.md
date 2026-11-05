# T08a — Image analysis pipeline (offline, quota-aware, resumable)

Driver: **A (solo)** · Reviewer: none (solo) -> AI review per `docs/SOLO-MODE.md` · Branch: `feat/T08a-image-analysis` · Skills: `question-generation`, `llm-feedback`, `api-conventions`, `git-workflow`, `team-collaboration` · Estimate: 6 h of coding + about 3 calendar days of quota-limited runs · Folders: `packages/contracts`, `apps/api`, `docs/`.

If this task and a skill disagree, THIS TASK WINS (the skill assumes about 600 images and 1200 calls, impossible with 20 requests/day). Record deviations in ADR 0013.

## Goal
Run a closed-vocabulary multimodal analysis (Gemini) on a fixed, stratified set of about 120 catalog images, twice per image, store everything, and validate it automatically against the dataset labels and rules. The output (`image_analyses` + validation results) feeds T08b (question generation) and T10 (zero-shot evaluation of the model versus the labels). **No resident-facing or instructor-facing endpoint in this task; scripts only.**

## The quota math (why batches)
20 requests/day, 5/min. One image per request would need 240 requests = 12 days. Instead each request carries **6 images** (one text label «Image k» before each image) and returns 6 results. 120 images = 20 batches; two runs = 40 requests = about 3 days at a daily budget of 16. Token limits are not the bottleneck (6 images per request is far below 250k tokens/minute). Risk of batching: the model may mix up images or let one image influence another; mitigations are below (shuffled mixed-class batches, different order in run B, strict index check) and the effect is measured in T10.

## Prerequisites
T07 merged (provider, budget guard, throttle, fake provider, `docs/GEMINI-NOTES.md`). `/sync` done. Read, WITHOUT guessing: `docs/GEMINI-NOTES.md` (image part format), `.agents/skills/question-generation/SKILL.md`, `apps/api/scripts/seed-catalog.js` (copy its env/DB bootstrap), `apps/api/src/modules/catalog/*` (the Image model), `packages/contracts/src/engine.js`.

## Human steps (this is a multi-day task)
1. After step 8 and the PR is open: **Day 1 gate**: `npm run analysis:run -w @radiology/api -- --max-batches 2 --runs A` (2 requests, 12 images). Then `npm run analysis:status -w @radiology/api` and paste its output. STOP and tell Claude if: any batch failed to parse, vocabulary violations are frequent, or run A agrees with the dataset label on fewer than half of the 12 images (that would change the plan, it is not a bug to hide).
2. If the gate looks sane: every following day run `npm run analysis:run -w @radiology/api -- --max-requests 16` once (VPN on), then `analysis:status`. Do not use the same model in AI Studio that day. Continue until `analysis:status` says all batches are done (about 3 days).
3. Merge the PR after the gate day; the remaining days are logged in `docs/progress/` (one line per day: requests used, batches done).

## Binding decisions
| Topic | Decision |
|---|---|
| Analysis set | 120 images, fixed by `apps/api/seed/analysis-set.json` (catalog ids + stratum; committed; server-side only). Per class 40. covid19: all 5 medium+hard + 35 easy (split between sources `cohen`/`figure1` by largest remainder in proportion to the available easy images per source). pneumonia: 14 hard + 13 medium + 13 easy. normal: 14 hard + 13 medium + 13 easy. Seeded sampling (`analysis-v1`) with a tiny pure seeded shuffle in `modules/analysis/sampling.js` (do NOT import the engine outside `engine.adapter.js`). The script fails loudly if a stratum has too few images. |
| Batches | size 6 (`--batch-size`), each batch mixes classes (the whole set is shuffled once with the seed, then cut) so a batch never reveals a class by its composition. Run B uses the SAME 6 images in a different (reversed-then-rotated) order. |
| No labels in prompts | The prompt contains the closed vocabulary and the schema, never the dataset label, the source, the file name or the catalog id. Images are sent as the original JPEG bytes (no resizing, no new dependency; if a file is larger than 4 MB, skip it and log). |
| Result shape | Per image: `{ index, imageQuality, predictedClass, certainty, laterality, zones[], patterns[], distribution }` (vocabulary in `packages/contracts/src/vocabulary.js`, from the skill). Response: `{ results: [ ... exactly N items with indices 1..N, each once ] }`. Anything else -> the whole batch fails (attempt +1; max 2 attempts, then `failed` and reported in status). |
| Two prompts | Prompt A and prompt B differ in wording and field order but use the same schema (`prompts/v1/analyze-a.js`, `analyze-b.js`). Prompt version `v1` is part of the stored key. |
| Quota | Uses the T07 budget/throttle code (`reserve`, min interval). `--max-requests` caps one invocation; the daily budget caps the day; a 429-exhausted day ends the run cleanly (exit code 0, message «budget exhausted, resume tomorrow»). |
| Resumable | Batches are planned once into `analysis_batches` (deterministic ids); `analysis:run` always continues with pending/failed batches; killing the process and running again never repeats a finished batch and never duplicates results. Order: group by group, run A then run B of the same group. |
| Burned-in text caveat | Some images may contain visible letters/annotations that could hint a label to the model. Not mitigated; state it in ADR 0013 and the thesis. |

## Data model (Mongoose, in `apps/api/src/modules/analysis/`)
- `AnalysisBatch`: `batchId` (unique, e.g. `v1-g07-A`), `group`, `run: 'A'|'B'`, `imageIds[]` (in the order sent), `status: pending|done|failed`, `attempts`, `lastError`, `requestedAt`, `finishedAt`, `model`, `promptVersion`.
- `ImageAnalysis`: `imageId`, `run`, `promptVersion`, `model`, `batchId`, `output` (validated object), unique `{ imageId, run, promptVersion }`.
- `AnalysisValidation`: `imageId` (unique per promptVersion), `status: auto_passed|auto_rejected`, `reasons[]`, `consensus { patterns[], distribution|null, laterality|null, zones[] }`, `datasetLabel`, `validatedAt`.

## Pure validation (`modules/analysis/validate.js`, unit-tested branch by branch)
`validateAnalysis({ runA, runB, datasetLabel })` -> `{ status, reasons, consensus }`. Reason codes: `RUN_MISSING`, `SCHEMA_INVALID`, `QUALITY_NOT_OK` (either run `imageQuality !== 'ok'`), `RUNS_DISAGREE` (predictedClass differs), `LABEL_MISMATCH` (predictedClass != dataset label), `RULE_CLEAR_EXCLUSIVE` (`clear_lungs` together with another pattern), `RULE_NORMAL_PATTERNS` (label normal but patterns not exactly `['clear_lungs']`), `RULE_DISEASE_NEEDS_PATTERN` (pneumonia/covid19 with no non-clear pattern), `NO_CONSENSUS_PATTERN` (disease class and the intersection of patterns A and B is empty). Consensus: patterns = intersection of A and B (normal -> `['clear_lungs']`); distribution = the value if A and B agree else `null`; laterality likewise; zones = intersection. `auto_passed` only if there are no reasons. Rejected analyses are kept (they are the data for the zero-shot evaluation).

## Scripts (`apps/api/scripts/`, all print a summary, none prints the API key; add npm scripts in `apps/api/package.json`)
| Script | Behavior |
|---|---|
| `analysis:select` | builds `seed/analysis-set.json` from the DB catalog (idempotent, seeded); prints counts per class x bucket x source |
| `analysis:plan` | creates `analysis_batches` from the set (idempotent) |
| `analysis:run` | options `--max-requests N`, `--max-batches N`, `--runs A|B|A,B`, `--delay-ms` (default from env), `--dry-run` (uses the fake provider, no network, no budget) |
| `analysis:validate` | (re)computes `AnalysisValidation` for all images having both runs |
| `analysis:status` | batches done/pending/failed; images with both runs; schema-valid rate; run A and run B accuracy versus the dataset label (overall and per class); A-B agreement; auto_passed/auto_rejected per class x bucket and the top reject reasons; today's budget used/remaining |
| `analysis:export` / `analysis:import` | text-only `apps/api/seed/image-analyses.json` (both runs + validation + model + prompt version; committed after the runs finish) so T10 and the other operator do not need the API |

## Tests (Vitest, real local MongoDB for models, fake provider for the pipeline)
1. Sampling: counts per stratum, deterministic with the same seed, largest remainder by source, error when a stratum is too small.
2. Batch planning: every image in exactly one batch per run; B order differs from A; batches are class-mixed (no batch with a single class when 3 classes exist).
3. Prompt builders: the text contains the vocabulary and no label words (`covid`, `pneumonia`, `normal` appear ONLY inside the vocabulary lists of `predictedClass`), no file names, no catalog ids.
4. Response check: wrong count, duplicate index, out-of-vocabulary value -> batch failed, attempts incremented, nothing partially stored.
5. Validation: one test per reason code plus the all-pass case and the consensus rules.
6. Resumability: run with `--max-batches 3`, "kill", run again: finished batches are not repeated, total results equal the expected number, no duplicates.
7. Budget: the run stops cleanly when the budget is exhausted (fake clock/usage), exit status OK.
8. Export/import round trip.

## Steps (commit after each, push after every 1-3)
0. (no commit) read the files above; confirm the image part format from `docs/GEMINI-NOTES.md`.
1. `feat(contracts): add closed vocabulary and analysis schemas` (+ tests).
2. `feat(api): add analysis models and set selection` (+ tests 1).
3. `feat(api): add batch planning and prompt builders` (+ tests 2-3).
4. `feat(api): add analysis validation rules` (+ test 5).
5. `feat(api): add resumable analysis run script` (+ tests 4, 6, 7; `--dry-run` works end to end with fixtures).
6. `feat(api): add analysis status and export scripts` (+ test 8).
7. `docs(api): add ADR 0013, data sources note and sync question-generation skill` — ADR 0013: quota math, batching of 6, fixed set composition and why hard/medium are over-sampled, mixed-class batches, original JPEG bytes, the burned-in-text caveat, that strict label agreement will drop many hard images. `docs/DATA-SOURCES.md`: dataset names and links taken from the repo's `ml/` documents; write licenses as «to be verified by the operator» — do NOT invent license text; README: note that free-tier terms may allow Google to use submitted content (operator to verify the current terms). Board and log.
Then the human steps (gate day, daily runs).

## Verification (show real outputs)
`npm run lint`, `npm test`, `npm run build`. `analysis:select` summary table; `analysis:run --dry-run` full pass with fixtures; the real gate-day `analysis:status` output (12 images). Later: final `analysis:status` and the export file size (do not paste the file).

## Acceptance criteria
- [ ] Set, planning, run, validation, status, export all implemented; dry-run works; tests green.
- [ ] No label, source, file name or catalog id can reach a prompt (tested).
- [ ] Gate day done and reported honestly; daily-run log kept; remaining batches either finished or listed.
- [ ] CI green; ADR 0013; skill synced; board and log updated; AI review blockers fixed.

## Out of scope
Question generation, bank, review panel (T08b); any endpoint; the DenseNet comparison and CSV export (T10); resizing images; more than 120 images (can be raised later with the same scripts via `--per-class`).
