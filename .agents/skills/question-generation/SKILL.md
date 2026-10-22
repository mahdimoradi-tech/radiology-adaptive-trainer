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
1. `analyze-images.js` - for each selected catalog image (priority: all hard + medium, then a sample of easy; max ~600 total), send the web image (768 px JPEG) to Gemini WITHOUT the label, with the vocabulary and a JSON Schema; run TWICE with two different prompt wordings (A, B). Store in `image_analyses`: both runs, the model id, prompt version. Read the current multimodal input format in the Gemini docs; do not guess.
2. Auto-validation (pure function, unit-tested): schema valid; `imageQuality == ok`; run A and run B agree on `predictedClass`; `predictedClass == dataset label` (strict); rule checks: `clear_lungs` excludes every other pattern; `normal` requires `clear_lungs` only; `pneumonia`/`covid19` require at least one non-clear pattern. Status `auto_passed` or `auto_rejected` (keep rejected analyses: they are the data for the zero-shot evaluation).
3. `generate-questions.js` - for each `auto_passed` image generate 1-2 four-option MCQs in Persian with this input: validated analysis + true label + `confusedWith` + 1-3 KB snippets. Types: `finding` (which pattern is present - correct option comes from the validated analysis, distractors from vocabulary NOT in the analysis), `distribution`, `differential` (which finding favors the true class over `confusedWith` - answer comes from the KB, not from the image). Output schema: `{ type, stem, options[4], correctIndex, rationale, tags[] }`. Check: 4 unique options, exactly one correct, stem not empty, no `%`, language fa.
4. Store in `question_bank`: `{ imageId, type, pair:{trueClass, confusedWith}, bucket, stem, options, correctIndex, rationale, status:'pending_review', source:{model, promptVersion, analysisId}, reviewedBy, reviewedAt, history[] }`. Statuses: `pending_review | approved | rejected` (+ `edited` flag). Default is never `approved`.
5. Instructor review panel (web, role `instructor`): filter by status/type/pair, see the image next to the question, approve / edit / reject with optional note; bulk approve is NOT allowed. Only `approved` items are ever served.
6. Export/import: `npm run bank:export` writes `apps/api/seed/question-bank.approved.json` (text only, committed); `npm run bank:import` loads it (upsert by stable id). This lets the other operator and the demo work without calling the API.
7. Targeted practice: session kind `targeted` uses `selectTargetedQuestions` from the engine; the quiz UI renders MCQ items with the image; results feed the same metrics (tagged by type) and the narrative report.

## Evaluation hooks (T10)
`scripts/export-llm-eval.js` -> CSV: per image `datasetLabel, runA.predictedClass, runB.predictedClass, densenetPredictedClass (argmax of probs), certainty, autoStatus`; zero-shot accuracy and per-class confusion of the VLM vs the dataset and vs DenseNet; approval/rejection rates per question type; a sample sheet for rubric scoring (scientific accuracy vs KB, Persian fluency, no invented numbers, usefulness). Report honestly if VLM accuracy is low - that is a finding, not a bug.

## Rules
Do not send user data to the API; images are public datasets (state the dataset license in `docs/DATA-SOURCES.md`; free-tier terms may allow Google to use submitted content - note it in the README). Cache everything; never regenerate without bumping the prompt version. Tests use the fake provider with fixtures for each validation branch.
