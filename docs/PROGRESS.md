# PROGRESS BOARD (shared). Claim = edit ONLY your own task row. Notes go to your operator log in `docs/progress/`.

Statuses: `todo` · `claimed` · `in-progress` · `in-review` · `merged`.
Operators: **A** = repo owner, **B** = partner. Session start: `/sync`, then `/start-task <Txx>`.

| Task | Driver | Reviewer | Status | Branch | PR | Folders touched |
|---|---|---|---|---|---|---|
| T00 | A (solo) | none (solo) | merged | chore/T00-bootstrap | #1 | repo root, `.github/`, `docs/`, `packages/*` skeletons |
| T01 | A (solo) | none (solo) | merged | feat/T01-ml-pipeline | #3 | `ml/`, `docs/DATA-SOURCES.md` |
| T01b | A (solo) | none (solo) | merged | fix/T01b-ml-report | #5 | `ml/`, `docs/` |
| T02 | A (solo) | none (solo) | merged | feat/T02-adaptive-engine | #2 | `packages/engine`, `packages/contracts` (engine shapes), `docs/adr/` |
| T03 | A (solo) | none (solo) | merged | feat/T03-api-foundation | #6 | `packages/contracts`, `apps/api` |
| T04 | A (solo) | none (solo) | merged | feat/T04-web-foundation | #7 | `apps/web`, `docs/`, `scripts/` |
| T05 | A (solo) | none (solo) | in-review | feat/T05-session-api | - | `packages/contracts`, `apps/api`, `docs/` |
| T06 | B | A | todo | feat/T06-quiz-ui | - | `apps/web` |
| T07 | A | B | todo | feat/T07-llm-core | - | `apps/api/src/modules/llm`, `apps/web` panels |
| T08 | B | A | todo | feat/T08-question-generation | - | `apps/api/scripts`, `apps/api/src/modules/bank`, `apps/web` instructor panel |
| T09 | A + B | B / A | todo | feat/T09-targeted-practice | - | engine, api, web |
| T10 | A (sim) + B (LLM) | B / A | todo | docs/T10-evaluation | - | `docs/evaluation/`, scripts |
| T11 | A + B | B / A | todo | chore/T11-hardening | - | docs, root, scripts |

## Open questions (add a line, date, who)
- Professor meeting: confirm goal (reproduce paper vs usable product), LLM expectation (image analysis + question generation), who reviews generated questions/KB scientifically, deadline and delivery format, how individual grades are assessed, whether the agent-assisted workflow is accepted.
- Does Operator B have Antigravity + Google AI Pro? (if not: see `KIT-README-FA.md`)

## Team decisions (link ADRs when they exist)
JavaScript + React (no TypeScript) · Windows, no Docker, MongoDB installed locally · Gemini API (VPN available), no local LLM · 4 weeks, milestone end of week 3 · both operators drive every area.
