## Task & Team

- **Task ID:** T08a
- **Driver:** Operator A (Mahdi) (solo per `docs/SOLO-MODE.md`)
- **Reviewer:** none (solo) -> AI Review per `docs/SOLO-MODE.md`

## Summary

### What

Implemented the offline, quota-aware, resumable multimodal chest X-ray image analysis pipeline:
1. **Contracts:** Shared closed vocabulary (`packages/contracts/src/vocabulary.js`) for `laterality`, `zones`, `patterns` (9 findings), `distribution`, `predictedClass`, `certainty`, and `imageQuality`. Analysis schema definitions (`packages/contracts/src/analysis.js`) for `AnalysisBatch`, `ImageAnalysis`, and `AnalysisValidation`.
2. **Stratified Analysis Set:** Pure deterministic seeded sampler (`sampling.js`) selecting 120 images (40 per class) over-sampling COVID-19 medium/hard cases and allocating easy cases via largest-remainder (Hamilton-Hare) allocation, persisted in `apps/api/seed/analysis-set.json`.
3. **Batch Planner:** Groups images into mixed-class batches of 6 images per request (`planner.js`), with Run B images reversed and rotated left by one position.
4. **Prompt Builders:** Prompt A and Prompt B builders in `prompts/v1/` ensuring strict information hiding (zero label, dataset source, or catalog ID leakage into system instructions or prompt text).
5. **Validation Rules:** Pure function (`validate.js`) evaluating 9 specific reason codes (`RUN_MISSING`, `SCHEMA_INVALID`, `QUALITY_NOT_OK`, `RUNS_DISAGREE`, `LABEL_MISMATCH`, `RULE_CLEAR_EXCLUSIVE`, `RULE_NORMAL_PATTERNS`, `RULE_DISEASE_NEEDS_PATTERN`, `NO_CONSENSUS_PATTERN`) and deriving consensus patterns ($A \cap B$).
6. **Resumable Runner & CLI Tooling:** Idempotent runner (`runner.js`) and scripts (`analysis-select`, `analysis-plan`, `analysis-run`, `analysis-validate`, `analysis-status`, `analysis-export`, `analysis-import`).
7. **Documentation & Governance:** Authored ADR 0013, updated `docs/DATA-SOURCES.md` and `apps/api/README.md`, and synced `question-generation` skill.

### Why

Google Gemini free-tier quota limits (20 requests/day, 5 RPM) make single-image calls (~1,200 requests) infeasible. Batching 6 images per request across a fixed 120-image set enables comprehensive, verifiable image analysis and zero-shot VLM evaluation in ~40 requests (2.5 calendar days) while staying strictly within the 16 requests/day budget.

## How to Test

```powershell
# 1. Local quality gates
npm run lint
npm test
npm run build

# 2. Pipeline CLI tests
npm run analysis:select -w @radiology/api
npm run analysis:plan -w @radiology/api
npm run analysis:run -w @radiology/api -- --dry-run --max-batches 4
npm run analysis:status -w @radiology/api
npm run analysis:export -w @radiology/api
npm run analysis:import -w @radiology/api
```

## Contract Changes

- **Contract changed?** [x] Yes / [ ] No
- _Note:_ Added `packages/contracts/src/vocabulary.js` and `packages/contracts/src/analysis.js`. Fully backward-compatible; does not break existing contracts. Approved by Operator A in solo mode.

## Dependencies Added

| Package | Version | Why Needed |
| ------- | ------- | ---------- |
| None    | —       | —          |

## What the Reviewer Must Understand

1. **Batching of 6 Images:** Each request interleaves `[ { text: 'Image 1:' }, { image: b64 }, ... ]`. Token limits are not bottlenecked (~12k tokens vs 250k/min).
2. **Class Mixing & Run B Rotation:** Every batch mixes classes so the model cannot infer class from batch homogeneity. Run B uses the same 6 images in reversed-then-rotated order (`[e, d, c, b, a, f]`) under alternative prompt wording.
3. **Zero Label Leakage:** Tested and guaranteed that no dataset labels, source names (`cohen`, `figure1`, `kermany`), filenames, or database IDs appear in prompts.
4. **Strict Ground-Truth Agreement:** High-difficulty images will intentionally show high rejection rates (`auto_rejected`) due to model misclassification, serving as empirical data for T10 zero-shot evaluation.
5. **Resumability:** Batch states (`pending`, `done`, `failed`) are tracked in MongoDB; process interruptions or quota trip-outs (`BUDGET_EXHAUSTED` / `QUOTA_429`) exit cleanly with code 0 and resume seamlessly.

## Screenshots (UI tasks only)

N/A (CLI and pipeline scripts only).

## Checklist

- [x] `npm run lint` passes
- [x] `npm test` passes (453/453 tests green across monorepo)
- [x] `npm run build` passes
- [x] `docs/PROGRESS.md` board row updated
- [x] Operator log updated in `docs/progress/`
- [x] No secrets (`.env`), datasets, images, or large binary files committed
- [x] Commit history follows Conventional Commits
