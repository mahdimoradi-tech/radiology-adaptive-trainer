---
name: question-generation
description: Spec for LLM image analysis and question-bank generation (the professor's main LLM emphasis) - offline batch scripts, closed-vocabulary multimodal analysis with Gemini, automatic validation and consistency checks, MCQ generation in Persian, instructor review panel and statuses, export/import of the approved bank, targeted practice sessions, and zero-shot evaluation hooks. Use this skill whenever you touch image analysis, VLM, question generation, the question bank, the instructor review panel, targeted practice, or when anyone mentions generated questions, image analysis, multimodal, or approve/reject questions. Also load llm-feedback.
---

# Image analysis + question generation

Principle: the LLM reads images unreliably. We therefore use a CLOSED vocabulary, check results automatically, and require instructor approval before any generated question reaches a resident. Labels always come from the dataset.

## Closed vocabulary (put in `packages/contracts/src/vocabulary.js`)
- `laterality`: bilateral | left | right | none
- `zones` (array): upper | middle | lower
- `patterns` (array): clear_lungs | opacity | consolidation | ground_glass | air_bronchograms | interstitial | pleural_thickening | pleural_effusion | hyperinflation
- `distribution`: peripheral | central_perihilar | diffuse | focal_lobar | none
- `predictedClass`: covid19 | pneumonia | normal; `certainty`: low | medium | high; `imageQuality`: ok | poor | not_cxr

## Pipeline (scripts in `apps/api/scripts/`, resumable, throttled `--delay-ms`, `--limit`, `--concurrency 1`)
> **T08a Quota Architecture Update (ADR 0013):** To fit Gemini free-tier quota (20 req/day, 5 RPM), analysis uses a fixed stratified set of 120 images (`seed/analysis-set.json`) processed in batches of 6 images per request across 20 groups (40 requests total for Run A and Run B over ~2.5 quota days). Raw JPEG bytes are sent directly without resizing.

1. `analysis:select` & `analysis:plan` - Selects 120 images (40 per class, oversampling hard/medium covid19 and balancing pneumonia/normal 14 hard / 13 med / 13 easy) and plans 40 batches with mixed-class groups. Run B uses the same images reversed and rotated left by 1.
2. `analysis:run` - Sends 6 images per multimodal request with the closed vocabulary to Gemini WITHOUT labels or metadata. Run twice with Prompt A (`prompts/v1/analyze-a.js`) and Prompt B (`analyze-b.js`). Stored in `image_analyses`. Supports `--dry-run`, `--max-requests`, `--max-batches`, `--runs A|B`.
3. Auto-validation (`analysis:validate` / `validate.js`): Pure function, 9 reason codes. An image is `auto_passed` ONLY if: schema valid; `imageQuality == ok`; run A and run B agree on `predictedClass`; `predictedClass == dataset label` (strict); rule checks: `clear_lungs` excludes every other pattern; `normal` requires `clear_lungs` only; `pneumonia`/`covid19` require at least one non-clear pattern; consensus patterns intersection $A \cap B$ is non-empty. Rejected analyses are kept for zero-shot evaluation (T10).
4. Status & Export: `analysis:status` displays live dashboard (coverage, accuracy, agreement, rejection reasons, budget); `analysis:export` / `analysis:import` syncs `seed/image-analyses.json`.
5. `generate-questions.js` (T08b) - for each `auto_passed` image generate 1-2 four-option MCQs in Persian with this input: validated analysis + true label + `confusedWith` + 1-3 KB snippets. Types: `finding` (which pattern is present - correct option comes from the validated analysis, distractors from vocabulary NOT in the analysis), `distribution`, `differential` (which finding favors the true class over `confusedWith` - answer comes from the KB, not from the image). Output schema: `{ type, stem, options[4], correctIndex, rationale, tags[] }`. Check: 4 unique options, exactly one correct, stem not empty, no `%`, language fa.
6. Store in `question_bank`: `{ imageId, type, pair:{trueClass, confusedWith}, bucket, stem, options, correctIndex, rationale, status:'pending_review', source:{model, promptVersion, analysisId}, reviewedBy, reviewedAt, history[] }`. Statuses: `pending_review | approved | rejected` (+ `edited` flag). Default is never `approved`.
7. Instructor review panel (web, role `instructor`): filter by status/type/pair, see the image next to the question, approve / edit / reject with optional note; bulk approve is NOT allowed. Only `approved` items are ever served.
8. Export/import: `npm run bank:export` writes `apps/api/seed/question-bank.approved.json` (text only, committed); `npm run bank:import` loads it (upsert by stable id). This lets the other operator and the demo work without calling the API.
9. Targeted practice: session kind `targeted` uses `selectTargetedQuestions` from the engine; the quiz UI renders MCQ items with the image; results feed the same metrics (tagged by type) and the narrative report.

## Evaluation hooks (T10)
`scripts/export-llm-eval.js` -> CSV: per image `datasetLabel, runA.predictedClass, runB.predictedClass, densenetPredictedClass (argmax of probs), certainty, autoStatus`; zero-shot accuracy and per-class confusion of the VLM vs the dataset and vs DenseNet; approval/rejection rates per question type; a sample sheet for rubric scoring (scientific accuracy vs KB, Persian fluency, no invented numbers, usefulness). Report honestly if VLM accuracy is low - that is a finding, not a bug.

## Rules
Do not send user data to the API; images are public datasets (state the dataset license in `docs/DATA-SOURCES.md`; free-tier terms may allow Google to use submitted content - note it in the README). Cache everything; never regenerate without bumping the prompt version. Tests use the fake provider with fixtures for each validation branch.
