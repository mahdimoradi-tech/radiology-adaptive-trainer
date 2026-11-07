---
name: ml-difficulty-pipeline
description: Step-by-step spec for the OFFLINE Python pipeline in ml/ (Windows, CPU) that merges the chest X-ray datasets, extracts DenseNet-121 features, trains the 3-class head with k-fold out-of-fold predictions, computes per-image difficulty d = 1 - p(true class) and confusedWith, creates the app catalog subset and web-size images, and writes ml/artifacts/difficulty.json. Use this skill whenever you touch the ml/ folder, datasets, DenseNet, PyTorch, difficulty scores, buckets, catalog, or when anyone mentions training, features, folds, or the image catalog.
---

# ML difficulty pipeline (ml/)

Goal: for EVERY image a difficulty in [0,1] from a model that never saw that image in training (out-of-fold), plus a small catalog for the web app. The web app never runs the model; it reads `difficulty.json` and the catalog images.

## Environment (Windows, CPU only)
- Python 3.12 via `uv` (`uv python install 3.12`, `uv init`, `uv add ...`; commit `pyproject.toml` + `uv.lock`). Backbone is FROZEN, features are extracted once, so a medium CPU is enough; expect tens of minutes for ~6.4k images; the step is resume-safe. Run the full pipeline on ONE machine (the driver's); the reviewer runs the `--limit 200` smoke mode on theirs.
- Packages (verify with the dependency protocol): torch + torchvision CPU wheels (use the Windows CPU install line from pytorch.org/get-started; stay on the version in TOOLCHAIN), numpy, pandas, scikit-learn, pillow, tqdm, pytest, ruff. Fixed `SEED=42` for numpy/torch/sklearn. Log package versions into the report.
- Every script: `--help`, `--limit N` (dev mode), idempotent, prints progress, uses `pathlib`, works with Windows paths.

## Data (HUMAN steps - ask the driver to do them and wait)
Raw data in `data/raw/<source>/` (git-ignored; never commit images): `kermany` (Chest X-Ray Images, normal + pneumonia; Mendeley doi 10.17632/RSCBJBR9SJ.3 or a mirror), `cohen` (github.com/ieee8023/covid-chestxray-dataset, frontal chest X-ray rows labeled COVID-19), `actualmed` and `figure1` (github.com/agchung/Actualmed-COVID-chestxray-dataset, github.com/agchung/Figure1-COVID-chestxray-dataset, COVID-19 rows). Fill `docs/DATA-SOURCES.md` (source, URL, license, citation, what was used). Paper sizes (approx): pneumonia 4273, normal 1583, covid19 576. VPN is available to the team.

## Steps (one script each in `ml/src/`)
1. `build_manifest.py` -> `data/interim/manifest.csv` (`image_id, path, source, label, sha256`). Drop non-frontal/unreadable files, DEDUPE by sha256 (report counts). Write class x source table to `ml/reports/manifest-report.md` (exposes the source-shortcut risk).
2. `preprocess.py`: (a) model input 224x224 RGB with ImageNet normalization (direct resize like the paper; record the choice); (b) web copy: max side 768 px, JPEG quality 90, saved to `data/processed/web/<image_id>.jpg` - these are served by the API AND sent to the VLM, so 224 px is NOT enough.
3. `extract_features.py`: torchvision `densenet121(weights=DEFAULT)`, eval, `torch.no_grad()`, global-average-pooled 1024-d features -> `data/interim/features.npy` + `ids.npy`; batch 32; tqdm; resume-safe.
4. `train_oof.py`: stratified 5-fold (`StratifiedKFold(shuffle=True, random_state=SEED)`). Head as in the paper: Dense128-ReLU-Dropout0.3 -> Dense64-ReLU-Dropout0.3 -> Dense16-ReLU-Dropout0.3 -> Dense3-Softmax; Adam lr 1e-3; class-weighted cross-entropy; <=100 epochs; early stopping (val loss, patience 8); ReduceLROnPlateau (factor 0.5, patience 4). Per fold train on 4 folds (10% of them for early stopping), predict ONLY on the held-out fold. Each image gets exactly one OOF probability vector.
5. `compute_difficulty.py`: `pTrue = probs[true]`, `difficulty = 1 - pTrue`; bucket by thresholds (default 0.34/0.68); `confusedWith = argmax of probs over classes != true`. If any bucket has < 5% of a class, STOP and report (options: quantile thresholds vs paper thresholds); do not silently change.
6. `export_catalog.py`: choose the app catalog: up to 500 images per class; take ALL hard and medium images of a class (up to the cap) and fill the rest with random easy ones (seeded). Copy their web images to `data/catalog/images/` and write `ml/artifacts/catalog.json`. Zip `data/catalog` as `catalog-images.zip` for sharing (not committed).
7. `export_json.py` -> `ml/artifacts/difficulty.json` for ALL images: `{ imageId, filename, trueClass, source, fold, probs, pTrue, difficulty, bucket, confusedWith, inCatalog }`. Committed (metadata only).
8. `report.py` -> `ml/reports/ml-report.md`: OOF accuracy, per-class P/R/F1, confusion matrix, difficulty histogram, bucket x class x source tables, limitations (dataset shift between sources, label noise, not clinical).

## Acceptance
`uv run pytest` passes (tiny synthetic tests: fold disjointness, difficulty formula, bucket function, confusedWith, JSON schema); same seed -> identical outputs; `git ls-files` contains no jpg/png/npy; report linked from the board; `docs/DATA-SOURCES.md` filled.
Optional (Could): Grad-CAM sanity check; Colab notebook if the CPU is too slow (the developer runs it).
