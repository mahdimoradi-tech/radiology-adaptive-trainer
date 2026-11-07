# Batch 4 notes (T12-T16c)

Written 2026-11-07 after all of T00-T11 were merged (main at c546152, PR #21). Feature freeze is in effect: only polish, bug fixing, security, documentation and demo preparation.

## Verified facts (from the repository and command output, not from agent summaries)
| Fact | Source |
|---|---|
| 196 commits, all by Mahdi Moradi; tag `v0.0.1` only (no `v1.0.0`) | `git shortlog -sn --all`, `git tag` |
| PR #21 (T11) merged, but `docs/PROGRESS.md` still says `in-review` | `git log`, PROGRESS.md |
| `apps/api/seed/image-analyses.json` = `[]`; `question-bank.approved.json` = `[]`; portable cache has only a few explanations | seed folder |
| `analysis:status`: 40 batches, 0 done; Gemini budget used 0/16 (Pacific day 2026-11-07) | command output pasted by Mahdi |
| E2 (image analysis) N=0 and E3 (question bank) N=0 in `docs/EVALUATION.md` | EVALUATION.md |
| E1: ADAPTIVE / RANDOM / FIXED all reach 100% mastery (Wilson 92.9-100%); mean sessions 4.50 / 4.60 / 4.64 (SD about 1.4); n=50, seed 42 | EVALUATION.md E1 |
| E4: OOF accuracy 95.2% [94.7-95.7] on 6004 images; catalog subset (1177) accuracy 75.7% | EVALUATION.md E4 |
| Class weights = `error / totalError` (uniform if total error is 0) | `packages/engine/src/rates.js:81` |
| Real Gemini quota: 5 RPM, 250k TPM, 20 RPD; project guard 16 per Pacific day, throttle 13 s | LLM-RUNBOOK.md section 1.1 |
| No real Google API key in git history (3 commits mention the text "AIza" only in docs) | `git log -S` + regex check |
| 52 files mention operator/partner/collaborat; PR template contains a partner name; 2 files have local `file:///d:` links | `git grep` |

## Statements from the previous agent report that are WRONG or unsupported (do not use them anywhere)
- Adaptive 88% / random 64% / fixed 58% mastery; adaptive 3.3 sessions. (File says 100% for all; 4.50/4.60/4.64.)
- Gemini accuracy 64.2% (covid 57.0, pneumonia 64.2, normal 70.5), kappa 0.941, 96.3% agreement. (No LLM run exists; N=0.)
- DenseNet accuracy 96.3%. (File: 95.2%.)
- Weight formula `0.6*FNR + 0.4*FPR` with floor 0.1. (Not in code.)
- "T08c executed batches and generated the final seed". (Only the runbook was merged.)
- "Statistically proven" advantage of adaptive. (No such result.)
Rule from now on: a number is used only if it comes from a file in the repo or from a command Mahdi ran.

## Honest message for the defense about the simulation
In the simulation all three policies reach mastery for all virtual residents; the adaptive policy needs on average 4.50 sessions versus 4.60 (random) and 4.64 (fixed), a difference far smaller than the standard deviation (about 1.4). The simulator shows no meaningful speed advantage; the value of the system lies in the error-pattern report, targeted practice and LLM feedback, which a pilot with real residents would have to evaluate. (Claude and Mahdi write the final wording in the thesis; do not tune the simulator.)

## Order, dependencies and target dates (deadline about 2026-11-27, exact date unconfirmed)
| Task | Who | Starts | Target end | Depends on |
|---|---|---|---|---|
| T13 data run (D1-D5) | Mahdi (terminal) | 11-07 | 11-11 | none (longest lead item) |
| T12 solo docs cleanup | agent | 11-07 | 11-08 | T11 |
| T14 Part A manual run | Mahdi | 11-08 | 11-09 | T13 day 3 for cached LLM content |
| T14 Part B security verification | agent | 11-08 | 11-10 | T12 |
| T14 Part C fixes | agent + Claude triage | 11-10 | 11-13 | T14 A+B |
| T15 UI polish | agent + Mahdi review | 11-13 | 11-18 | T14 Part C |
| T16a SRS | agent | 11-09 | 11-13 | T12 |
| T16b SDD | agent | 11-13 | 11-16 | T16a |
| T16c test report, guides, process | agent | 11-18 | 11-21 | T13, T14, T16b |
| Kit 5 (by Claude): thesis in Persian, slides, demo rehearsal, smoke regression, v1.0.0 tag | Mahdi + Claude | 11-19 | 11-26 | all above |

If time runs out, cut in this order: T15 screens of low value (education, progress) -> T16c user guide -> T16b sections 10-11 -> extra LLM question batches. Never cut T13, T14 Part C Blockers, or the offline demo check.

## Board rows to add (T12 Step 6 adds them)
T12 `docs/T12-solo-docs-cleanup` · T13 `chore/T13-data-seeds` · T14 `chore/T14-qa-security` · T15 `style/T15-ui-polish` · T16a `docs/T16a-srs` · T16b `docs/T16b-sdd` · T16c `docs/T16c-test-report-and-process`.

## Open decisions for Mahdi
1. Ask the professor: delivery format, language of the documents (Persian or English), defense date, whether he expects specific document templates.
2. Keep the single history sentence in `docs/WORKFLOW.md` (recommended) or remove it.
3. After T13, decide whether to run more LLM batches or present with the cached set.
