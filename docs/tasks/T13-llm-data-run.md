# T13 - Real LLM data run (finishes T08c Part B)

- Branch: `chore/T13-data-seeds` (Part C). Parts A, B, D are done by Mahdi in the terminal and browser, NOT by the agent.
- Depends on: T12 is NOT required. Start Part A as soon as possible: Gemini allows only 16 requests per Pacific day, so the data run is the longest-lead item of the project.
- Type: developer checklist (Mahdi) + small agent part (docs/data commit).
- Estimate: about 10 min/day for 5 days + about 3 min per generated question for review + 40 min for the rubric.
- Read first: `docs/LLM-RUNBOOK.md` (all commands below come from it), ADR 0012, ADR 0013.

## Why this task exists (verified facts)
- `apps/api/seed/image-analyses.json` and `apps/api/seed/question-bank.approved.json` are `[]` (empty) on main. `llm-cache.portable.json` has only a few confusion-pair explanations.
- `npm run analysis:status -w @radiology/api` (2026-11-07): Batches Total 40, Done 0; budget Used 0/16 for that Pacific day.
- Consequence: `docs/EVALUATION.md` E2 (image analysis) and E3 (question bank) are empty, and a `LLM_MODE=cache-only` demo would show no image analysis and no generated questions. T08c merged only Part A (the runbook).

## Hard rules
- Never paste, print, commit or send `.env` or the API key anywhere. Do not use the same key in other tools during runs.
- Do NOT change prompts, validation thresholds, quotas or seeds to make accuracy or pass-rates look better. Report whatever the data says (the thesis needs honest numbers).
- If you are not sure a generated question is scientifically right, REJECT it. You are not a radiologist: approve only what is consistent with the knowledge-base text and the dataset label.
- Retries after a 429 cost +1 request. Always keep 2 requests of buffer per day.

## Part A - preflight (daily, 2 min)
1. VPN on (Google must open). MongoDB running: `mongosh --eval "db.adminCommand('ping')"` -> `ok: 1`.
2. `git status` clean on `main`. `.env` has `LLM_MODE=live` and a valid key (do not display it).
3. Images exist locally: `Get-ChildItem data\catalog\images -Recurse -File | Measure-Object | Select-Object Count` -> a number greater than 1000.
4. `npm run analysis:status -w @radiology/api` -> read the line `Day: YYYY-MM-DD (Pacific)` and `Remaining`. If `Exhausted: true`, stop for today. The reset is at midnight US Pacific (about 11:30 Tehran during US standard time).

## Part B - day plan (counts requests, not images)
Run ONLY the day's commands, then paste the output of `analysis:status` (or `questions:status`) to Claude for a check.

| Day | Commands | Requests |
|---|---|---|
| D1 | `npm run llm:smoke -w @radiology/api` then `npm run analysis:run -w @radiology/api -- --max-requests 13 --runs A` | 1 + 13 |
| D2 | `npm run analysis:run -w @radiology/api -- --max-requests 14` (finishes run A, starts run B) | 14 |
| D3 | `npm run analysis:run -w @radiology/api -- --max-requests 13 --runs B` | 13 |
| D4 | `npm run analysis:validate -w @radiology/api`, `npm run analysis:status -w @radiology/api`, `npm run analysis:export -w @radiology/api`, then `npm run questions:generate -w @radiology/api -- --max-requests 12`, `npm run questions:status -w @radiology/api` | 12 |
| D5 | review questions in the browser (B3); if gate G2 is not met run `questions:generate` again; then `npm run llm:pregenerate -w @radiology/api -- --lang fa` and `-- --lang en` | up to 14 |

If a day ends early because of errors, just continue next day: the scripts resume (completed batches are skipped).

GATE G1 (after D3/D4): `Done == Total` (40/40) in `analysis:status`. If it is not reached by 2026-11-13, tell Claude (we then report a partial set honestly).

B3 - Review (instructor account, `http://127.0.0.1:5173/instructor/review`, keys A approve, R reject, J/K next/previous). GATE G2: at least 24 APPROVED questions, at least 8 per type (finding, distribution, differential), covering at least 3 confusion pairs. If the automatic rejection rate is high, generate more on the next day; do not weaken the validators.

B4 - Export (after G2): `npm run bank:export -w @radiology/api`, `npm run analysis:export -w @radiology/api`, `npm run llm:cache:export -w @radiology/api`.

B5 - Rubric for E3 (about 40 min): `node scripts/eval-questions.js export-rubric` creates the sample CSV (`docs/evaluation/question-rubric.csv`, up to 8 questions per type). Rate every row following the CSV header (clarity, distractor plausibility, no answer leakage, scientific correctness). If unsure about correctness choose the lowest rating. Then `node scripts/eval-questions.js score`.

## Part C - commit (Mahdi, small agent help allowed)
1. `git checkout -b chore/T13-data-seeds`.
2. Check sizes: `Get-Item apps\api\seed\*.json | Select-Object Name, Length` (each file must be a few MB at most).
3. `git add apps/api/seed/image-analyses.json apps/api/seed/question-bank.approved.json apps/api/seed/llm-cache.portable.json` and commit `chore(seed): add real LLM analyses, approved questions and portable cache`.
4. `npm run eval:all` (works without MongoDB, reads the seed files). Commit the regenerated GENERATED block of `docs/EVALUATION.md` and `docs/evaluation/*.json`, `docs/evaluation/question-rubric.csv`: `docs(eval): regenerate evaluation with real LLM data`.
5. In `docs/EVALUATION.md`, section "Interpretation and Limitations" ONLY, fix the quota sentence: free tier is 5 requests/min and 20 requests/day, with an internal guard of 16 per Pacific day (it currently says 15 RPM / 16 RPD). Do NOT write interpretation of the results; Claude and Mahdi write it later. Commit: `docs(eval): correct quota facts`.
6. `git status` must show no `.env`. `npm run lint; npm test; npm run build`. PR body: paste the final `analysis:status`, `questions:status` outputs and the E2/E3 tables. Mahdi merges after local gates.

## Part D - offline verification (10 min, GATE G3)
Fresh terminal, VPN OFF, `LLM_MODE=cache-only`. Start API and web. Do: `npm run bank:import -w @radiology/api`, `npm run analysis:import -w @radiology/api`, `npm run llm:cache:import -w @radiology/api`. Then open (a) a finished report with an LLM explanation, (b) `/instructor/review` showing approved questions, (c) a targeted practice set. All panels show content, no error banner, and the API log shows no outbound request. Write the result in the PR body.

## Acceptance criteria
1. `analysis:status` shows Done 40/40 (or an honest partial count explained in the PR body).
2. Seed files are non-empty; `eval:all` shows E2 with N > 0 and E3 with approved >= 24 (8 per type).
3. `docs/EVALUATION.md` quota text corrected; interpretation section untouched.
4. Offline check (G3) passed and recorded.
5. No `.env`, key or image file in the diff (`git diff --stat main`).

## Out of scope
Prompt tuning, new analysis sets, changing quotas, multiple keys/accounts, new features.
