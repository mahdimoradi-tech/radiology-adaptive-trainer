---
name: team-collaboration
description: Rules for two students working in parallel, each with their own AI agent - task claims on the board, driver/reviewer rotation, contracts-first workflow, folder ownership per task, daily sync, avoiding merge conflicts, sharing non-git data (images, question bank), PR review checklist, and individual-contribution tracking. Use this skill at the start of every task, whenever you plan which files to touch, when two tasks may overlap, when sharing data between machines, or when anyone mentions teammate, partner, review, claim, conflict, or grading.
---

# Team collaboration (Operator A + Operator B)

## Roles
- **Driver** of a task: claims it, runs the agent, writes the code, opens the PR. **Reviewer**: the other operator; reads, runs and approves. Roles rotate per task (see `docs/ROADMAP.md`); each operator must drive at least one task in each area: ML, engine, API, web, LLM.
- The reviewer is not a rubber stamp: before approving, they must be able to explain what the change does and why. If they cannot, they ask the driver (or their own agent: "explain this diff in simple Persian") until they can.

## Board and claims (`docs/PROGRESS.md`)
A table with one row per task: `Task | Driver | Reviewer | Status | Branch | PR | Files/folders touched`. Statuses: `todo`, `claimed`, `in-progress`, `in-review`, `merged`. Claim = edit only YOUR task row in the task's first commit. Never edit another person's row. Details/notes go to your own log `docs/progress/operator-<a|b>.md` to avoid conflicts.

## Contracts first
Anything shared (API request/response shapes, DB document shapes, engine inputs/outputs, LLM output schemas) is defined FIRST in `packages/contracts` as Zod schemas + JSDoc typedefs and merged to `main` before the two sides implement against it. A PR that changes a contract must say so in the PR template and the other operator must approve it explicitly. Parallel work is only allowed when the contract exists.

## Avoiding conflicts
- One task = specific folders (listed in the task file and in the board row). Do not touch folders owned by an open task of the other operator.
- Shared hot files (root `package.json`, `package-lock.json`, `eslint.config.js`, `AGENTS.md`, i18n files): change them in small dedicated PRs, merge quickly, tell the other operator. Run `npm install` only inside your task's scope; if the lockfile conflicts, regenerate it from `main` and re-apply your dependency additions.
- i18n JSON: add keys in a task-specific namespace file (`src/i18n/locales/fa/<feature>.json`) instead of one big file.
- Pull `main` daily; keep PRs small (< ~400 changed lines where possible).

## Daily rhythm
5-10 minute sync (chat/call): what I finished, what I start, what blocks me, what I need reviewed. Two pairing sessions per week on hard parts (ML pipeline, engine, LLM guardrails): screen-share, one drives, both read the output; the commit gets `Co-authored-by`.

## Sharing things that are not in git
- Catalog images (`data/catalog/images`, ~1,500 files): the operator who ran the ML pipeline zips `data/catalog` and shares it out-of-band (Drive/USB); the other runs `npm run data:install -- <zip>`. Never commit images.
- Approved question bank: exported to `apps/api/seed/question-bank.approved.json` (text only, committed) with `npm run bank:export`; the other operator imports with `npm run bank:import`.
- Secrets: each operator has their own `.env` and own Gemini API key; share only `.env.example`.

## Review checklist (reviewer)
Acceptance criteria met? Tests meaningful (not trivial)? Contract respected? No scope creep? No secrets/data committed? i18n keys used, RTL safe? Docs/board updated? Commit history clean and authored by the driver? Can I explain this change?

## Individual grading support
Each PR records Driver and Reviewer. Commits keep each human's identity. At the end (T11) run `node scripts/contributions.js` to generate `docs/CONTRIBUTIONS.md` from git log + `gh pr list` (commits, lines, PRs driven/reviewed per person, per area). Do not edit it by hand.
