# ADR 0005: Difficulty Thresholds, Contract Alignment, and Catalog Diversity Policy

## Status

Accepted (Date: 2026-10-27, Operator A solo review and refinement)

## Context

In Task T01 (Offline ML Pipeline), DenseNet-121 feature extraction and 5-fold Out-of-Fold (OOF) cross-validation were implemented to generate image difficulty scores $d = 1 - P(y_{\text{true}} \mid x)$.

During implementation and peer review, several critical architectural questions arose:
1. **Engine-Model Threshold Alignment:** How should difficulty scores be partitioned into `easy`, `medium`, and `hard` tiers such that metadata in `catalog.json` / `difficulty.json` remains strictly consistent with the `@radiology/engine` `bucketOf(difficulty, thresholds)` function?
2. **Catalog Bucket Diversity:** How must catalog subset extraction (`export_catalog.py`) allocate images per class to prevent starvation of `easy` or `medium` buckets when building the resident testing pool?
3. **Contract Schema Symmetry:** Resolving naming discrepancies across `catalog.json` (`class` vs `trueClass`, `imageId` vs `id`) and `@radiology/contracts` (`ImageMetaSchema`).
4. **Data Source Scalability:** Modular architecture allowing optional datasets (e.g. `actualmed`) to be plugged in without requiring modifications to backend or frontend code.

## Decisions

### 1. Unified Linear Difficulty Thresholds ($0.34$ and $0.68$)

We adopt the reference paper's linear difficulty partition as the global canonical standard:
- **Easy:** $d < 0.34$ ($P(y_{\text{true}} \mid x) > 0.66$)
- **Medium:** $0.34 \le d < 0.68$ ($0.32 < P(y_{\text{true}} \mid x) \le 0.66$)
- **Hard:** $d \ge 0.68$ ($P(y_{\text{true}} \mid x) \le 0.32$)

**Rationale:**
- **Zero Semantic Contradiction:** Guarantees that an image precomputed with `bucket: "easy"` always evaluates to `"easy"` when passed through `bucketOf(image.difficulty)` in `@radiology/engine`.
- **Clinical Meaning:** An image with $d = 0.001$ represents high-confidence true classification ($p = 99.9\%$), which is genuinely easy for visual models. Labeling it "hard" purely based on within-class ranking would violate diagnostic intuition.
- Hard and medium samples represent genuine borderline and diagnostic confusion cases (false positives, high-entropy distributions), making them valuable instructional items.

### 2. Catalog Diversity and Starvation Prevention

The catalog generation algorithm (`select_catalog_images`) must satisfy:
1. Cap of up to 500 images per disease class.
2. Prioritize inclusion of all available `hard` and `medium` borderline images.
3. If $N_{\text{hard}} + N_{\text{medium}} \le \text{cap}$, take all available hard and medium images, and fill the remaining quota with randomly sampled `easy` images (seeded).
4. If $N_{\text{hard}} + N_{\text{medium}} > \text{cap}$, allocate guaranteed minimum quotas across all three buckets (at least 25% easy, balanced hard/medium) to strictly prevent bucket starvation.

**Consequence for Our Catalog (1,177 images):**
- **Pneumonia (N=500):** 165 Hard, 134 Medium, 201 Easy.
- **Normal (N=500):** 42 Hard, 46 Medium, 412 Easy.
- **COVID-19 (N=177):** 3 Hard, 2 Medium, 172 Easy (all available scans included).
- **Zero Starvation:** Every bucket in every class contains testable questions, preventing pool depletion and engine shortfalls during baseline and adaptive quizzes.

### 3. Contract Schema Symmetry

To ensure complete backward and forward compatibility with `@radiology/contracts`:
- Both `catalog.json` and `difficulty.json` output both `id` and `imageId` fields with identical values (`{source}_{sha256[:12]}`).
- The label field is named `trueClass` across all artifacts and contracts, deprecating redundant alias keys.

### 4. Pluggable Data Ingestion Architecture

`ml/src/build_manifest.py` includes distinct, modular scanner functions (`scan_kermany`, `scan_cohen`, `scan_figure1`, `scan_actualmed`). Adding a new dataset requires only placing raw images in `data/raw/<source>` and re-running the pipeline; all downstream contracts remain unchanged.
