# Batch 3 notes (T08c, T09a, T09b, T09c, T10, T11)

Written 2026-11-06 by Claude for Mahdi (Solo Mode). Source: evidence-batch3.txt.

## 1. State at the start of batch 3
- Merged: T00-T08b (last = PR #13). Lint + RTL check pass. 69 test files / 520 tests pass.
- Web placeholders still open (router.jsx): /progress, /education (labelled T06), /instructor/residents, /instructor/catalog (labelled T08).
- Local DB: image analysis 0/40 done, question bank 0 questions, Gemini budget 0/16 used. => the REAL LLM data has not been generated yet. T09b (targeted practice), the demo and T10 all depend on it.
- docs/EVIDENCE.md does not exist (STATE.md refers to it). Deferred review findings are therefore not recorded anywhere in the repo. T11 creates docs/KNOWN-ISSUES.md; from now on every "Defer" decision gets one line there.
- Two cosmetic bugs seen in the evidence: `analysis:status` prints "Schema valid rate 100%" and "agreement 0.0%" when there are 0 items (should be N/A) -> fixed in T10. Console shows mojibake for non-ASCII characters on Windows -> fixed in T11.

## 2. Order and dependencies
T08c (runbook + start real LLM runs) -> T09a (demo seed + progress + residents) -> T09b (targeted practice) -> T10 (evaluation) -> T11 (hardening, docs, demo, release).
T09c (education + catalog pages) is OPTIONAL: do it only if you are at least one day ahead of the calendar. If skipped, T09c's fallback step removes the two placeholder routes so no "coming soon" screen is shown.
LLM quota is wall-clock time, not effort. So the LLM runs (T08c Part B) must start in the first days and run in parallel with coding.

## 3. Calendar (assumptions: today = Fri 2026-11-06, deadline about Fri 2026-11-27, 2 h/day)
| Dates | Work |
|---|---|
| Nov 6-7 | Apply this kit (docs PR). T08c Part A (runbook). Start daily LLM runs on Nov 7. |
| Nov 8-10 | T09a |
| Nov 11-15 | T09b |
| Nov 13 | DECISION GATE: is analysis finished and are there >= 24 approved questions? If not -> see section 5. |
| Nov 16-20 | T10 (code, then final numbers when data is complete) |
| Nov 20 | FEATURE FREEZE. After this: only fixes, docs, evaluation numbers. |
| Nov 21-25 | T11 + write the report/thesis |
| Nov 26 | Full rehearsal of the demo (offline, cache-only) |
| Nov 27 | Deadline (confirm the exact date with the professor) |

Honest warning: the estimate for T08c..T11 is about 30-34 focused hours; at 2 h/day there are only about 28 hours before the freeze. The written report is NOT in the roadmap and needs 8-10 hours. So either work 3 h/day or cut (section 4).

## 4. Cut order if late (first = cut first)
1. T09c (education + catalog pages) -> run only its Step 0 fallback (remove placeholders).
2. T10 question rubric: 24 questions -> 12 questions.
3. T09a demo-seed polish (keep the minimum: one demo resident with 3 finished sessions).
4. T10 E4 per-source extras (keep the table, drop the narrative).
Never cut: no-leak tests, T09b core, T10 honesty rules, T11 offline demo check, README quickstart.

## 5. Decision gate Nov 13 (if LLM data is behind)
Options: (a) enable Billing on the Gemini API project (AI Studio) -> the daily limit goes up. As far as I know, the Google AI Pro subscription is separate from API quota; check in AI Studio. Check the price page yourself before deciding. (b) Shrink the evaluation set and report the real n with confidence intervals. (c) Do nothing and show partial data honestly. Decide with Claude.
Do NOT use several accounts/keys to bypass the quota.

## 5b. Daily LLM routine (about 10 minutes, after the Pacific-day reset)
The reset is at midnight US Pacific. After the US clock change on 2026-11-01 that is about 11:30 Tehran time. Do not use the same API key in other tools while the runs are going.

## 6. Review focus per task (tell the reviewer chat)
- T08c: every claim in LLM-RUNBOOK.md has a source file; nothing calls Gemini in Part A.
- T09a: the demo seed refuses to run in production; synthetic data is clearly labelled; no duplicate metric logic.
- T09b: LABEL LEAKAGE and image authorization (most important), option shuffle correctness, no re-answering, ownership checks.
- T10: statistical honesty (confidence intervals, no significance claims, N/A on empty), reproducibility, no tuning, synthetic demo data excluded.
- T11: access matrix, secrets scan, fresh-clone install actually works, offline demo works.

## 7. How to apply this kit
```powershell
git checkout main
git pull
git checkout -b docs/batch3-task-files
# unzip kit-update-3.zip into the repo root (it only adds files under docs/tasks/)
git status
```
Then in a NEW agent chat paste:
```
Read AGENTS.md. Task: docs-only. I added docs/tasks/BATCH3-NOTES.md and task files T08c, T09a, T09b, T09c, T10, T11. Add one row per task to docs/PROGRESS.md in exactly the same format as the existing rows, status "todo". Do not change anything else. Commit as "docs: add batch 3 task files and board rows". Then /finish-task.
```
Review quickly, run `npm run lint` and `npm test` yourself, merge (merge commit, never squash).

## 8. Rules that apply to every task in this batch
Solo Mode (never impersonate B), JavaScript only, Windows/PowerShell, no Docker, no secrets in git or chat, no force push, no --no-verify, no direct push to main, small Conventional Commits, tests first for engine code, no label leakage to residents, reports data-driven (never tune parameters to make a result look good), merge commit never squash.
