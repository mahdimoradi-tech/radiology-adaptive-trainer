# ADR 0008 — Opaque Public IDs and Label Leakage Prevention

Status: accepted (2026-10-31, Operator A)

## Context
In our multi-source dataset merger (T01), internal image identifiers carry dataset prefixes (e.g. `cohen_100_1`, `figure1_covid_42`, `kermany_f9ddce356c7b`). Because the Cohen and Figure1 datasets exclusively contain COVID-19 X-rays, any exposure of internal IDs or metadata directly reveals the true disease label to trainees.

## Decisions

### 1. Deterministic Opaque Public Identifiers
- **Calculation:** `publicId = HMAC-SHA256(PUBLIC_ID_SALT, internalId).slice(0, 20)`.
- **Properties:**
  - **Opaque:** A 20-character hexadecimal string with zero semantic meaning or dataset clues.
  - **Deterministic:** Re-seeding with the same salt generates identical public IDs without requiring migration.
  - **Irreversible:** Without knowledge of `PUBLIC_ID_SALT`, the internal ID cannot be recovered.

### 2. Resident vs Instructor Visibility Boundaries
- **Resident Panel:** During active training, residents are presented solely with `publicId` and the image URL `/api/images/:publicId/file`.
- **Prohibited Fields:** While an exercise is ongoing, no resident-facing endpoint may return `id`, `filename`, `source`, `trueClass`, `bucket`, `difficulty`, or `confusedWith`.
- **Instructor Panel:** Instructors have full administrative access via `/api/catalog/stats` and `/api/catalog/images`, receiving complete clinical metadata along with `publicId` and `url`.

### 3. Image File Serving Safeguards
- **Endpoint:** `GET /api/images/:publicId/file`.
- **Headers:** `Cache-Control: private, max-age=86400`.
- **Filename Redaction:** The original filename is never exposed in `Content-Disposition`, `X-Filename`, or custom headers.
- **Path Traversal Protection:** Image filenames stored in the database are validated against `^[A-Za-z0-9_.-]+\.jpe?g$` and served with `dotfiles: 'deny'` rooted at `CATALOG_IMAGE_DIR`.

### 4. Visual Content Caveat (Acknowledged Confound)
- As noted in ADR 0006 and the ML evaluation report, certain raw X-ray images contain acquisition artifacts, patient age indicators (pediatric vs adult), or hospital annotations that could hint at the dataset source. While the API guarantees programmatic non-leakage, visual artifacts remain an intrinsic dataset characteristic that is documented and defended in the thesis.

## Consequences
- Automated leak tests verify that resident queries cannot access internal identifiers, passwords, or diagnostic labels prior to evaluation.
- Dataset source confounding cannot be exploited through API inspection.
