# T16a - As-built SRS and traceability matrix

- Branch: `docs/T16a-srs`
- Depends on: T12 merged. (T14 results are linked later in T16c.)
- Type: docs-only. English. Agent extracts facts; Mahdi reviews; Claude reviews accuracy.
- Estimate: 3-4 h.
- Skills to read first: review-workflow. Read: all `docs/tasks/T00..T11*.md` (acceptance criteria), ADRs, `docs/DOMAIN.md`, `docs/KNOWN-ISSUES.md`, `packages/contracts/src`, `apps/api/src/modules`, `apps/web/src/pages`.

## Why this document is "as-built"
The system was built first, with requirements captured during development in task files (acceptance criteria) and ADRs (decisions). This SRS is a retrospective baseline: it states what the finished system does, derived from those sources and from the code and tests. It must say so in its first page and must NOT pretend that it was written before the implementation, or invent dates.

## Hard rules for ALL T16 documents
1. Every statement of fact carries a source: `path:line`, a test name, or a command with its output. If you cannot source it, write `UNKNOWN` and list it in the PR body.
2. Never copy numbers from chat summaries or earlier agent reports. Numbers come from files (`docs/EVALUATION.md`, `docs/evaluation/*.json`) or from commands you ran now.
3. Do not describe planned or desired behaviour as implemented. If a requirement is partial or missing, say so (status column).
4. Language: English (fact base). Mahdi and Claude produce the Persian thesis from it later.
5. Diagrams: Mermaid in fenced blocks, simple syntax only (flowchart, sequenceDiagram, erDiagram, classDiagram).
6. No mention of any second team member. The only history sentence lives in `docs/WORKFLOW.md`.

## Output files (folder `docs/as-built/`)
1. `README.md` - index, document status banner ("As-built (retrospective). Baselined on commit <short sha> on <date from `git log -1 --format=%cs`>"), reading order, glossary link.
2. `01-SRS.md` - structure (ISO/IEC/IEEE 29148 lite):
   - 1 Introduction: purpose, scope (educational use only, never diagnosis), definitions (FP, FN, FPR, FNR, bucket, mastery, confusion pair, label leakage, closed vocabulary, `cache-only`), references (paper: Kianmehr & Hashemzadeh, J. ICT Iran 2025, `docs/reference`), overview.
   - 2 Overall description: product perspective (diagram: users, web app, API, MongoDB, offline ML artifacts, Gemini), user classes (resident, instructor) and what each can do, operating environment (Windows, Node 24, local MongoDB, no Docker), design constraints (JavaScript only, no label leakage, offline demo), assumptions (ADR 0006), dependencies (Gemini quota).
   - 3 Functional requirements, grouped: Auth (FR-AUTH-nn), Baseline test (FR-TEST-nn), Adaptive session (FR-ADAPT-nn), Report (FR-REP-nn), Targeted practice (FR-PRAC-nn), Progress and mastery (FR-PROG-nn), Education (FR-EDU-nn), Instructor panel (FR-INS-nn), LLM features (FR-LLM-nn), Catalog and data (FR-DATA-nn). Each requirement: ID, statement ("The system shall ..."), priority (Must/Should/Could), source (task id and acceptance-criterion number, or ADR), verification (test file or manual test id M-nn from `docs/qa/MANUAL-TEST-PLAN.md`), status (Implemented / Partial / Not implemented / Deferred).
   - 4 Non-functional requirements (NFR-SEC, NFR-PRIV, NFR-USAB, NFR-PORT, NFR-REL, NFR-MAINT, NFR-PERF), each with a measurable statement and its evidence (for example: label-leak tests, RTL scanner, offline `cache-only`, fresh-clone install time from `docs/tasks/pr-t11-body.md`, bundle size from KNOWN-ISSUES ISS-06). Mark performance targets that were never specified as `UNSPECIFIED`.
   - 5 External interfaces: user interface (screens list with routes), API (link to `docs/postman`), Gemini API, MongoDB.
   - 6 Data requirements: entities and key fields (from `apps/api/src/modules/*/model*.js` and `packages/contracts`).
   - 7 Use cases: table UC-01..UC-nn (actor, goal, main flow in 4-8 steps, alternative flows, requirements covered). Minimum: register/login, take baseline test, view report, take adaptive test, targeted practice, view progress, review generated question, view resident detail, view catalog.
   - 8 Known limitations (copy IDs from KNOWN-ISSUES.md with links, do not rephrase facts).
3. `traceability.csv` - columns `req_id,requirement,priority,task,adr,code_ref,test_ref,manual_test,status`. One row per requirement from SRS sections 3 and 4.
4. `GLOSSARY.md` - from `docs/DOMAIN.md` plus terms above.

## Steps (one commit per file)
Step 1 - Inventory (no commit): list every task file's acceptance criteria into a scratch table in your reply (not committed). Count them in the PR body.
Step 2 - Write `docs/as-built/README.md` and `GLOSSARY.md`. Commit: `docs(as-built): add index and glossary`.
Step 3 - Write sections 1-2 of the SRS. Commit: `docs(as-built): add SRS introduction and overall description`.
Step 4 - Write section 3 (functional requirements) module by module, one commit per 2-3 modules: `docs(as-built): add SRS functional requirements (<modules>)`. Derive each requirement from the acceptance criteria of the task that built it and verify against code; if the code does something the tasks never specified, add it with source `code` and flag it.
Step 5 - Write sections 4-8. Commit: `docs(as-built): add SRS non-functional requirements and use cases`.
Step 6 - Build `traceability.csv` from the requirements. Then run a gap check and write the result at the end of the SRS under "Traceability gaps": requirements with no test and no manual test; tests (by file name) that map to no requirement. Commit: `docs(as-built): add traceability matrix and gap list`.
Step 7 - `npm run lint`, `npm test`, `npm run build` (docs only; must still pass). `/finish-task`.

## Verification
```powershell
git diff --stat main
git grep -n -i -E "team-workflow|two-person" -- docs/as-built
(Import-Csv docs\as-built\traceability.csv | Measure-Object).Count
Import-Csv docs\as-built\traceability.csv | Where-Object { -not $_.test_ref -and -not $_.manual_test } | Measure-Object | Select-Object Count
```
Expected: only `docs/as-built/` files changed; second command prints nothing; third prints the number of requirements (at least 60 is expected; if fewer, explain); fourth prints how many have no verification (must equal the gap list size).

## Acceptance criteria
1. The first page of `01-SRS.md` states that it is an as-built, retrospective document and the baseline commit.
2. Every requirement has all columns filled (UNKNOWN allowed, never blank) and status.
3. Every acceptance criterion of T03-T11 maps to at least one requirement (the PR body lists the count mapped vs total).
4. Gap list present and consistent with the CSV.
5. No unsourced number or claim (reviewer spot-checks 10 random statements against the cited source).

## Out of scope
Design details (T16b), test results (T16c), Persian translation, changing code or tests, writing new requirements for features that do not exist.
