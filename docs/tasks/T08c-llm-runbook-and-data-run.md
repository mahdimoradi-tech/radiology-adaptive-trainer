# T08c - LLM runbook and real data run

- Branch: `docs/T08c-llm-runbook` (Part A). Part B uses a second branch `chore/T08c-data-seeds`.
- Depends on: T08b merged (PR #13).
- Type: Part A = docs-only PR written by the agent. Part B = checklist done by Mahdi (operator), NOT by the agent.
- Estimate: Part A about 1 h. Part B about 10 min/day for several days + about 3 min per generated question for review.
- Skills to read first: llm-feedback, question-generation, api-conventions. ADRs: 0012, 0013. Docs: docs/GEMINI-NOTES.md, apps/api README.

## Goal
1. Create `docs/LLM-RUNBOOK.md`: one exact, verified document that says which commands to run, in which order, how many Gemini requests each costs, and how to resume.
2. Use it to generate the REAL data (image analyses, question bank, LLM cache) that T09b, T10 and the demo need.

## Context (known facts, do not re-discover)
- Gemini key quota: 5 requests/min, 250k tokens/min, 20 requests/day. The project guard allows 16 requests per Pacific day (counter shown by `analysis:status` / `questions:status`).
- Current local state: `analysis:status` = Total 40, Done 0; `questions:status` = 0 questions.
- Scripts in apps/api: analysis:select, analysis:plan, analysis:run, analysis:validate, analysis:status, analysis:export, analysis:import, questions:generate, questions:status, bank:export, bank:import, llm:pregenerate, llm:cache:export, llm:cache:import, llm:smoke.
- Seed files exist in apps/api/seed: analysis-set.json, image-analyses.json, llm-cache.portable.json, question-bank.approved.json.

## Part A - steps for the agent (docs only)
HARD RULES: do NOT run any script that calls Gemini. Do NOT open, print or copy `.env`. No API key in any file.

Step 1 - Read (no commit). Read ADR 0012 and 0013, GEMINI-NOTES.md, apps/api/README.md, and for every script listed above read the file in apps/api/scripts and the service code it calls. Find out from CODE: flags/arguments, input files, output files, what is written to MongoDB, whether the script calls Gemini, how the daily budget counter works, resume/idempotency behaviour, and how many Gemini requests one invocation uses (batch size, retries count as requests?).

Step 2 - Write `docs/LLM-RUNBOOK.md` with these sections:
1. Overview + quota facts (above) + Pacific reset time (midnight US Pacific = about 11:30 Tehran while US standard time applies, about 10:30 Tehran during US summer time; tell the reader to check the "Day" line of `analysis:status` instead of trusting a clock).
2. Script table: name | purpose | exact command (`npm run <script> -w apps/api -- <flags>`) | calls Gemini? (yes/no) | requests per invocation | reads | writes | source file:line.
3. Recommended order: preflight -> analysis:select/plan -> analysis:run (repeat daily) -> analysis:validate -> analysis:status -> analysis:export -> questions:generate (repeat daily) -> review in the instructor panel -> bank:export -> llm:pregenerate (explanations/narratives for demo) -> llm:cache:export.
4. Cost formulas with numbers: (a) requests needed for the full planned analysis set, (b) requests per generated question and per confusion pair, (c) requests for llm:pregenerate. If a number cannot be derived from code, write UNKNOWN and say how to measure it (run once, read the counter).
5. Day plan table: for each day which script, how many requests, what to check afterwards.
6. Failure modes: 429 per-minute, 429 daily, 503, schema-invalid output, network/VPN down. For each: what the script does and what the operator does.
7. Safety: never commit `.env`; seed JSON files may be committed (they contain model outputs only); do not use the same key in other tools during runs.
8. "Verification of this document": list each claim that you could not verify as UNKNOWN.
Commit: `docs: add LLM runbook`.

Step 3 - Add to the PR body: the numbers from section 4 and the list of UNKNOWNs.
Step 4 - `npm run lint` and `npm test` (nothing else changes, they must still pass). /finish-task. Add the board row update as usual.

## Part A acceptance criteria
- Every row in the script table has a source reference and the Gemini yes/no column is correct (reviewer will spot-check 3 scripts).
- No UNKNOWN is hidden: unknowns are listed in the PR body.
- No code changed. `git diff --stat main` shows only docs.

## Part B - operator checklist (Mahdi, after Part A is merged)
Daily preflight (2 min): VPN on; MongoDB running; on branch main, clean tree; `.env` has the Gemini key and LLM_MODE=live (do not paste it anywhere); run `npm run analysis:status -w apps/api` and `npm run questions:status -w apps/api` and look at the "Day / Used / Remaining" lines.

B1 Analysis: follow the runbook until `Done == Total`. Then `analysis:validate`, `analysis:status`, `analysis:export`.
GATE G1: analysis finished (or Nov 13, whichever is first).
B2 Question generation: follow the runbook. GATE G2: at least 24 APPROVED questions, at least 8 per type (finding, distribution, differential), covering at least 3 confusion pairs. If the auto-rejection rate is high, just generate more on the next day. Do not edit prompts to "improve numbers" without telling Claude.
B3 Review in the instructor panel: about 3 minutes per question. Rule: if you are not sure the question is scientifically right, REJECT it. You are not a radiologist; approve only what is consistent with the knowledge base text and the dataset label. Write a short note on every rejection (used in T10).
B4 Pre-generate explanations/narratives for the demo (`llm:pregenerate`, cost from runbook).
B5 Export: `bank:export`, `analysis:export`, `llm:cache:export`. Create branch `chore/T08c-data-seeds`, check sizes with `Get-Item apps/api/seed/*.json | Select Name,Length`, commit the three files, PR, merge. Check `git status` shows no `.env`.
B6 Offline check (10 min): fresh terminal, VPN OFF, set LLM_MODE=cache-only, start API + web, open a finished report and a review page: LLM panels must show content from the cache with no error. Record result in the PR body.

## Out of scope
New features, prompt tuning, changing quotas in code, any use of multiple keys/accounts.
