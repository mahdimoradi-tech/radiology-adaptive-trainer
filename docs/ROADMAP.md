# ROADMAP — 4 weeks

Capacity: ~2-4 h/day x ~6 days x 4 weeks. There is NO slack: if a task slips, cut by this order: Could items -> S4 pilot -> S3 English UI -> S2 study-plan text. Must items are never cut. Milestone: end of week 3 = demo-ready core (test -> report -> adaptive test -> LLM questions). Week 4 = evaluation, hardening, docs.

Rules: Contracts first (`packages/contracts`). One task = one branch = one PR; independent AI review + local gates + CI green. Detailed task files guide implementation across all domains.

| Task | Wk | Goal | Main outputs | Needs | Est. h | Human steps |
|---|---|---|---|---|---|---|
| T00 | 1 | Environment, repo, tooling, CI, docs | green monorepo, hooks, CI, board, tag v0.0.1 | - | 5 | install Node 24, Git, gh, MongoDB; `gh auth login` |
| T01 | 1 | ML pipeline: OOF difficulty + catalog | `ml/artifacts/difficulty.json`, `catalog.json`, report, `docs/DATA-SOURCES.md`, catalog zip | T00 | 8 | install Python 3.12 + uv; download 4 datasets |
| T02 | 1 | Adaptive engine + simulator (TDD) | `packages/engine`, contract typedefs, ADR for deviations | T00 | 7 | - |
| T03 | 2 | Contracts + API foundation: config, auth (resident/instructor), models, catalog seed, `data:install` | `apps/api`, auth endpoints, seed scripts, tests, Postman collection | T00, T01 | 6 | `.env`, install catalog zip |
| T04 | 2 | Web foundation: Vite + React + Tailwind RTL, i18n, auth pages, layouts for both panels, API client | `apps/web`, login/register, empty panels | T03 contracts | 6 | - |
| T05 | 2 | Session API: baseline + adaptive test, answers, finish, metrics, report, progress | endpoints + tests using the engine | T02, T03 | 6 | - |
| T06 | 3 | Quiz UI + report + review + education page | full test cycle in the browser | T04, T05 | 8 | UI feedback |
| T07 | 3 | LLM core: provider, modes, cache, KB, error explanations + narrative report | `modules/llm`, KB drafts, UI panels, fake-provider tests | T05 | 5 | configure Gemini API key |
| T08 | 3 | Image analysis, question generation, validation, instructor review panel, bank export/import | batch scripts, `question_bank`, review UI, `seed/question-bank.approved.json` | T07 | 10 | run batches (VPN), review questions as instructor |
| T09 | 4 | Targeted practice, progress dashboard (S1), final polish of both panels | `targeted` sessions, charts | T06, T08 | 6 | - |
| T10 | 4 | Evaluation | `docs/evaluation/*`, CSV, figures, rubric sheet | T02, T08 | 6 | score a sample of questions |
| T11 | 4 | Hardening, README, demo script (`LLM_MODE=cache-only`), release | release v1.0.0, documentation, QA suites | all | 6 | rehearse the demo |

## Critical path and execution order
- Phase 1: ML pipeline and adaptive engine establish data foundations and algorithmic core.
- Phase 2: Contracts established on day 1, followed by backend API foundation and frontend web shell. Session API integrates the engine with MongoDB persistence.
- Phase 3: Resident quiz UI connected to live sessions. LLM core implements provider abstraction, prompt grounding, and offline cache. Image analysis and question generation batches executed.
- Phase 4: Targeted practice, instructor analytics, and system evaluation. Hardening, security auditing, and demo preparation.

## Cut list
Could: C1 grounded chat, C2 similarity weighting, C3 Grad-CAM, C4 online deployment. Should: S1 progress charts (keep a minimal version), S2 study-plan text, S3 English UI, S4 pilot.

## Rules for every task
Branch `<type>/<Txx>-<name>`, small commits, PR, update the board row and developer log, final report in Persian.
