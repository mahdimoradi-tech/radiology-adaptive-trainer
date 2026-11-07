# T16b - As-built design document (SDD)

- Branch: `docs/T16b-sdd`
- Depends on: T16a merged (requirement IDs exist).
- Type: docs-only. English. Same HARD RULES as T16a (sources for every fact, no numbers from summaries, UNKNOWN when unsure, Mermaid simple, no second-person history).
- Estimate: 3-4 h.
- Read first: ADRs 0001-0014, `packages/contracts/src`, `packages/engine/src`, `apps/api/src`, `apps/web/src`, `ml/`, `docs/postman`, `docs/LLM-RUNBOOK.md`, `docs/as-built/01-SRS.md`.

## Output: `docs/as-built/02-SDD.md` (sections)
1. Introduction and design goals (link SRS requirement ranges; list the 5 main quality attributes with where each is achieved: label-leak safety, offline demo, RTL Persian UI, testable pure engine, reproducible ML pipeline).
2. Architecture overview: monorepo layout (table: folder -> purpose -> main dependencies -> depends on which other package), component diagram, dependency rule (contracts <- engine/api/web; engine has no network/DB). Verify the rule with `git grep -n "from '@radiology" packages` and state the result.
3. Technology stack with the versions that are in `package.json` files (read them; do not use versions from memory).
4. Data design: ER diagram (`erDiagram`) from the Mongoose models; per collection: purpose, key fields, indexes (read from the schema), relationships. Include `llm_usage`, `llm_cache`, `analysis_*`, `question_bank`, `question_gen_attempts`.
5. API design: table of ALL endpoints (method, path, auth/role, request schema, response schema, FR ids) generated from `docs/qa/ROUTE-INVENTORY.md` (if T14 is not merged yet, build it from the routes files yourself) and `packages/contracts`. Error format and status codes used (read the error handler). Link to the Postman collection.
6. Core algorithms (each with a formula, the function name, source file:line, and one worked example taken from an existing test): confusion matrix, rates (FPR/FNR/error), class weights (read the code: `classWeights` in `packages/engine/src/rates.js` is `error / totalError`; any other formula you find in docs must be reconciled and the conflict listed), largest remainder allocation, bucket allocation, first/next test selection, targeted question selection, mastery rule (threshold from code), Wilson interval and Cohen's kappa (stats). State the ADR 0004 deviations (smoothing, normalised allocation, N>=45 is a design floor).
7. Session lifecycle: sequence diagrams for (a) baseline test (start -> answer x45 -> finish -> report) and (b) adaptive test; include state machine of a session (read ADR 0010).
8. Security design: authentication (cookie flags, JWT, HS256), authorization (`requireRole`, `canViewImage`), opaque public IDs (ADR 0008), label-leak sanitisation, rate limits, validation (Zod), Helmet, environment validation. Cross-reference `docs/qa/SECURITY-REPORT.md` if it exists.
9. LLM design: three modes (`live`, `cache-only`, `fake`), provider abstraction, prompt templates and versions, closed vocabulary, double analysis and consensus rule (9 validation rules; list them from code), question generation and instructor review states, quota guard (5 RPM, 20 RPD, guard 16 per Pacific day, throttle 13 s), cache design and portable seed. Add a data-flow diagram for "analysis -> validation -> question -> review -> approved bank -> resident".
10. ML pipeline design (offline): datasets and counts (from `docs/DATA-SOURCES.md` and `docs/evaluation/ml.json`), 5-fold out-of-fold prediction with frozen DenseNet-121 + small head, difficulty d = 1 - p(true), buckets 0.34/0.68, catalog policy (<= 500 per class), artifacts. State the confounder honestly.
11. Frontend design: route map with guards (resident `/app/*`, instructor `/instructor/*`), state management (TanStack Query keys and cache invalidation), i18n and RTL approach, quiz keyboard handling, error and loading conventions.
12. Deployment and runtime view: local workstation setup, processes (API, web dev server), data folders, environment variables (NAMES and meaning only; never values).
13. Design decisions and trade-offs: table linking ADR 0001-0014 (decision, alternative considered, consequence).
14. Traceability: table design element -> SRS requirement ids.

## Steps (commit per section group)
1. Sections 1-3 and 12: `docs(as-built): add SDD overview, stack and runtime view`.
2. Sections 4-5: `docs(as-built): add SDD data and API design`.
3. Sections 6-7: `docs(as-built): add SDD algorithms and session lifecycle`.
4. Sections 8-9: `docs(as-built): add SDD security and LLM design`.
5. Sections 10-11, 13-14: `docs(as-built): add SDD ML, frontend and decisions`.
6. Update `docs/as-built/README.md` index. Commit: `docs(as-built): update index for SDD`.
7. `npm run lint`, `npm test`, `npm run build`. `/finish-task`.

## Verification
```powershell
git diff --stat main
git grep -n -i -E "team-workflow|two-person" -- docs/as-built
git grep -n "from '@radiology" packages
```
Also in the PR body: the number of endpoints in section 5 versus the number in the route inventory (must be equal) and every conflict found between documents and code (for example the class-weight formula) with the resolution.

## Acceptance criteria
1. Endpoint table covers 100% of routes (count equal to the inventory).
2. Every algorithm has formula + source:line + test-based example; class weights match the code.
3. All Mermaid blocks are syntactically simple (reviewer renders at least 3 in a Mermaid previewer).
4. No unsourced version number or metric; UNKNOWN list in the PR body.
5. Section 14 maps every SDD component to at least one SRS requirement.

## Out of scope
Changing code to match the document (document the code as it is, report conflicts), UML tooling, Persian text.
