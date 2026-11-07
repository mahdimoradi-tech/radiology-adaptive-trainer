# AGENTS.md — Radiology Adaptive Training Platform (B.Sc. capstone)

> Always-on rules. Keep short. Details are in `.agents/skills/*/SKILL.md` (load on demand) and `docs/`.

## 0. Context
- Product: web platform that trains radiology residents on chest X-rays (classes `covid19`, `pneumonia`, `normal`). It learns each user's false-positive / false-negative error pattern, builds the next test adaptively, and uses an LLM (Gemini) for image analysis, question generation (instructor-approved) and feedback. Two panels: resident and instructor.
- Source paper: `docs/reference/paper.pdf`. Domain summary: `docs/DOMAIN.md`. Scope: `docs/ROADMAP.md`.
- SINGLE DEVELOPER: Mahdi (repository owner). Runs the AI agent on a Windows machine (medium RAM/CPU, NO Docker). React/JavaScript developer with little backend/ML experience; must understand and be able to defend every line. Deadline: ~4 weeks, ~2-4 h/day.
- Language rules: explain to the developer in simple PERSIAN (short sentences, define jargon once). Code, comments, commits, docs, ADRs in ENGLISH. Product UI text in Persian (default) through i18n keys.

## 1. Golden rules (never break)
Read `docs/WORKFLOW.md` at the start of every session; verify `git config user.name` and `user.email` belong to the repository owner (Mahdi Moradi). NEVER commit under another identity and never as "agent".
1. ONE task at a time, and only a task listed in `docs/PROGRESS.md`. Read the whole task file, reply with a plan (max 10 bullets) and WAIT for "go".
2. NEVER guess versions, APIs, flags or config keys: look them up (Context7 MCP / official docs / `npm view <pkg>`). Your training data is older than these libraries.
3. NEVER invent requirements. If ambiguous, STOP and ask one clear question.
4. Small steps; after each step run the verification command and show REAL output. Never claim "done" without running it.
5. Stay inside the task scope and its folders. No drive-by refactors, renames, or dependency upgrades. Check `docs/PROGRESS.md` and `gh pr list` before starting.
6. NEVER commit secrets (`.env`, API keys, tokens), datasets/images, model weights, `node_modules`, build output, `.venv`. If a secret is committed: STOP, tell the developer, rotate the key.
7. NEVER run `git push --force`, `git reset --hard` on shared work, `rm -rf`/`Remove-Item -Recurse` outside this repo, or anything that changes global machine settings, without asking. Keep terminal-command approval ON.
8. Same failure twice -> STOP. Report exact error text, your hypothesis, and 2 options.
9. Tests are the guardrail: write tests from the spec BEFORE implementation for engine/algorithm code. Never weaken or delete a test to make it pass.
10. Educational product only: LLM/model output is never medical advice or diagnosis. No real patient data. Respect dataset licenses.

## 2. Stack (versions and tools: `docs/TOOLCHAIN.md`)
**JavaScript only (ES modules), no TypeScript.** Node.js 24 LTS · npm workspaces · React 19 + Vite + Tailwind CSS 4 + React Router 7 + TanStack Query · Express 5 + Mongoose + MongoDB (installed directly on Windows, no Docker) · Zod 4 for ALL runtime validation · Vitest 4 · `@google/genai` (Gemini; model from env) · Python 3.12 + uv + PyTorch only for the OFFLINE ML pipeline in `ml/`. Types are documented with JSDoc `@typedef` in `packages/contracts`.

## 3. Windows rules
Commands you give or run must work in PowerShell. Windows PowerShell 5.1 has no `&&`: run commands one per line or use `;`. npm scripts must be cross-platform (no `rm -rf`, no bash-only syntax; use Node scripts). Use `127.0.0.1` not `localhost` for MongoDB. LF line endings (`.gitattributes`). Quote paths with spaces. Do not install software silently: tell the developer what to install and verify afterward.

## 4. Repository layout
```
apps/api/            Express API
apps/web/            React app (resident panel + instructor panel, Persian RTL)
packages/contracts/  Zod schemas + JSDoc typedefs shared by api/web/engine (the agreed contract)
packages/engine/     Pure JS adaptive engine + simulator (no I/O)
ml/                  Python offline pipeline -> ml/artifacts/difficulty.json
docs/                SRS-lite, ADRs, tasks, PROGRESS.md, progress/, reference/
.agents/             skills + workflows
```
Dependency direction: `web -> api (HTTP)`, `api -> engine, contracts`, `engine -> contracts`, `contracts -> nothing`.

## 5. Code standards
- No `any`-style shortcuts: validate every external input (HTTP, env, LLM output, files) with Zod at the boundary. JSDoc on exported functions (`@param`, `@returns`, `@typedef`).
- ESLint + Prettier must pass. Functions <= 40 lines, one responsibility; comments explain WHY. Use domain names from `docs/DOMAIN.md`.
- UI: no hard-coded user-visible strings (i18n keys); Tailwind logical utilities (`ms-*`, `pe-*`, `text-start`); NEVER mirror/flip X-ray images.
- Every feature ships with tests. Tests never call the real Gemini API (fake provider).
- Add dependencies only via the protocol in `docs/TOOLCHAIN.md`.

## 6. Git and review workflow (details: skills `git-workflow`, `review-workflow`)
Branch per task `type/Txx-name`; small Conventional Commits; push after each logical step; one PR per task; independent AI review in a fresh chat + local gates + CI green; merge with a merge commit; `git pull --rebase origin main` before starting work each day. Contracts first, then implementations.

## 7. Definition of Done
- [ ] Acceptance criteria met, shown with commands + outputs.
- [ ] `npm run lint`, `npm test`, `npm run build` pass (+ `uv run pytest`/`ruff` if `ml/` changed).
- [ ] Docs updated (README/ADR/PROGRESS board row + developer log).
- [ ] Commits pushed, PR opened with the template.
- [ ] Final report sent (below).

## 8. Final report (Persian)
1) خلاصه ۲) فایل‌های تغییر کرده ۳) دستورها و نتایجشان ۴) تصمیم‌ها و دلیل ۵) ریسک‌ها ۶) چیزهایی که بازبین باید با دقت نگاه کند ۷) قدم بعدی ۸) سؤال‌های باز.

## 9. Handoff
At the end of each task update the `docs/PROGRESS.md` board row and `docs/progress/developer-log.md`. A new chat starts with: `AGENTS.md` -> `docs/PROGRESS.md` -> `docs/progress/developer-log.md` -> the task file.

## 10. Skills index (load only what is needed)
`git-workflow` · `review-workflow` · `adaptive-engine` · `ml-difficulty-pipeline` · `api-conventions` · `persian-rtl-ui` · `llm-feedback` · `question-generation`. Slash workflows: `/start-task`, `/finish-task`, `/status`, `/sync` (start of each session), `/setup-check` (machine health).
