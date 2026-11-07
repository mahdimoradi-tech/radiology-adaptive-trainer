# ADR 0013: Offline Multimodal Image Analysis Pipeline and Batching Architecture

- **Status:** Accepted
- **Date:** 2026-11-05
- **Developer:** Mahdi Moradi
- **Review:** AI Review per `docs/WORKFLOW.md`
- **Context Task:** T08a (Image Analysis Pipeline)

---

## 1. Context and Problem Statement

The curriculum requires closed-vocabulary visual language model (VLM) image analysis of chest radiographs using Google Gemini (`gemini-3.8-flash`) to detect radiographic patterns, distribution, and laterality without clinical diagnosis. The validated findings feed automatic question generation (T08b) and zero-shot VLM evaluation against DenseNet-121 (T10).

However, the free-tier Gemini API operates under severe rate and quota constraints:
- **Daily Budget:** 20 requests per calendar day (resetting midnight `America/Los_Angeles`), with a safe production budget cap of 16 requests/day to leave head-room for development and emergency runs.
- **Rate Limit:** 5 requests per minute, 250,000 tokens per minute.

The original skill specification assumed processing ~600 images individually twice (1,200 API calls), which would require 60 to 75 calendar days under a 16-request daily budget.

---

## 2. Decision Summary

### 2.1 Quota Math & Multi-Image Batching
- **Batch Size:** Each Gemini request carries exactly **6 images** as interleaved multimodal parts:
  `[ { text: 'Image 1:' }, { image: b64 }, { text: 'Image 2:' }, ..., { text: instructions } ]`.
- **Target Analysis Set:** Fixed stratified set of **120 catalog images** (40 per class).
- **Request Calculation:** 120 images / 6 per batch = 20 batches per run. Running two independent prompts (Run A and Run B) requires 40 API requests total (~2.5 quota days at 16 requests/day).
- **Token Usage:** 6 images plus system instructions consume ~10,000 to 15,000 tokens per request, well below the 250k tokens/minute limit.

### 2.2 Stratified Set Composition & Over-sampling
- **covid19 (40 images):** All available medium ($n=3$) and hard ($n=2$) images are sampled to maximize pedagogical difficulty diversity, with the remaining 35 easy images allocated proportionally between datasets (`cohen` and `figure1`) via largest-remainder (Hamilton-Hare) allocation.
- **pneumonia (40 images):** 14 hard + 13 medium + 13 easy.
- **normal (40 images):** 14 hard + 13 medium + 13 easy.
- **Determinism:** Selection is completely deterministic using seeded PRNG (`analysis-v1`) in `sampling.js` and persisted to version-controlled `apps/api/seed/analysis-set.json`.

### 2.3 Mixed-Class Batches & Order Decoupling
- To prevent the model from inferring image classes from batch homogeneity, the 120-image set is shuffled across all classes prior to slicing into groups of 6. Every batch contains a mixture of disease classes.
- **Run B Order Inversion:** For Run B of group $g$, the 6 images are reversed and rotated left by one position (`[e, d, c, b, a, f]`). This guarantees that position index does not correlate between runs while evaluating the exact same images under an alternative prompt framing.

### 2.4 Multimodal Input & Privacy Purity
- **Original JPEG Bytes:** Images are read as raw JPEG bytes from disk and base64-encoded inline. No resizing dependencies or preprocessing filters are applied. Files larger than 4 MB are safely skipped.
- **Zero Label/Metadata Leakage:** The prompt text and system instructions contain ONLY the closed vocabulary and schema definition. No dataset label (`covid19`, `pneumonia`, `normal`), source name (`cohen`, `figure1`, `kermany`), image filename, or database `_id` is ever passed to the LLM.

### 2.5 Strict Auto-Validation & Impact on Hard Images
- `validateAnalysis({ runA, runB, datasetLabel })` enforces 9 strict rules. An image is marked `auto_passed` ONLY if:
  1. Both runs succeed and pass schema validation.
  2. Both runs report `imageQuality: 'ok'`.
  3. `runA.predictedClass === runB.predictedClass`.
  4. `runA.predictedClass === datasetLabel` (strict ground-truth agreement).
  5. Pattern rules: `clear_lungs` is mutually exclusive with opacities; normal lungs require `['clear_lungs']`; diseases require at least one non-clear pattern; and the intersection of patterns $A \cap B$ is non-empty.
- **Consequence for Hard Images:** By definition, high-difficulty images ($d \ge 0.68$) were misclassified by the out-of-fold DenseNet-121 classifier. Strict label agreement will likely cause the VLM to also fail on many hard images, leading to a high `auto_rejected` rate for hard cases. This is scientifically documented as an expected finding for zero-shot evaluation (T10), not a software bug.

### 2.6 Burned-in Text Caveat
- Several public dataset radiographs (notably from the Cohen COVID-19 repository) contain visible annotations or clinical letter markings (e.g., portable markers, radiology department stamps) burned into the pixel data.
- It is acknowledged that multi-modal models may leverage these visual artifacts as subtle shortcuts. In accordance with thesis constraints, no bounding-box cropping is applied; this caveat is explicitly documented for the academic defense.

### 2.7 Resumability and Pipeline Tooling
- Batches are planned in advance in `analysis_batches` with deterministic IDs (`v1-g07-A`).
- `analysis:run` operates idempotently: finished batches are never re-executed. Interrupted runs resume cleanly from the next pending or failed batch.
- On HTTP 429 quota exhaustion, the daily circuit breaker trips and the runner exits with code 0 (`BUDGET_EXHAUSTED`).

---

## 3. Consequences

### Positive
- Feasible execution of multimodal VLM analysis within 3 calendar days of free-tier API quota.
- Complete reproducibility via committed `seed/analysis-set.json` and portable export `seed/image-analyses.json`.
- Strict consensus derivation ($A \cap B$) guarantees high-fidelity pattern labels for downstream question generation (T08b).

### Negative / Trade-offs
- A batch size of 6 introduces potential cross-image context influence in the LLM's attention layers (mitigated by mixed classes, Run B rotation, and independent position checks).
- Rejection of discordant or misclassified hard images limits the pool of high-difficulty images available for automated question generation.

---

## 4. Addendum (T08b): Question Bank Generation, Tied-Keys Validation, and Review Panel

- **Context Task:** T08b (Question Generation and Review Panel)
- **Status:** Accepted (2026-11-05)

### 4.1 Input and Prompt Architecture
- Model input is strictly **TEXT ONLY**: validated consensus findings (patterns, distribution, laterality, zones), trueClass, confusedWith, bucket, and 1-3 KB snippets for the confusion pair. No images are sent to the LLM during question generation.
- **Batching:** Up to 8 images per request (`--batch-size 8`), sending shared KB snippets once per pair.
- **Idempotency:** `stableId = sha1(imageId + type + promptVersion + slot)`. The generator checks existing stable IDs and skips previously generated items, ensuring zero cost and zero duplication on repeat runs.

### 4.2 Question Types and Tied-Keys Design
- **`finding`:** Generated for all validated images. Options have `key` tied to closed vocabulary (`PATTERN_VALUES`). Exactly one option key matches the image's consensus patterns ($A \cap B$), exactly three option keys are chosen from non-consensus distractors, and `correctIndex` points to the consensus option.
- **`distribution`:** Generated if consensus distribution is non-null/non-none and disease class. Options have `key` tied to `DISTRIBUTION_VALUES`. Exactly one option key matches consensus distribution, and three keys are non-matching distractors.
- **`differential`:** Generated if distribution is not applicable, capped per ordered pair (`--max-differential-per-pair 4`). Options have `key: null`; `kbRef` is linked directly to a verified KB slug.

### 4.3 Strict Content Integrity Rules
- **No Digits:** Rejects any ASCII 0-9 or Arabic/Persian digits (۰-۹, ٠-٩).
- **No Percentages:** Rejects % or ٪ symbols.
- **Zero Label Leakage in Stems:** Finding and distribution stems must not contain disease names (covid, pneumonia, normal, کووید، ذات‌الریه).
- **Persian Script Purity:** At least 60% Persian characters across stem and each option text.
- **4 Unique Options:** Normalized for diacritics, vowels, and whitespace.
- **Concise Rationale:** Rationale capped at 300 characters.
- **Rejection Logging:** Rejected candidates are saved in `question_gen_attempts` for T10 evaluation metrics.

### 4.4 Status Flow and Review Panel
- **Status Transitions:** New items are strictly `pending_review` (never automatically `approved`).
- Approve from `pending_review` or `rejected` -> `approved`.
- Reject from `pending_review` or `approved` -> `rejected`.
- Edit re-validates the candidate, records before/after diffs in `history[]`, sets `edited: true`, and resets status to `pending_review`.
- **No Bulk Actions:** Every question requires individual human inspection.
- **Keyboard Shortcuts:** `A` (approve), `R` (reject), `J` (next), `K` (previous) for rapid reviewer flow.

### 4.5 Academic Limitation: Non-Clinical Reviewer
- Because the reviewer is the developer (a computer science undergraduate, not a licensed radiologist or clinician), questions are approved solely based on alignment with ground-truth catalog labels, consensus VLM pattern agreement, and verified KB texts.
- All approved items carry the honest labeling marker «بازبینی توسط مدرس (غیر بالینی)» in the UI and database metadata. This is formally documented as a study limitation for the thesis defense.
