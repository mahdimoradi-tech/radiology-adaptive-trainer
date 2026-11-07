# T14 - Bug hunt and security verification

- Branch: `chore/T14-qa-security` (reports + regression tests only). Fixes go to separate branches `fix/BUG-nnn-name`.
- Depends on: T12 merged (clean docs). T13 should be at least on day 3 so that cached LLM content exists for the manual run.
- Type: Part A = manual browser run by Mahdi. Part B = verification by the agent (read-only audit + new regression tests). Part C = triage with Claude and small fixes.
- Estimate: Part A 2.5 h (two sessions). Part B 3-4 h. Part C depends on findings.
- Skills to read first: api-conventions, review-workflow. Files: `docs/qa/MANUAL-TEST-PLAN.md`, `docs/qa/SECURITY-CHECKLIST.md`, `docs/qa/BUG-LOG.md`, `docs/adr/0007`, `0008`, `0010`, `0012`.

## Goal
Find real bugs and security weaknesses of the finished system with evidence, classify them, and fix the Blockers and Majors before the release tag. The freeze stays: no new features.

## Context (verified facts, do not re-discover)
- Already visible in code: cookie `httpOnly`, `sameSite: 'lax'`, `secure` in production (`apps/api/src/modules/auth/service.js`, `controller.js`); JWT algorithm pinned to HS256 and `JWT_SECRET` min 32 chars (`requireAuth.js`, `config/env.js`); rate limiters in `modules/auth/routes.js` and `modules/llm/routes.js`; no `cors(` call found by grep (confirm how cross-origin is handled); no `stack` text found in `src` (confirm the error handler).
- T11 added an access-matrix test over 31 endpoints and `global-leak.test.js`. Do not duplicate them; check what they miss.
- `npm audit --omit=dev` was reported clean by the previous agent summary; that summary is NOT evidence. Re-run it.

## Part A - manual run (Mahdi)
1. Copy `docs/qa/MANUAL-TEST-PLAN.md` rows into `docs/qa/manual-run-<date>.md` and fill PASS/FAIL/SKIP for M01-M38.
2. Every FAIL becomes a row in `docs/qa/BUG-LOG.md` (title, steps, expected, actual; screenshots stay OUTSIDE the repo, they contain dataset radiographs).
3. Stop at the first Blocker and tell Claude.

## Part B - security verification (agent). HARD RULES: do not change application code in this branch; do not call Gemini; do not open or print `.env`.
Step 1 - Read. List every route (method + path + middleware) by reading `apps/api/src/app.js` and `modules/*/routes.js`. Save the table as `docs/qa/ROUTE-INVENTORY.md`. Commit: `docs(qa): add API route inventory`.
Step 2 - For each item S01-S26 in `docs/qa/SECURITY-CHECKLIST.md` decide PASS / FAIL / PARTIAL / N/A / NOT-TESTED with evidence you ran yourself (test name or command + output summary). Create `docs/qa/SECURITY-REPORT.md` with one row per item plus a short summary (counts per result). Commit: `docs(qa): add security verification report`.
Step 3 - Regression tests. For every item that PASSES and is not already covered by an existing test, add a test under `apps/api/src/__tests__/security/` (one file per area: auth, authz, input, headers, lifecycle). Rules: tests only for behaviour that currently passes (they protect it); do NOT add failing tests and do NOT use `it.skip` for failures: failures go to the bug log with a reproduction command. Test first-run output must be green. Commit per file: `test(api): add <area> security regression tests`.
Step 4 - Findings. For each FAIL/PARTIAL add a row in `docs/qa/BUG-LOG.md` (tag `security`) with a reproduction command and a proposed severity. Do not fix anything here. Commit: `docs(qa): log security findings`.
Step 5 - `npm run lint`, `npm test`, `npm run build`. `/finish-task`. PR body: counts of PASS/FAIL/PARTIAL/NOT-TESTED and the list of findings with proposed severity.

## Part C - triage and fixes
1. Mahdi brings `BUG-LOG.md` (new rows only) to Claude. Claude assigns Blocker / Major / Minor / Defer / Ignore and writes one correction prompt per bug to fix.
2. Fix order: Blocker -> Major. One branch and PR per bug: `fix/BUG-nnn-name`, commit `fix(<area>): <what> (BUG-nnn)`, plus a regression test that fails before the fix. Mahdi runs `npm test` himself before merging.
3. After every Blocker/Major fix re-run the matching manual tests (M-ids in the log row).
4. Update the bug log status. Minor items are deferred unless the change is a few lines.

## Acceptance criteria
1. `docs/qa/manual-run-<date>.md` exists with all M01-M38 marked.
2. `docs/qa/ROUTE-INVENTORY.md` lists every route; `docs/qa/SECURITY-REPORT.md` has a result with evidence for all 26 items.
3. No application code changed in the `chore/T14-qa-security` branch: `git diff --name-only main` lists only files under `docs/` and `apps/api/src/__tests__/security/`.
4. Every FAIL/PARTIAL is in the bug log with severity and reproduction.
5. At the end of Part C there are zero open Blockers and zero open Majors (or each remaining one has a written reason and Claude's agreement).
6. `npm run lint`, `npm test`, `npm run build` pass.

## Out of scope
New features, refactors, dependency upgrades (unless a vulnerability fix needs one: then a separate `fix/` PR), UI spacing/colour issues (T15), penetration tools or scanners that need installation, any attack against systems other than the local app.
