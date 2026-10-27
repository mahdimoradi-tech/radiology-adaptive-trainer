# Radiology Adaptive Trainer — Offline ML Pipeline (`ml/`)

This directory contains the offline machine learning pipeline for computing out-of-fold difficulty scores, class probabilities, confusion classes, and web-ready image catalogs for the chest X-ray training platform.

## Architecture

- **Backbone:** DenseNet-121 pre-trained on ImageNet (frozen weights, evaluated with ImageNet normalization).
- **Head:** 3-class classifier (`covid19`, `pneumonia`, `normal`) matching the paper specification:
  - Dense(128) -> ReLU -> Dropout(0.3)
  - Dense(64) -> ReLU -> Dropout(0.3)
  - Dense(16) -> ReLU -> Dropout(0.3)
  - Dense(3) -> Softmax
- **Training Strategy:** Stratified 5-Fold Cross-Validation. Each image receives an Out-of-Fold (OOF) prediction from a model that never saw it during training.
- **Difficulty Score:** $d = 1 - P(y_{\text{true}} \mid x) \in [0, 1]$.
- **Difficulty Buckets:** Easy ($d < 0.34$), Medium ($0.34 \le d < 0.68$), Hard ($d \ge 0.68$).
- **Confused Class:** Most probable incorrect class: $\arg\max_{c \ne y_{\text{true}}} P(c \mid x)$.

## Setup and Commands

Python 3.12 managed via `uv`:

```powershell
# Sync dependencies
uv sync --directory ml

# Run tests
uv run --directory ml pytest

# Run linter
uv run --directory ml ruff check .
```

## Pipeline Execution Order

1. `build_manifest.py`: Scans `data/raw/`, deduplicates images by SHA-256, generates `data/interim/manifest.csv`.
2. `preprocess.py`: Generates 224x224 RGB tensors for the model and 768px JPEGs for web/LLM consumption.
3. `extract_features.py`: Extracts 1024-dimensional DenseNet-121 embeddings to `data/interim/features.npy`.
4. `train_oof.py`: Trains 5-fold heads and records out-of-fold probability vectors.
5. `compute_difficulty.py`: Computes difficulty, buckets, and confusion pairs.
6. `export_catalog.py`: Samples up to 500 images per class for web deployment.
7. `export_json.py`: Generates metadata artifact `ml/artifacts/difficulty.json`.
8. `report.py`: Produces comprehensive evaluation report in `ml/reports/ml-report.md`.
