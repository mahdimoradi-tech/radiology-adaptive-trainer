# T10 - Evaluation (reproducible numbers for the report)

- Branch: `feat/T10-evaluation`
- Depends on: T08c gate G1 (analysis done) and G2 (approved questions) for the FINAL numbers. The code can be written earlier with small fixtures.
- Estimate: about 7 h (+ about 1 h manual rating by Mahdi).
- Skills to read first: adaptive-engine, ml-difficulty-pipeline, llm-feedback, question-generation. ADRs: 0004, 0005, 0013. Also: packages/engine README (simulator), ml/artifacts/*.json (look at the real field names), packages/contracts/src/analysis.js, apps/api/scripts/analysis-status.js and questions-status.js.

## Principles (non-negotiable)
1. Every number in the report comes from a command that anyone can re-run. Each output file records: command, date, git SHA, seeds, n.
2. Report honestly. Never tune any parameter, prompt or threshold to improve a result. If adaptive is not faster in the simulation, the output says so.
3. Small samples: always show n and a Wilson 95% confidence interval. No significance claims, no words like "proves".
4. Synthetic demo data (T09a) and anything generated for demos are EXCLUDED from evaluation.
5. The agent writes facts and tables only. The "Interpretation and limitations" section of docs/EVALUATION.md is left as a clearly marked TODO for Mahdi/Claude.
6. Empty denominators print `N/A`, never 0% or 100%.

## Step 0 - Inventory (no commit)
List in the PR body: what the simulator exports and how to call it from code; the fields of ml/artifacts/difficulty.json and catalog.json (is the out-of-fold probability / predicted class stored per image?); the fields of the analysis records (does the LLM output a class guess? which field?); what review metadata a question has (status, note, edits, generation attempts/rejections). If a needed field does not exist, say so and adapt the metric list; do NOT invent data.

## Step 1 - Statistics helpers (tests first)
`packages/engine/src/stats/` (pure functions, exported): `wilsonInterval(k, n, z=1.96)` -> {p, low, high} (n=0 -> nulls); `cohenKappa(table)`; `confusionMatrix` reuse the existing one if it fits.
Known test values: wilsonInterval(8,10) = p 0.8, low about 0.490, high about 0.943 (tolerance 0.001). cohenKappa([[20,5],[10,15]]) = 0.4 exactly (po 0.7, pe 0.5). n=0 cases return nulls.
Commit: `feat(engine): add wilson interval and cohen kappa`.

## Step 2 - E1 Adaptive engine simulation
Script `npm run eval:simulation` (root or packages/engine; follow the repo convention). Runs the existing simulator for policies adaptive / random / fixed with at least 20 fixed seeds and the documented default profile(s); writes `docs/evaluation/simulation.json` and a markdown table (mean and spread of sessions-to-mastery or whatever metric the simulator already defines, per policy). Do not change simulator behaviour or parameters. State in the file header: "simulated residents, not human data; known limitations in packages/engine README".
Commit: `feat(eval): add simulation evaluation script`.

## Step 3 - E2 LLM image analysis vs dataset labels
Script `npm run eval:analysis` reading `apps/api/seed/image-analyses.json` (so it works without DB) plus catalog.json. Output `docs/evaluation/analysis.json` + markdown:
- n images, n runs, schema-valid rate (N/A if empty), automatic validation pass rate.
- Per run and combined: accuracy with Wilson CI; per-class recall and precision; 3x3 confusion matrix vs `trueClass`.
- Run A vs Run B: raw agreement and Cohen's kappa.
- Breakdown by source (kermany / cohen / figure1) and by difficulty bucket (easy/medium/hard).
- Baseline on the SAME images: the DenseNet-121 out-of-fold prediction (if per-image predictions are available in the artifacts) with accuracy + CI.
- Also fix `analysis:status` and `questions:status` output so zero denominators print `N/A` (agreement, valid rate). Add a test.
Commit: `feat(eval): add image analysis evaluation` and `fix(api): print N/A for empty denominators in status scripts`.

## Step 4 - E3 Question quality
Script `npm run eval:questions` with two sub-commands:
- `export-rubric`: writes `docs/evaluation/question-rubric.csv` with up to 24 questions sampled with a FIXED seed, stratified by type (8 per type), columns: id, type, stem, options, keyed answer, rationale, then EMPTY columns for the human rater: `scientific_ok` (0/1), `clear` (1-5), `distractors_plausible` (1-5), `leak_free` (0/1), `comment`.
- `score <csv>`: aggregates the filled CSV: mean per criterion by type, % with scientific_ok=1, n.
- Plus pipeline statistics from the DB or exported files: generation attempts, automatic rejections per validation rule, instructor decisions (approved/rejected/edited) and edit rate, approved per type and per confusion pair.
Mahdi fills the CSV by hand (about 1 h). In the generated markdown add the fixed sentence: "Rated by one non-expert reviewer (the system's builder); results are indicative only."
Tests with a tiny fixture CSV.
Commit: `feat(eval): add question rubric export and scoring`.

## Step 5 - E4 ML per-source accuracy and confound
Script `npm run eval:ml`: from ml artifacts and catalog.json: out-of-fold accuracy overall, per class, per source, per class x source (with n and CI); share of each class by source; bucket distribution per source. If predictions are not stored per image, compute only what the artifacts really support and say what is missing. Do not re-train anything.
Commit: `feat(eval): add ML per-source accuracy report`.

## Step 6 - Aggregate
`npm run eval:all` runs E1, E2, E4 (E3 only scores if the filled CSV exists) and writes `docs/EVALUATION.md` between marker comments (`<!-- GENERATED:START -->` / `<!-- GENERATED:END -->`); outside the markers a hand-written section "Interpretation and limitations" containing only TODO bullets: simulation limits, covid19 has 177 images and source confound, one non-expert reviewer, small n for LLM analysis, free-tier quota, educational-only. Commit: `docs: add evaluation report skeleton`.

## Step 7 - Docs
README (eval commands), docs/PROGRESS.md row, docs/LLM-RUNBOOK.md pointer if useful. Commit: `docs: record T10`.

## Verification commands
```powershell
npm run lint
npm test
npm run eval:all
Get-Content docs/EVALUATION.md -TotalCount 60
```
Run `npm run eval:all` twice: outputs must be identical except the date.

## Acceptance criteria
- Every table shows n and CI where a proportion is reported; empty cells show N/A.
- Re-running gives identical numbers (fixed seeds).
- No parameter in the engine, simulator, prompts or validation rules was changed.
- No synthetic demo data in any evaluation file (reviewer: grep for "synthetic").
- The interpretation section is TODO only.

## Out of scope
Human pilot study, significance tests, re-training the CNN, Grad-CAM, new LLM calls (the evaluation reads saved outputs only).
