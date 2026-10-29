# T01b — ML report fixes and data-quality check

Driver: **A (solo)** · Reviewer: none (solo) -> AI review per `docs/SOLO-MODE.md` · Branch: `fix/T01b-ml-report` · Skills: `ml-difficulty-pipeline`, `git-workflow` · Estimate: Part A 1 h; Part B (optional) 2-3 h · Folders: `ml/`, `docs/` only.

## Why this task exists (findings from reading the merged T01 outputs)
1. **The per-class table in `ml/reports/ml-report.md` section 1 has the Pneumonia and Normal rows swapped.** Its supports say Pneumonia = 1582 and Normal = 4245, but the manifest, the bucket tables and the confusion matrix all say Normal = 1582 and Pneumonia = 4245. Recomputed from the confusion matrix: pneumonia precision 0.9870, recall 0.9475, F1 0.9668; normal precision 0.8839, recall 0.9621, F1 0.9213. COVID-19 (0.8406 / 0.9831 / 0.9062) and macro-F1 are correct. Most likely cause: `target_names` order differs from the label-encoding order inside the report script.
2. **We must prove the same ordering bug did NOT reach `difficulty.json`.** The sample entries look plausible (normal images are mostly easy; `confusedWith` is never the true class), but this must be tested, not assumed.
3. **COVID-19 has only 177 images (cohen 142 + figure1 35), of which 172 are "easy", 2 medium, 3 hard.** All COVID-19 images come from two adult sources; pneumonia and normal come from one pediatric source (Kermany). The model can separate classes by source characteristics (patient age, equipment), so COVID-19 "difficulty" is close to 0 for almost everything. This limitation is already named in report section 5; it must also be quantified.

## Part A (mandatory)
1. `fix(ml): correct class order in per-class report table` — find where the report maps label indices to names; use ONE shared constant `CLASS_ORDER = ['covid19', 'pneumonia', 'normal']` for encoding, confusion matrix, classification report and exports. Regenerate `ml/reports/ml-report.md`. Test: supports in the table equal the class counts of `manifest.csv`; precision/recall recomputed from the printed confusion matrix equal the table values (tolerance 1e-4).
2. `test(ml): verify difficulty.json is consistent with out-of-fold predictions` — new pytest that loads `ml/artifacts/difficulty.json` and checks: (a) for each entry `pTrue == probs[trueClass]` and `difficulty == round(1 - pTrue, 4)` (tolerance 1e-4); (b) accuracy computed as `argmax(probs) == trueClass` equals the report's OOF accuracy (95.24%) within 0.01 percentage points; (c) `confusedWith != trueClass` and it is the arg-max of the probabilities after removing the true class; (d) every entry has a fold id in 0..4 and each image appears once; (e) class counts equal the manifest. If any check fails: STOP and report; do not "fix" the data silently.
3. `docs(ml): quantify the source/class confound in the report` — add to the report: class x source table (exists), per-source OOF accuracy, COVID-19 difficulty histogram (deciles), and one honest paragraph: "difficulty for COVID-19 partly reflects source differences; do not interpret it as clinical difficulty". Keep `ADR 0005` unchanged except a link.
4. Push, `/finish-task`, AI review, `merge` (small PR).

## Decision gate (Operator A decides, before T07/T08 start — NOT before T03)
Part B changes the catalog. Every LLM call in T08 is made per catalog image, so changing the catalog AFTER T08 wastes API quota and review time. Decide before T07 starts.
- **Skip Part B:** add a short "accepted limitation" addendum to ADR 0005 and continue. T10 will measure the effect.
- **Do Part B (recommended if time allows):** reduces the age confound.

## Part B (optional): add adult images of the non-COVID classes
1. Inspect what exists locally WITHOUT committing anything: `data/raw/cohen/CovidDataset/` (the 142 adult NORMAL images are not used today) and the local `data/actualmed.zip` (unzip into `data/raw/actualmed/`, list folders and counts per label, read its README/license). Report counts and licenses to the operator and WAIT.
2. If the operator approves: extend `build_manifest.py` with these sources (labels: cohen normal -> `normal`; any adult pneumonia/normal/COVID from actualmed only if its labels are clear and the license allows), keep dedup by sha256, update `docs/DATA-SOURCES.md`.
3. Re-run preprocess, extract features, OOF training, difficulty, catalog export (long CPU run; ask before each step longer than 10 minutes; batch size 16).
4. Re-check the Part A tests, regenerate the report, and compare: COVID-19 recall/precision, covid bucket counts, class x source table. Write the comparison in the report ("before/after").
5. Catalog: still <= 500 per class; COVID-19 gets every available image.
6. Commit as `feat(ml): add adult normal and extra covid sources`, update ADR 0005 addendum, PR, AI review, merge.

## Acceptance criteria
- [ ] Per-class table is correct (supports 177 / 4245 / 1582 unless Part B changed the data) and matches the confusion matrix.
- [ ] The new consistency test exists and passes (`uv run pytest`); `uv run ruff check` passes.
- [ ] The report contains the confound section with real numbers.
- [ ] No images/feature files tracked by git (`git ls-files | Select-String "\.(jpg|png|npy|zip)$"` prints nothing).
- [ ] Decision about Part B written in the ADR 0005 addendum and in the operator log.

## Out of scope
App code, LLM calls, fine-tuning the backbone, Grad-CAM.
