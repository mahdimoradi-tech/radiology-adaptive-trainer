# T00 — Bootstrap (environment, Git, repo, tooling, CI, docs)

Developer: Mahdi Moradi · Branch: `chore/T00-bootstrap` · Skills: `git-workflow`, `review-workflow` · Estimate: 5 h · Language: JavaScript (ES modules), Windows, NO Docker.

## Goal
A green, versioned monorepo on GitHub that the developer can clone, run, and develop with the review workflow - before any product code. Nothing product-related is built here.

## Step 0 — Intake (on the development machine; STOP and ask; no git command before this)
Verify the setup in `git-workflow` section 1 and also: (a) Windows PowerShell 5.1 or PowerShell 7? (b) Is MongoDB Community installed? Is `mongosh` installed? (c) Do you already have a Gemini API key from Google AI Studio? (d) Antigravity version and whether skills in `.agents/skills` and workflows (`/start-task`) are visible to you. (e) Is `docs/reference/paper.pdf` in place? Write the answers (NO secrets) into the developer log `docs/progress/developer-log.md` under "Environment".

## Step 1 — Verify the machine (read-only) = run the `/setup-check` workflow
Required now: Node 24.x, npm, git, `gh` (logged in), MongoDB + `mongosh` ping OK. Needed from T01 (report only): Python 3.12, uv.
If something is missing, give the developer the exact install steps and WAIT:
- **Node 24 LTS:** install the Node 24 Windows installer from nodejs.org (or `fnm`/`nvm-windows` with `24`). WARNING: Node 26 becomes "LTS" on 2026-10-28, so an installer labelled "LTS" after that date may be v26. We stay on **v24.x** until decided otherwise.
- **Git for Windows** and **GitHub CLI**: official installers. The developer runs `gh auth login` himself (agent never sees tokens).
- **MongoDB Community Server 8.x:** official Windows MSI, "Complete" install, run as a Windows Service, and install `mongosh`. Check the current download page/docs (do not rely on memory). Verify: `mongosh "mongodb://127.0.0.1:27017" --quiet --eval "db.runCommand({ping:1}).ok"` prints `1`.

## PART 1 — Repository, tooling, CI (steps 2-10)

### Step 2 — Git and GitHub
1. `git init -b main`; local `user.name`/`user.email` from the intake.
2. Create exactly these files, then commit `chore(repo): initialize repository`:
   - `.gitignore`: `node_modules/`, `dist/`, `build/`, `coverage/`, `.env`, `.env.*` with `!.env.example`, `.DS_Store`, `Thumbs.db`, `*.log`, `.vscode/*` with `!.vscode/extensions.json`, `.venv/`, `__pycache__/`, `.pytest_cache/`, `.ruff_cache/`, `/data/`, `*.npy`, `*.pt`, `*.pth`, `*.onnx`, `*.zip`, `docs/reference/*.pdf`, `*.pem`, `.agents/mcp_config.json`. (`ml/artifacts/*.json` and `apps/api/seed/*.json` ARE committed.)
   - `.gitattributes`: `* text=auto eol=lf`. `.editorconfig`: utf-8, lf, 2 spaces (Python 4), final newline, trim trailing whitespace. `.nvmrc`: `24`.
   - `README.md`: title, one paragraph, "status: bootstrap", how to run (placeholder), link to `docs/`.
3. Connect GitHub: if the repo does not exist and A confirmed: `gh repo create <owner>/<name> --private --source=. --remote=origin` (otherwise `git remote add origin <url>`); `git push -u origin main`.
4. `git switch -c chore/T00-bootstrap`. Commit the kit unchanged: `docs(repo): add agent kit and project documentation` (AGENTS.md, .agents/, docs/). Push.

### Step 3 — npm workspaces monorepo (JavaScript ESM)
Root `package.json`: `name: radiology-adaptive-platform`, `private: true`, `type: module`, `workspaces: ["apps/*","packages/*"]`, `engines.node: ">=24"`, scripts `lint`, `format`, `format:check`, `test`, `build` (each runs the same-named script in every workspace with `npm run <name> --workspaces --if-present`; `lint` also lints root files). Scripts must run in PowerShell and Unix. Commit: `chore(repo): initialize npm workspaces monorepo`.

### Step 4 — ESLint, Prettier, Vitest (dependency protocol for each package)
ESLint flat config `eslint.config.js` (`@eslint/js` recommended, Node globals, ignore `dist`, `coverage`, `data`, `ml/`), `eslint-config-prettier`; Prettier config: single quotes, semicolons, width 100, trailing commas `all`. Vitest 4.x as root devDependency. Commit: `build(repo): add ESLint, Prettier and Vitest`.

### Step 5 — Package skeletons (no real logic)
- `packages/contracts`: `package.json` (`@radiology/contracts`, ESM, `exports`), `src/index.js` exporting `CONTRACTS_VERSION = '0.0.0'`, `src/__tests__/smoke.test.js`.
- `packages/engine`: `@radiology/engine`, `src/index.js` exporting `ENGINE_VERSION = '0.0.0'`, smoke test.
- Both: scripts `test` (`vitest run`), `lint`, `build` (a no-op `node -e "console.log('no build')"` is fine). Commit: `chore(repo): add contracts and engine package skeletons`.

### Step 6 — Hooks
Install Husky 9.x, `@commitlint/cli`, `@commitlint/config-conventional`, `lint-staged` (read their CURRENT docs via Context7; Husky's init and hook format changed between versions). `commit-msg` -> commitlint (scopes: `api, web, engine, contracts, ml, docs, ci, repo, llm`); `pre-commit` -> lint-staged (eslint --fix + prettier); `pre-push` -> a Node script `scripts/hooks/no-push-main.js` that REFUSES a push when the current branch is `main`. Prove each hook (show output): a bad message is rejected, a good one passes, `git push origin main` from main is refused. Hooks must work in Git for Windows. Commit: `chore(repo): enforce conventional commits and protect main with hooks`.

### Step 7 — CI and templates
- `.github/workflows/ci.yml`: on `push` to `main` and on `pull_request`; Ubuntu; checkout; setup-node 24 with npm cache; MongoDB as a service container (image `mongo:8`, verify the tag) on port 27017; `npm ci`; `npm run lint`; `npm test`; `npm run build`; env `MONGODB_URI_TEST=mongodb://127.0.0.1:27017/radiology_test`; `permissions: contents: read`. Look up the CURRENT major tags of `actions/checkout` and `actions/setup-node` (do not guess).
- `.github/pull_request_template.md`: Task ID · Branch · What · Why · How to test · Contract changed? · Dependencies added · Review notes · Screenshots (UI) · Checklist (lint, tests, docs, board row, no secrets/data).
- Commit: `ci(repo): add GitHub Actions workflow and pull request template`.

### Step 8 — Docs skeleton
Update/create: `docs/PROGRESS.md` (board is prefilled; keep it), `docs/progress/developer-log.md`, `docs/adr/0001-record-architecture-decisions.md`, `0002-technology-stack.md` (JavaScript only because the developer is a React/JS developer and must defend every line; local MongoDB, no Docker; modular monolith; difficulty precomputed offline; LLM content pre-generated and cached so demos work without VPN), `0003-development-workflow.md` (development workflow, board, contracts first), `docs/DATA-SOURCES.md` (empty table), `.env.example` with: `PORT`, `MONGODB_URI=mongodb://127.0.0.1:27017/radiology`, `MONGODB_URI_TEST=mongodb://127.0.0.1:27017/radiology_test`, `JWT_SECRET=change-me`, `CORS_ORIGIN=http://127.0.0.1:5173`, `LLM_MODE=fake`, `LLM_ENABLED=true`, `GEMINI_API_KEY=`, `GEMINI_MODEL=gemini-3.8-flash`, `LLM_RATE_LIMIT_PER_USER_PER_HOUR=30`; `.vscode/extensions.json` (ESLint, Prettier, Tailwind CSS IntelliSense - recommendations only). Commit: `docs(repo): add ADRs, board, developer log and env template`.

### Step 9 — Remote repository settings
Try branch protection for `main` (require PR + passing CI) with `gh api`; free private repos may refuse it - if so skip it (the `pre-push` hook protects `main`).

### Step 10 — Verify, PR, merge
Fresh-clone test in a temp folder: `git clone <repo>`, `cd` into it, `git switch chore/T00-bootstrap`, then one per line: `npm ci`, `npm run lint`, `npm test`, `npm run build` (show outputs). Push; open the PR; review with the checklist in `review-workflow`; merge with a merge commit; then `git switch main`, `git pull --ff-only`, tag `v0.0.1` and push tags.

## Acceptance criteria
- [ ] `/setup-check` is all-green (Python/uv may be pending until T01).
- [ ] Fresh clone: `npm ci`, `npm run lint`, `npm test`, `npm run build` pass.
- [ ] Hooks: bad commit message rejected; push to `main` refused.
- [ ] CI green on the PR; review checklist satisfied.
- [ ] `git ls-files` has no `.env`, PDF, ZIP or `node_modules`; history shows ~9-11 small Conventional Commits.
- [ ] Tag `v0.0.1` exists; board shows T00 `merged`.

## Out of scope
Any API, web, ML, engine logic or LLM code. Install only what the steps above list.
