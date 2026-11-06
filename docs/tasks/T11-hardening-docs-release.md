# T11 - Hardening, docs, demo script, release

- Branch: `chore/T11-hardening-release`
- Depends on: T09b merged; T10 merged (final numbers). Allowed AFTER feature freeze: this task adds NO features.
- Estimate: about 6 h.
- Skills to read first: api-conventions, git-workflow. ADRs: 0007, 0008, 0012. Also read: ci.yml, apps/api/src app setup (middleware order), .env.example, root README (currently about 49 lines), docs/DATA-SOURCES.md, docs/PROGRESS.md and docs/tasks/pr-*-body.md (for deferred findings).

## Principles
- Verify by reading code and running commands; report what you found. Do not assume a protection exists.
- Fix only Blockers and small issues here. Anything bigger -> write it in docs/KNOWN-ISSUES.md with severity.
- Never print or commit secrets. Never touch `.env`.

## Step 1 - Access matrix test (tests first)
Add `apps/api/src/__tests__/access-matrix.test.js`: a table of every endpoint in the README (method, path, allowed roles). For each: unauthenticated -> 401; resident on `/api/admin/*` -> 403; instructor on resident-only routes (sessions, practice) -> the documented status; foreign-resource access -> denied. The test must fail if a route exists in the router but is missing from the table (compare against the Express router stack or the README list).
Commit: `test(api): add endpoint access matrix`.

## Step 2 - Global leak scan (tests first)
Extend or add one test that, for the resident endpoints (sessions before and after finish, report, progress, practice), deep-scans every JSON response for the forbidden keys list from ADR 0008 / T09b (`trueClass`, `confusedWith`, `bucket`, `difficulty`, `source`, `catalogId`, `imageId`, `filename`) before the session is finished. Reuse the helper from T09b.
Commit: `test(api): add global label leakage scan`.

## Step 3 - Security review pass (report first, then fix)
Check each item by reading code, and write PASS / FAIL / N/A + file:line in the PR body table:
1. Session cookie flags: httpOnly, sameSite, secure in production, sensible maxAge.
2. CORS limited to the configured web origin (no `*` with credentials).
3. Security headers (helmet or equivalent) present.
4. Rate limiting on auth routes and on LLM-triggering endpoints.
5. Body size limit set; every route validates params/query/body with Zod.
6. Error handler does not return stack traces in production; unknown errors -> generic message.
7. Password hashing algorithm and cost (read, do not change unless clearly weak).
8. Image endpoint authorization (tests from T05/T09b exist).
9. `LLM_MODE=cache-only` never calls the network (test with a provider stub that throws).
10. Secrets: `git grep -n -I -E "AIza[0-9A-Za-z_-]{30,}"` returns nothing; `.env` is ignored; `.env.example` has no real values and lists every variable the code reads (compare with `process.env.` usages).
11. `npm audit --omit=dev` at root: report counts; do NOT run `npm audit fix --force`; fix only if a non-breaking update exists, otherwise list in KNOWN-ISSUES.md.
Fix FAILs that are small; commit each fix separately: `fix(api): <what>`.

## Step 4 - Console output encoding
Scripts print non-ASCII characters (em dash, check marks) that show as garbage in PowerShell. Replace them with ASCII in the API scripts' output and in `scripts/check-rtl-classes.js` (e.g. `-` and `OK`). Do not change logic. Commit: `chore: use ascii-only console output`.

## Step 5 - Root README rewrite
Sections: what it is + educational-only disclaimer; feature list (resident / instructor / LLM / engine); architecture diagram (Mermaid: web -> api -> MongoDB, api -> Gemini or cache, ml offline pipeline -> artifacts); prerequisites (Windows 11 + PowerShell, Node 24 LTS, MongoDB 8 local, Python 3.12 + uv only for the ML pipeline); QUICKSTART with exact commands in order (install, `.env` from `.env.example`, `seed:catalog`, `create-instructor`, `bank:import`, `llm:cache:import`, `demo:seed`, `npm run dev`); env variable table; scripts table; LLM modes (live vs cache-only) and quota facts; tests/lint/CI; repo structure; link to docs/EVALUATION.md (do NOT copy numbers into the README); limitations (link to docs/KNOWN-ISSUES.md); data sources and licenses (link to docs/DATA-SOURCES.md); Solo Mode note. Leave `<!-- SCREENSHOT -->` placeholders (Mahdi takes screenshots).
Commit: `docs: rewrite root readme`.

## Step 6 - Fresh-clone test
In a temp folder OUTSIDE the repo: `git clone` the repo, follow README quickstart EXACTLY, nothing from memory. Record every deviation and how long it took in the PR body, then fix the README (not the clone). Do not delete the user's real database; use a separate database name through the env variable.
Commit: `docs: fix quickstart after fresh clone test`.

## Step 7 - Demo script and offline checklist
`docs/DEMO-SCRIPT.md` (draft from the real UI/code; Mahdi edits): 12-15 minute order of the live demo with exact clicks and the expected screen for each: login as resident -> take/see a test -> report with LLM explanation -> progress page -> targeted practice -> login as instructor -> question review panel (approve one) -> residents list -> (optional) catalog. For each step: "if it fails, do this". Then a section "Questions the professor may ask" with honest answers based on docs: adaptive was not faster in the simulation (see EVALUATION.md), difficulty partly reflects data source, COVID-19 has few images, only one non-expert reviewer, free-tier LLM quota and why cache-only exists, educational-only.
`docs/DEMO-CHECKLIST.md`: day-before checklist: VPN off, `LLM_MODE=cache-only`, MongoDB running, fresh DB import sequence, seeds present, browser zoom/RTL check, second browser profile for the instructor, charger, backup screen recording (Mahdi records), backup zip.
Commit: `docs: add demo script and checklist`.

## Step 8 - Known issues and limitations
Create `docs/KNOWN-ISSUES.md`: table of (id, area, description, severity, status, source). Fill it from docs/PROGRESS.md, docs/tasks/pr-*-body.md and your own findings in this task (Defer items). Add a "Limitations for the report" section (facts only, no spin). Mahdi will add deferred review findings that are not in the repo.
Commit: `docs: add known issues and limitations`.

## Step 9 - CI and release prep
Confirm ci.yml runs lint + tests on PRs and main; add a CI status badge to README. Do NOT create tags or releases yourself. At the end, print for Mahdi the exact commands (below) in the PR body.

## Verification commands
```powershell
npm run lint
npm test
npm audit --omit=dev
git grep -n -I -E "AIza[0-9A-Za-z_-]{30,}"
```

## Acceptance criteria
- Access matrix and global leak scan pass and fail when a route/key is added (reviewer will try).
- Security table in the PR body has no unexplained FAIL.
- Fresh-clone quickstart works verbatim.
- README, DEMO-SCRIPT, DEMO-CHECKLIST, KNOWN-ISSUES exist; no invented numbers anywhere (all numbers link to EVALUATION.md).
- No new feature, no new dependency (unless a security fix requires it and is explained).

## Release (Mahdi does this by hand after merge, NOT the agent)
```powershell
git checkout main
git pull
npm run lint
npm test
git tag -a v1.0.0 -m "Radiology Adaptive Trainer v1.0.0 (capstone release)"
git push origin v1.0.0
git archive --format=zip -o radiology-adaptive-trainer-v1.0.0.zip v1.0.0
```
Then create a GitHub Release from the tag in the web UI and attach the zip. Final rehearsal: full offline demo on the presentation laptop.

## Out of scope
New features, deployment (Render/Vercel), Docker, repo split, English UI, chat tutor, Grad-CAM.
