# PROGRESS BOARD

Statuses: `todo` · `in-progress` · `in-review` · `merged`.
Session start: `/sync`, then `/start-task <Txx>`. Notes go to `docs/progress/developer-log.md`.

| Task | Status | Branch | PR | Folders touched |
|---|---|---|---|---|
| T00 | merged | chore/T00-bootstrap | #1 | repo root, `.github/`, `docs/`, `packages/*` skeletons |
| T01 | merged | feat/T01-ml-pipeline | #3 | `ml/`, `docs/DATA-SOURCES.md` |
| T01b | merged | fix/T01b-ml-report | #5 | `ml/`, `docs/` |
| T02 | merged | feat/T02-adaptive-engine | #2 | `packages/engine`, `packages/contracts` (engine shapes), `docs/adr/` |
| T03 | merged | feat/T03-api-foundation | #6 | `packages/contracts`, `apps/api` |
| T04 | merged | feat/T04-web-foundation | #7 | `apps/web`, `docs/`, `scripts/` |
| T05 | merged | feat/T05-session-api | #8 | `packages/contracts`, `apps/api`, `docs/` |
| T06 | merged | feat/T06-resident-ui | #10 | `apps/web`, `docs/` |
| T07 | merged | feat/T07-llm-core | #11 | `packages/contracts`, `apps/api`, `apps/web`, `docs/` |
| T08a | merged | feat/T08a-image-analysis | #12 | `packages/contracts`, `apps/api`, `docs/` |
| T08b | merged | feat/T08b-question-bank | #13 | `packages/contracts`, `apps/api`, `apps/web`, `docs/` |
| T08c | merged | docs/T08c-llm-runbook | #16 | `docs/`, `apps/api/seed/` |
| T09a | merged | feat/T09a-progress-and-residents | #17 | `apps/api`, `apps/web`, `docs/` |
| T09b | merged | feat/T09b-targeted-practice | #18 | `packages/contracts`, `apps/api`, `apps/web`, `docs/` |
| T09c | merged | feat/T09c-education-catalog | #19 | `apps/web`, `docs/` |
| T10 | merged | feat/T10-evaluation | #20 | `packages/engine`, `apps/api`, `docs/evaluation/` |
| T11 | merged | chore/T11-hardening-release | #21 | repo root, `apps/api`, `apps/web`, `docs/` |
| T12 | merged | docs/T12-solo-docs-cleanup | #23 | `docs/`, `.agents/`, `.github/` |
| T13 | merged | chore/T13-data-seeds | #24 | `apps/api/seed/`, `data/`, `docs/` |
| T14 | merged | chore/T14-qa-security | #25, #26 | `apps/api/`, `apps/web/`, `docs/qa/` |
| T15 | in-review | style/T15-ui-polish | #28 | `apps/web/` |
| T16a | todo | docs/T16a-srs | - | `docs/` |
| T16b | todo | docs/T16b-sdd | - | `docs/` |
| T16c | todo | docs/T16c-test-report-and-process | - | `docs/` |

## Open questions
- Professor meeting: confirm goal (reproduce paper vs usable product), LLM expectation (image analysis + question generation), who reviews generated questions/KB scientifically, deadline and delivery format, how individual grades are assessed, whether the agent-assisted workflow is accepted.

## Project decisions (link ADRs when they exist)
JavaScript + React (no TypeScript) · Windows, no Docker, MongoDB installed locally · Gemini API (VPN available), no local LLM · 4 weeks, milestone end of week 3.
