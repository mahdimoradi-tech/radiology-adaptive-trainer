# ROADMAP — 4 weeks, two operators (A = repo owner, B = partner)

Capacity: 2 operators x ~2 h/day x ~6 days x 4 weeks = ~96 h, minus review/sync overhead. Estimates below are DRIVER hours; reviewing costs the other operator ~20-25% extra. There is NO slack: if a task slips, cut by this order: Could items -> S4 pilot -> S3 English UI -> S2 study-plan text. Must items are never cut. Milestone: end of week 3 = demo-ready core (test -> report -> adaptive test -> LLM questions). Week 4 = evaluation, hardening, docs.

Rules: every operator drives >= 1 task in each area (ML, engine, API, web, LLM). Contracts first (`packages/contracts`). One task = one branch = one PR; the other operator reviews. Detailed task files exist for T00-T02; T03+ are written after the professor meeting and after T01/T02 clarify the data.

| Task | Wk | Driver / Reviewer | Goal | Main outputs | Needs | Est. h | Human steps |
|---|---|---|---|---|---|---|---|
| T00 | 1 | A+B (A part 1, B part 2) | Environment, repo, tooling, CI, docs | green monorepo, hooks, CI, board, tag v0.0.1 | - | 3 (A) + 2 (B) | install Node 24, Git, gh, MongoDB; `gh auth login`; invite B |
| T01 | 1 | A / B | ML pipeline: OOF difficulty + catalog | `ml/artifacts/difficulty.json`, `catalog.json`, report, `docs/DATA-SOURCES.md`, catalog zip | T00 | 8 | install Python 3.12 + uv; download 4 datasets |
| T02 | 1 | B / A | Adaptive engine + simulator (TDD) | `packages/engine`, contract typedefs, ADR for deviations | T00 | 7 | - |
| T03 | 2 | B / A | Contracts + API foundation: config, auth (resident/instructor), models, catalog seed, `data:install` | `apps/api`, auth endpoints, seed scripts, tests, Postman collection | T00, T01 | 6 | `.env`, install catalog zip |
| T04 | 2 | A / B | Web foundation: Vite + React + Tailwind RTL, i18n, auth pages, layouts for both panels, API client | `apps/web`, login/register, empty panels | T03 contracts | 6 | - |
| T05 | 2 | A / B | Session API: baseline + adaptive test, answers, finish, metrics, report, progress | endpoints + tests using the engine | T02, T03 | 6 | - |
| T06 | 3 | B / A | Quiz UI + report + review + education page | full test cycle in the browser | T04, T05 | 8 | UI feedback |
| T07 | 3 | A / B | LLM core: provider, modes, cache, KB, error explanations + narrative report | `modules/llm`, KB drafts, UI panels, fake-provider tests | T05 | 5 | create own Gemini API key |
| T08 | 3 | B / A | Image analysis, question generation, validation, instructor review panel, bank export/import | batch scripts, `question_bank`, review UI, `seed/question-bank.approved.json` | T07 | 10 | run batches (VPN), review questions as instructor |
| T09 | 4 | A+B | Targeted practice, progress dashboard (S1), final polish of both panels | `targeted` sessions, charts | T06, T08 | 6 | - |
| T10 | 4 | A (simulation) + B (LLM eval) | Evaluation | `docs/evaluation/*`, CSV, figures, rubric sheet | T02, T08 | 6 | score a sample of questions |
| T11 | 4 | A+B | Hardening, README, demo script (`LLM_MODE=cache-only`), contributions report, final report skeleton | release v1.0.0, `docs/CONTRIBUTIONS.md` | all | 6 | rehearse the demo |

## Critical path and parallel windows
- Week 1: T01 (A) and T02 (B) run in parallel after T00. They touch different folders (`ml/` vs `packages/`).
- Week 2: T03 must merge its contracts PR on day 1; then T04 (web) and T05 (sessions) run in parallel against the contracts. T05 needs T02 and T03.
- Week 3: start T07's provider/cache first (needed by T08); start the `analyze-images` batch (throttled, resumable) as early as possible - API quota and instructor review time are the main schedule risks. T06 runs in parallel.
- Week 4: T09 first; T10 and T11 overlap.

## Cut list
Could: C1 grounded chat, C2 similarity weighting, C3 Grad-CAM, C4 online deployment. Should: S1 progress charts (keep a minimal version), S2 study-plan text, S3 English UI, S4 pilot.

## Rules for every task
Branch `<type>/<Txx>-<name>`, small commits, PR with Driver/Reviewer, update the board row and your operator log, final report in Persian.
