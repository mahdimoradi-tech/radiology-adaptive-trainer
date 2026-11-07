# TOOLCHAIN — versions, tools and the dependency protocol

Verified on 2026-10-21 unless marked "verify". Versions move fast: the agent MUST re-check each item with the command in the last column and report any mismatch BEFORE installing. Prefer the newest STABLE version compatible with the rest of the stack. Language: **JavaScript (ES modules) only, no TypeScript.** Platform: Windows (PowerShell), no Docker.

## 1. Versions
| Component | Target | Status | How to verify |
|---|---|---|---|
| Node.js | 24.x LTS (latest 24.x patch). Node 26 becomes LTS on 2026-10-28 - do NOT switch until the team decides; an installer called "LTS" after that date may be v26 | verified | `node -v` |
| npm | bundled with Node 24 (11.x) | verify | `npm -v` |
| ESLint (flat config) + @eslint/js, eslint-config-prettier, eslint-plugin-react, react-hooks, jsx-a11y; Prettier 3.x | latest stable | verify | `npm view eslint version` |
| React + react-dom | 19.3.1 (same exact version for both) | verified | `npm view react version` |
| Vite + @vitejs/plugin-react | Vite 8.x (JavaScript template `react`) | verify | `npm view vite version` |
| Tailwind CSS + @tailwindcss/vite | 4.3.x (CSS-first config, no tailwind.config.js) | verified | `npm view tailwindcss version` |
| react-router (package `react-router`, library mode) | 7.x | verify | `npm view react-router version` |
| @tanstack/react-query | 5.x | verify | `npm view @tanstack/react-query version` |
| i18next, react-i18next, @fontsource-variable/vazirmatn | latest | verify | `npm view <pkg> version` |
| recharts | latest 3.x | verify | `npm view recharts version` |
| Express | 5.2.x | verified | `npm view express version` |
| Mongoose | 9.x | verified | `npm view mongoose version` |
| MongoDB Community Server (installed on Windows) | 8.x + `mongosh` | verify | MongoDB download page; `mongosh --version` |
| Zod | 4.x | verified | `npm view zod version` |
| Vitest (+ @vitest/coverage-v8), @testing-library/react, jsdom, supertest, fast-check | Vitest 4.1.x; others latest | verify | `npm view <pkg> version` |
| bcryptjs, jsonwebtoken (or jose), helmet, cors, express-rate-limit, pino, cookie-parser | latest | verify | `npm view <pkg> version` |
| @google/genai | >= 2.3.0 (Interactions API) | verified | `npm view @google/genai version` |
| Gemini model id | `gemini-3.8-flash` (from env `GEMINI_MODEL`) | verified | https://ai.google.dev/gemini-api/docs/models |
| Python | 3.12.x (Windows installer) | verify | `python --version` |
| uv (Python package manager) | latest | verify | `uv --version` |
| PyTorch + torchvision (CPU build) | torch 2.14.x + torchvision 0.29.x (2.15 GA expected 2026-10-28; stay on 2.14 unless T01 starts after verification); install with the Windows CPU command from pytorch.org | verified | https://pytorch.org/get-started/locally/ |
| numpy, pandas, scikit-learn, pillow, tqdm, pytest, ruff | latest | verify | `uv pip index versions <pkg>` |
| Husky 9.x, @commitlint/cli + config-conventional, lint-staged | latest | verify | `npm view <pkg> version` |
| concurrently (run api+web together in dev) | latest | verify | `npm view concurrently version` |
| GitHub Actions: actions/checkout, actions/setup-node; CI MongoDB service image `mongo:8` | latest major tags | verify | each action's releases page; Docker Hub tags |

## 2. Dependency protocol (before adding ANY package)
1. `npm view <pkg> version dist-tags.latest peerDependencies engines deprecated time.modified`.
2. Confirm peer ranges accept React 19.3, Node 24, Vite 8, Mongoose 9, Zod 4. If not, pick the newest compatible version and explain.
3. Skip releases newer than 14 days (supply-chain safety) unless the task needs them; skip deprecated or unmaintained packages (no release in 12+ months) and propose an alternative.
4. Install with `npm install -w <workspace> <pkg>` (never `-g`, never `--force`, never `--legacy-peer-deps` without asking). Commit the lockfile. CI uses `npm ci`. Never hand-edit `package-lock.json`.
5. Run `npm audit --omit=dev`; report high/critical findings.
6. In the PR description add a table: package | version | why it is needed.
7. Python: `uv add <pkg>`; commit `uv.lock`.
8. npm scripts must work on Windows PowerShell and Unix (no `rm -rf`, no bash-only syntax; use Node scripts or cross-platform packages). Windows PowerShell 5.1 has no `&&`.

## 3. Tools the agent will work with
**Environment (Windows):** Google Antigravity (IDE + agent, Gemini 3.8 Flash, Google AI Pro) · Node.js + npm · Git for Windows · GitHub CLI `gh` · MongoDB Community + `mongosh` (+ Compass optional) · Postman (collection kept in `docs/postman/`) · Python + `uv` (from T01) · Chrome (Antigravity's browser agent can open `http://127.0.0.1:5173`). NO Docker (CI uses a MongoDB service container on GitHub's Linux runner only).
**Online services:** GitHub (repo, PRs, Actions) · Google AI Studio (Gemini API key; VPN access is available) · Kaggle / Mendeley / GitHub (datasets, downloaded by the developer) · Google Colab (optional GPU).
**MCP servers (see `KIT-README-FA.md`):** Context7 (current library docs). GitHub is used through `gh`, not an MCP server (no token in config). A read-only MongoDB MCP is optional.
**Docs tooling:** Markdown + Mermaid in `docs/`.
