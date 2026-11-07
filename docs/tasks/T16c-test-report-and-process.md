# T16c - Test report, user guide, run guide and process report

- Branch: `docs/T16c-test-report-and-process`
- Depends on: T16a and T16b merged; T13 (real LLM data) and T14 (bug and security results) merged, otherwise the corresponding sections are marked PENDING and this task is re-opened later.
- Type: docs-only. English. Same HARD RULES as T16a.
- Estimate: 4 h.
- Read first: `docs/EVALUATION.md`, `docs/evaluation/*.json`, `docs/qa/*`, `docs/KNOWN-ISSUES.md`, README, `docs/DEMO-SCRIPT.md`, `docs/WORKFLOW.md`, `docs/PROGRESS.md`, ADRs.

## Output files in `docs/as-built/`
1. `03-TEST-REPORT.md`
   - Test strategy (unit, integration, property tests, leak tests, access matrix, scanners, simulation, evaluation, manual run, security verification).
   - Test inventory: run `npm test` now and report the real totals (files, tests, duration) and counts per workspace (api, web, engine, contracts). Do not reuse earlier numbers.
   - Quality gates: lint, build, audit (run `npm audit` and `npm audit --omit=dev` now; report counts by severity).
   - Traceability summary from `traceability.csv` (verified, no verification, gaps) and the list of gaps with a decision for each (add test / manual test / accepted).
   - Evaluation results E1-E4: copy the tables and numbers from `docs/EVALUATION.md` exactly with the commit sha; add NO interpretation (the interpretation section is written later by Mahdi and Claude).
   - Manual test run: summary of `docs/qa/manual-run-<date>.md`; security verification summary from `docs/qa/SECURITY-REPORT.md`; bug statistics from `docs/qa/BUG-LOG.md` (by severity and status).
   - Known issues (IDs from KNOWN-ISSUES.md) and residual risks.
2. `04-USER-GUIDE.md` - for residents and for the instructor: how to start (demo accounts are local-only), each screen and what it means (screens listed by route), the test flow, how to read the report (what FPR/FNR/matrix mean in plain words), targeted practice, progress, instructor review panel (keys A, R, J, K), catalog page, educational-use disclaimer. Describe only what exists. Use placeholders `[SCREENSHOT: <route>]` where Mahdi will add images outside git.
3. `05-RUN-GUIDE.md` - prerequisites (Node 24, MongoDB, Python 3.12 + uv for ML only), clean-clone setup step by step in PowerShell, environment variable NAMES with meaning (no values), seeding, running in `cache-only` and `live`, running tests, running evaluations, troubleshooting table from real failure modes (VPN, quota, Mongo not running, port in use). Verify every command by running it or mark it UNVERIFIED.
4. `06-PROCESS-REPORT.md`
   - Development model: iterative, task-driven, AI-assisted. Explain the real mechanism: task files with acceptance criteria (lightweight requirements), ADRs (design decisions), small Conventional Commits, PRs with merge gate, independent AI review in a fresh chat, human triage of findings (Blocker / Fix-small / Defer / Ignore). Include a flow diagram.
   - Timeline from the git history: first and last commit dates, number of commits and merged PRs (commands: `git log --reverse --format=%cs | Select-Object -First 1`, `git rev-list --count HEAD`, `git log --merges --oneline | Measure-Object`), one row per task (T00-T16c) with PR, dates and size (`git diff --shortstat` of the merge) where available.
   - Roles: the repository owner did all design, planning, review and testing; code was produced by an AI coding agent under that supervision (state this plainly). The single history sentence is in `docs/WORKFLOW.md` and may be quoted ONLY there or in the final thesis, not repeated here.
   - Quality practices and their evidence (tests-first for the engine, label-leak tests, access matrix, scanners, CI).
   - Risk register: from KNOWN-ISSUES plus delivery risks that actually occurred (quota-limited LLM data, confounded dataset, simulation showing no advantage) with mitigation and outcome.
   - Honest limitations and lessons learned (documents written after the code; agent summaries were wrong in several places and every number is now taken from files).
5. Update `docs/as-built/README.md` (index) and add a final "Document control" table: file, purpose, last updated sha.

## Steps (commit per file)
`docs(as-built): add test report`, `docs(as-built): add user guide`, `docs(as-built): add run guide`, `docs(as-built): add process report`, `docs(as-built): finalize index and document control`. Then `npm run lint`, `npm test`, `npm run build`, `/finish-task`.

## Acceptance criteria
1. Test totals in the report equal the output of `npm test` run during this task (paste the final lines in the PR body).
2. Evaluation numbers are identical to `docs/EVALUATION.md` (reviewer diff-checks 10 numbers).
3. Every command in the run guide is verified or explicitly marked UNVERIFIED (list in PR body).
4. Process report states AI-assisted development plainly and contains no second-person references.
5. All six documents are linked from `docs/as-built/README.md`.

## Out of scope
Persian versions, slides, thesis chapters, interpreting results, changing code.
