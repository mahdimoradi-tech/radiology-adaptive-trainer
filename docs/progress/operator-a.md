# Operator A log (repo owner)

Name (as in git): Mahdi Moradi · GitHub: mahdimoradi-tech · Daily sync time: TBD

## Environment (no secrets)

OS/shell: Windows 11 / PowerShell 5.1 · Node/npm: v24.11.0 / 11.21.1 · MongoDB/mongosh: 8.3 / 2.13.0 · Python/uv: Python 3.11.0 (Python 3.12 + uv pending T01) · Antigravity skills/workflows visible: yes · paper.pdf: present

## Current task

- T01: ML pipeline: out-of-fold difficulty and app catalog (Driver solo, PR #3 in review)

## Done (newest first)

- Completed T01: implemented offline ML difficulty pipeline in `ml/` with Python 3.12 and `uv`.
- Scanned raw datasets (`kermany`, `cohen`, `figure1`), identified and eliminated 171 duplicates via SHA-256 hashes, producing 6,004 clean images.
- Implemented image preprocessing generating 768px web JPEGs and 224px ImageNet-normalized PyTorch tensors for model input.
- Extracted 1024-dimensional DenseNet-121 features on CPU with frozen ImageNet backbone, saving `data/interim/features.npy`.
- Implemented 3-class MLP head matching the reference paper and executed Stratified 5-Fold cross validation, achieving 95.24% Out-of-Fold accuracy (0.9315 macro F1).
- Computed difficulty scores ($d = 1 - P(y_{\text{true}} \mid x)$), quantile-based balanced tertile buckets (Easy/Medium/Hard with 33% each), and `confusedWith` classes.
- Exported web app catalog of 1,177 images (`catalog.json`), created 81.95 MB `catalog-images.zip`, and generated `ml/artifacts/difficulty.json` metadata for all 6,004 images.
- Wrote 14 unit tests in `ml/tests/` and comprehensive evaluation report in `ml/reports/ml-report.md`.
- Opened Pull Request #3 (`feat/T01-ml-pipeline`).

- Completed T02: implemented pure JS adaptive question selection engine (`@radiology/engine`), Zod schemas and contracts (`@radiology/contracts`), and virtual-resident Monte Carlo simulator.
- Implemented Hamilton-Hare largest-remainder allocation, Laplace smoothed FPR/FNR/error rates, seeded Mulberry32 PRNG, baseline and adaptive test generators, and targeted practice selection.
- Wrote 40 comprehensive tests covering unit arithmetic, hand-calculated manual examples, and property-based invariant testing with `fast-check` across $N \in [45, 120]$.
- Documented mathematical deviations from the paper in `docs/adr/0004-adaptive-engine-allocation.md` and package documentation in `packages/engine/README.md`.
- Initialized Git repository, main branch, and pushed to GitHub (`mahdimoradi-tech/radiology-adaptive-trainer`).
- Configured monorepo workspaces (`packages/*`, `apps/*`), ESLint flat config, Prettier, and Vitest.
- Created package skeletons for `@radiology/contracts` and `@radiology/engine` with smoke tests.
- Set up Husky 9 hooks: conventional commitlint (scoped), lint-staged, and branch protection hook (`no-push-main.js`).
- Created GitHub Actions CI workflow (MongoDB 8 service, Node 24, test/lint/build) and PR template.

## Decisions and why

- Temporary exception: solo mode (Date: 2026-10-24, Reason: Operator B is temporarily unavailable; Operator A switches to solo mode through at least T03 per `docs/SOLO-MODE.md` to keep project moving forward without stalling).
- Stack: Pure JavaScript ESM (no TypeScript) so both operators can fully understand and defend every line.
- Native Windows installation (no Docker) with local MongoDB service.
- Prevent pushes to `main` branch via pre-push hook to enforce PR review workflow.

## Things I must be able to explain at the defense

- How Out-of-Fold (OOF) 5-fold cross-validation guarantees zero data leakage: each image is evaluated solely by a model that never trained on it.
- Why the DenseNet-121 backbone was frozen: to preserve generic visual features and avoid overfitting to cross-dataset acquisition artifacts.
- Why quantile-based tertiles were chosen over paper linear thresholds: because high model accuracy (>95%) caused >93% of samples to collapse into the "easy" bucket under linear 0.34/0.68 thresholds.
- How binary image files (`catalog-images.zip`) are cleanly separated from version-controlled metadata (`difficulty.json`).
- Why Laplace smoothing ($\alpha = 1$) is mathematically required to prevent $0/0$ (`NaN`) in early training sessions.
- How the Largest Remainder (Hamilton-Hare) algorithm guarantees exact integer sum $N$ while maintaining class and bucket minimum shares.
- The differences between baseline test (40/30/30 bucket shares) and adaptive test allocation based on resident error patterns.
- What the virtual resident simulator proves (algorithmic convergence under modeled learning dynamics) and its limitations regarding human visual cognition.
- How the npm workspaces monorepo links `@radiology/contracts` to `@radiology/engine`.
- Why conventional commit enforcement and branch protection were put in place.
- Structure of the CI workflow and how MongoDB tests run in GitHub Actions.

## Open questions

- Daily sync schedule with Operator B (Abolfazl).
- Professor meeting agenda and delivery expectations.
