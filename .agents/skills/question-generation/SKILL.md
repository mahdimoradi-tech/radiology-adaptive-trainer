---
name: question-generation
description: Spec for LLM image analysis and question-bank generation (the professor's main LLM emphasis) - offline batch scripts, closed-vocabulary multimodal analysis with Gemini, automatic validation and consistency checks, MCQ generation in Persian, instructor review panel and statuses, export/import of the approved bank, targeted practice sessions, and zero-shot evaluation hooks. Use this skill whenever you touch image analysis, VLM, question generation, the question bank, the instructor review panel, targeted practice, or when anyone mentions generated questions, image analysis, multimodal, or approve/reject questions. Also load llm-feedback.
---

# Image analysis + question generation

Principle: the LLM reads images unreliably. We therefore use a CLOSED vocabulary, check results automatically, and require instructor approval before any generated question reaches a resident. Labels always come from the dataset.

## Closed vocabulary (`packages/contracts/src/vocabulary.js`)
- `laterality`: bilateral | left | right | none
- `zones` (array): upper | middle | lower
- `patterns` (array): clear_lungs | opacity | consolidation | ground_glass | air_bronchograms | interstitial | pleural_thickening | pleural_effusion | hyperinflation
- `distribution`: peripheral | central_perihilar | diffuse | focal_lobar | none
- `predictedClass`: covid19 | pneumonia | normal; `certainty`: low | medium | high; `imageQuality`: ok | poor | not_cxr

## Image Analysis Pipeline (T08a)
> **Quota Architecture (ADR 0013):** To fit Gemini free-tier quota (20 req/day, 5 RPM), analysis uses a fixed stratified set of 120 images (`seed/analysis-set.json`) processed in batches of 6 images per request across 20 groups (40 requests total for Run A and Run B over ~2.5 quota days). Raw JPEG bytes are sent directly without resizing.

1. `analysis:select` & `analysis:plan` - Selects 120 images (40 per class, oversampling hard/medium covid19 and balancing pneumonia/normal 14 hard / 13 med / 13 easy) and plans 40 batches with mixed-class groups. Run B uses the same images reversed and rotated left by 1.
2. `analysis:run` - Sends 6 images per multimodal request with the closed vocabulary to Gemini WITHOUT labels or metadata. Run twice with Prompt A (`prompts/v1/analyze-a.js`) and Prompt B (`analyze-b.js`). Stored in `image_analyses`. Supports `--dry-run`, `--max-requests`, `--max-batches`, `--runs A|B`.
3. Auto-validation (`analysis:validate` / `validate.js`): Pure function, 9 reason codes. An image is `auto_passed` ONLY if: schema valid; `imageQuality == ok`; run A and run B agree on `predictedClass`; `predictedClass == dataset label` (strict); rule checks: `clear_lungs` excludes every other pattern; `normal` requires `clear_lungs` only; `pneumonia`/`covid19` require at least one non-clear pattern; consensus patterns intersection $A \cap B$ is non-empty. Rejected analyses are kept for zero-shot evaluation (T10).
4. Status & Export: `analysis:status` displays live dashboard (coverage, accuracy, agreement, rejection reasons, budget); `analysis:export` / `analysis:import` syncs `seed/image-analyses.json`.

---

## Question Bank Generation & Review (T08b)

### 1. Generation Architecture & Idempotency
- **Input:** Text-only prompt (`prompts/v1/generate-questions.js`). Validated consensus findings ($A \cap B$ patterns, distribution, laterality, zones), trueClass, confusedWith, bucket, and 1-3 KB snippets for the confusion pair. No images are sent to Gemini during question generation.
- **Batching & Budget:** Batches of up to 8 images per request (`--batch-size 8`), respecting the 20 RPD / 5 RPM budget tracker.
- **Idempotency:** Stable ID computed as `sha1(imageId + type + promptVersion + slot)`. Repeat runs skip previously generated items automatically with zero Gemini API calls.
- **CLI Commands:**
  ```powershell
  # Dry-run or live generation
  npm run questions:generate -w @radiology/api -- --dry-run
  npm run questions:generate -w @radiology/api -- --max-requests 12

  # Check live stats and attempt metrics
  npm run questions:status -w @radiology/api

  # Export / Import approved questions
  npm run bank:export -w @radiology/api
  npm run bank:import -w @radiology/api
  ```

### 2. Question Types & Tied-Keys Design
- **`finding`:** Generated for all validated images. Options have `key` tied to closed vocabulary (`PATTERN_VALUES`). Exactly one option key matches the image's consensus patterns ($A \cap B$), exactly three option keys are chosen from non-consensus distractors, and `correctIndex` points to the consensus option.
- **`distribution`:** Generated if consensus distribution is non-null/non-none and disease class. Options have `key` tied to `DISTRIBUTION_VALUES`. Exactly one option key matches consensus distribution, and three keys are non-matching distractors.
- **`differential`:** Generated if distribution is not applicable, capped per ordered pair (`--max-differential-per-pair 4`). Options have `key: null`; `kbRef` is linked directly to a verified KB slug.

### 3. Pure Validation Engine (`modules/bank/validate.js`)
Rejects candidates failing any of the following checks, saving attempts in `question_gen_attempts` for evaluation:
1. `INVALID_SCHEMA`: Fails `CandidateQuestionSchema` or missing required fields.
2. `OPTIONS_NOT_FOUR`: Option count != 4.
3. `OPTIONS_DUPLICATE`: Two or more options are identical after normalization (diacritics, spaces).
4. `CORRECT_INDEX_OUT_OF_BOUNDS`: `correctIndex` not in 0..3.
5. `STEM_EMPTY`: Stem empty or whitespace only.
6. `STEM_CONTAINS_CLASS_NAME`: Stem leaks class label (`covid`, `pneumonia`, `normal`, کووید، ذات‌الریه، نرمال).
7. `CONTAINS_PERCENTAGE_OR_DIGIT`: Any ASCII 0-9, Arabic/Persian digits (۰-۹, ٠-٩), or % / ٪ symbols in stem, options, or rationale.
8. `PERSIAN_LETTER_RATIO_LOW`: Less than 60% Persian letters in stem or options.
9. `TIED_KEY_MISMATCH`: Option keys do not match consensus pattern or distractors from closed vocabulary.
10. `RATIONALE_TOO_LONG`: Rationale exceeds 300 characters.

### 4. Admin API & Instructor Review Panel
- **Mongoose Models:** `QuestionBankModel` (`question_bank`) and `QuestionGenAttemptModel` (`question_gen_attempts`).
- **Status Lifecycle:** `pending_review` (default) -> `approved` or `rejected`. Edits record audit diff in `history[]`, mark `edited: true`, and reset status to `pending_review`. Default is never `approved`.
- **Endpoints (Role `instructor` only):**
  - `GET /api/admin/questions` — Paginated list with filters (`status`, `type`, `trueClass`, `confusedWith`, `page`, `pageSize`).
  - `GET /api/admin/questions/stats` — Review panel statistics counts.
  - `GET /api/admin/questions/:id` — Full question detail with image URL and AI consensus analysis.
  - `POST /api/admin/questions/:id/approve` — Approve question (`{ note? }`).
  - `POST /api/admin/questions/:id/reject` — Reject question (`{ note? }`).
  - `PUT /api/admin/questions/:id` — Edit question and reset status to `pending_review`.
- **Resident Isolation:** Resident users receive 403 on all `/api/admin/questions*` endpoints. Question bank stems and options never leak to resident endpoints.
- **Web UI (`/instructor/review`):**
  - Split-pane review interface: stats strip, filter bar, 20/page list, detail pane with `XrayImage`, consensus finding badges, options with correct highlighted, rationale, draft KB badge, and audit history.
  - Keyboard shortcuts: `A` (approve), `R` (reject), `J` (next), `K` (previous).
  - Strictly **ZERO bulk actions** (every question requires individual review).
  - Honest labeling badge: «بازبینی توسط مدرس (غیر بالینی)» per ADR 0013 Addendum.

### 5. Export/Import Portable Seed
- `npm run bank:export` writes `apps/api/seed/question-bank.approved.json` (portable approved subset).
- `npm run bank:import` loads it into MongoDB with upsert by stable ID, enabling zero-cost demos and multi-machine sync.

---

## Evaluation Hooks (T10)
- `scripts/export-llm-eval.js` -> CSV: per image `datasetLabel, runA.predictedClass, runB.predictedClass, densenetPredictedClass (argmax of probs), certainty, autoStatus`.
- Zero-shot accuracy and per-class confusion of the VLM vs dataset and vs DenseNet.
- Generation attempt yield and rejection reasons breakdown from `question_gen_attempts`.
- Scientific accuracy vs KB, Persian fluency, no invented numbers, usefulness. Report honestly if VLM accuracy is low - that is a finding, not a bug.

## Rules
- Do not send user data to the API; images are public datasets.
- Cache everything; never regenerate without bumping prompt version or using explicit `--force`.
- Tests use the fake provider with fixtures for each validation branch.
