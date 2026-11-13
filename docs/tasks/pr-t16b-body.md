## Task

- **Task ID:** T16b
- **Branch:** docs/T16b-sdd

## Summary

### What
Authored the comprehensive, evidence-backed As-built Software Design Description (SDD) in `docs/as-built/02-SDD.md` (1,400 lines) aligned with IEEE 1016-2009 (tailored lite). The document covers:
1. **Introduction and Design Goals:** System scope, educational non-clinical boundary, linking all 91 SRS requirements, and mapping 5 core quality attributes (label-leak safety, offline demo, RTL Persian UI, testable pure engine, reproducible ML pipeline).
2. **Architecture Overview:** Monorepo package decomposition matrix (`packages/contracts`, `packages/engine`, `apps/api`, `apps/web`, `ml/`), tier component diagram, and verification of strict dependency rule via `git grep`.
3. **Technology Stack:** Verified versions table across runtimes, frameworks, and testing tooling from `package.json`, `ml/pyproject.toml`, and `ml/uv.lock`.
4. **Data Design:** Mermaid ER diagram and detailed schema/index specifications across all 12 MongoDB collections (`users`, `images`, `sessions`, `responses`, `practice_sets`, `llm_usage`, `llm_cache`, `analysis_batches`, `image_analyses`, `analysis_validations`, `question_bank`, `question_gen_attempts`).
5. **API Design:** Comprehensive 31-endpoint table with method, path, role, request/response schemas, and mapped FRs (100% parity with `docs/qa/ROUTE-INVENTORY.md`), standardized error format, and link to Postman collection.
6. **Core Algorithms:** Formulas, source locations, and test-based worked examples for 9 algorithms (`confusionMatrix`, `rates`, `classWeights`, `largestRemainder`, `allocateClassCounts`, `allocateBucketCounts`, `selectFirstTest`/`selectNextTest`, `selectTargetedQuestions`, `isMastered`, `wilsonInterval`, `cohenKappa`). Reconciled class-weight formula and documented ADR 0004 deviations.
7. **Session Lifecycle:** Session state machine (`in_progress` -> `finished`), concurrency guards, and sequence diagrams for baseline (Sequence A) and adaptive (Sequence B) training examinations.
8. **Security Design:** HTTP-only JWT cookies, dynamic role check, IDOR defense, opaque HMAC image tokens, label-leak sanitization, rate limits, and cross-reference to 26 criteria in `docs/qa/SECURITY-REPORT.md`.
9. **LLM Design:** Three-mode provider (`live`, `cache-only`, `fake`), 16 RPD daily quota guard in Pacific day, 13s inter-call throttle, closed vocabulary, 9-rule dual-run consistency engine ($A \cap B$), pre-validation checks, instructor review triage, and end-to-end data-flow diagram.
10. **Offline ML Pipeline Design:** DenseNet-121 feature extraction, stratified 5-fold cross-validation, difficulty scoring ($d = 1 - p$), 500-image catalog quota policy, and honest disclosure of the 100% pediatric vs adult dataset confounder.
11. **Frontend Design:** 19-screen route map and guards, TanStack Query cache topology, RTL Persian logical layout, un-mirrored radiograph protection (`XrayImage`), and keyboard examination shortcuts.
12. **Deployment and Runtime View:** Local Windows 11 host processes, filesystem asset folders, and exhaustive environment variables reference table.
13. **Design Decisions & Trade-Offs:** Comprehensive matrix cross-referencing ADR 0001 through ADR 0014 with decisions, alternatives considered, and architectural consequences.
14. **Requirements Traceability Matrix:** Bidirectional mapping connecting all 18 architectural subsystems to the 91 SRS requirements (`01-SRS.md`).
15. **Index Update:** Updated reading order and descriptions in `docs/as-built/README.md`.

### Why
To provide an evidence-backed, retrospective architectural reference for the entire platform for academic evaluation and capstone defense, ensuring every technical claim is verifiable against working code, test suites, and ADRs.

## How to Test

```powershell
npm run lint
npm test
npm run build
git grep -n -i -E "team-workflow|two-person" -- docs/as-built
git grep -n "from '@radiology" packages
```

## Contract Changes

- **Contract changed?** [ ] Yes / [x] No

## Dependencies Added

| Package | Version | Why Needed |
|---|---|---|
| *None* | - | Documentation-only task |

## Review & Architecture Notes

### 1. Route Parity Verification
- Number of endpoints in Section 5: **31**
- Number of endpoints in `docs/qa/ROUTE-INVENTORY.md`: **31**
- Parity: **100% exact match** (Public: 4, Shared Authenticated: 2, Resident: 13, Instructor: 12).

### 2. Document vs. Code Conflicts and Resolutions
- **Class-Weight Formula:**
  - *Conflict:* Early project notes referenced unnormalized heuristic scaling ($W_i = \text{base} + \lambda \cdot \text{error}_i$).
  - *Code Implementation:* `packages/engine/src/rates.js:81-100` implements the strictly normalized error proportion $w_c = \text{error}_c / \sum \text{error}_k$ (yielding uniform $1/|\mathcal{C}|$ if total error is zero).
  - *Resolution:* Documented strictly according to the actual code implementation in Section 6.1.3, noting the ADR 0004 design rationale that normalizes weights to guarantee $\sum w_c = 1.0$.
- **Test Length Range:**
  - *Conflict:* Some early notes referenced $N=45$ fixed test sizes.
  - *Code Implementation:* Default test length is $N=60$ questions (20 per class, 8/6/6 difficulty bucket distribution), configurable to sizes 45, 60, 90, 120, with $N \ge 45$ enforced as a design floor.
  - *Resolution:* Documented the $N=60$ runtime default and $N \ge 45$ minimum floor in full alignment with T16a SRS.

### 3. Unknowns and Unsourced Items
- **UNKNOWN list:** **0 items**. Every metric (e.g. 6,004 merged images, 1,177 catalog subset, 95.24% OOF accuracy, 69 consensus images, 83 approved questions) and library version is backed by source code, lockfiles, or reproducible evaluation artifacts.

## Screenshots (UI tasks only)
N/A (Documentation task).

## Checklist

- [x] `npm run lint` passes
- [x] `npm test` passes (789/789 tests pass across 96 files)
- [x] `npm run build` passes (417ms)
- [x] `docs/PROGRESS.md` board row updated (`in-review`)
- [x] Developer log updated in `docs/progress/developer-log.md`
- [x] No secrets (`.env`), datasets, images, or large binary files committed
- [x] Commit history follows Conventional Commits (7 commits on branch)
