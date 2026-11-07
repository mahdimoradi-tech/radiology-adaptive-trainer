# T01 — ML pipeline: out-of-fold difficulty and app catalog

Driver: **A** · Reviewer: **B** · Branch: `feat/T01-ml-pipeline` · Skills: `ml-difficulty-pipeline`, `git-workflow`, `review-workflow` · Estimate: 8 h (plus unattended run time) · Folders: `ml/`, `docs/DATA-SOURCES.md` only.

## Goal
For every chest X-ray, produce a difficulty score from a model that never saw that image (5-fold out-of-fold), buckets, `confusedWith`, and a ~1,500-image catalog (web-size images) for the app. Output files the rest of the team depends on: `ml/artifacts/difficulty.json`, `ml/artifacts/catalog.json`, `ml/reports/ml-report.md`, and a shareable `catalog-images.zip` (not committed).

## Prerequisites
T00 merged (A has `/sync`ed). Free disk space >= 15 GB. Read `docs/DOMAIN.md` sections 1-2 and the skill `ml-difficulty-pipeline` completely.

## Human steps (agent: ask A to do these, then wait)
1. Install Python 3.12 (Windows installer, "Add to PATH") and `uv` (official installer). Verify `python --version`, `uv --version`.
2. Download the datasets into `data/raw/<source>/` (create the folders): `kermany` (normal + pneumonia), `cohen` (github.com/ieee8023/covid-chestxray-dataset), `actualmed` and `figure1` (github.com/agchung/...). Use a VPN if needed. Do NOT commit them (`/data/` is ignored).
3. Tell the agent the folder names/structure you got. Do not guess licenses: open each dataset page/README and give the agent the license text or link.

## Steps (commit after each; push after every 1-3 commits)
1. `chore(ml): initialize uv project` - `ml/pyproject.toml`, Python 3.12 pin, ruff + pytest config, `ml/README.md`. Install packages with the dependency protocol; for PyTorch use the Windows CPU command from pytorch.org (verify the version in TOOLCHAIN).
2. `docs(ml): record data sources and licenses` - fill `docs/DATA-SOURCES.md` (source, URL, license, citation, what we use).
3. `feat(ml): build manifest with dedup` - `build_manifest.py` (+ test on synthetic files). Report removed duplicates and the class x source table in `ml/reports/manifest-report.md`.
4. `feat(ml): preprocess images` - 224 px for the model, 768 px web JPEGs. `--limit N` dev mode first (try 200 images end-to-end), then the full run.
5. `feat(ml): extract densenet121 features` - resumable; show progress; run the full extraction (CPU: expect tens of minutes; keep the PC awake).
6. `feat(ml): train head with 5-fold out-of-fold predictions` - as in the skill; tests for fold disjointness.
7. `feat(ml): compute difficulty, buckets and confusedWith` - STOP and report to A if a bucket has < 5% of a class.
8. `feat(ml): export difficulty.json and catalog` - catalog up to 500 per class (all hard + medium first, easy fill, seeded); create `data/catalog/images/`, `catalog.json`, and `catalog-images.zip`.
9. `docs(ml): add ml report` - `ml/reports/ml-report.md` (OOF accuracy, per-class P/R/F1, confusion matrix, difficulty histogram, bucket x class x source table, limitations).

## Verification (show real outputs)
`uv run pytest`, `uv run ruff check`; re-run one step with the same seed and compare file hashes (must match); `git ls-files` shows no `.jpg/.png/.npy/.zip`; counts in `catalog.json` per class; a 10-image spot check printed as `imageId, trueClass, pTrue, difficulty, bucket`.

## Acceptance criteria
- [ ] `difficulty.json` has one entry per image with the schema in the skill; every `difficulty` in [0,1].
- [ ] No image was scored by a model trained on it (fold column proves it; test exists).
- [ ] Catalog has <= 500 per class and includes hard/medium/easy images; zip created and its size reported.
- [ ] Report lists limitations honestly (source shortcut, label noise, not clinical).
- [ ] PR opened (Driver A, Reviewer B). B can explain: what out-of-fold means, why we freeze the backbone, what `difficulty` means.

## After merge
A sends `catalog-images.zip` to B out-of-band (Drive/USB). B unzips it into `data/catalog/` (the `npm run data:install` script arrives in T03). Update the board and your log.

## Out of scope
Any app code, GPU training, fine-tuning the backbone, Grad-CAM (Could), LLM calls.
