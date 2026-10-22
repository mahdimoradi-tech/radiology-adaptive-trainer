# 3. Two-person collaboration, review model, and contracts-first development

Date: 2026-10-22

## Status

Accepted

## Context

The capstone project is developed by a two-person team where each operator works on their own machine with individual grading criteria. Both operators must demonstrate deep familiarity across all project components (ML pipeline, adaptive engine, API, web frontend, and LLM integration).

## Decision

We establish the following collaboration rules:
1. **Driver / Reviewer Rotation:** Every task defined in `docs/ROADMAP.md` designates one operator as the Driver (who implements the feature and creates the pull request) and the other as Reviewer (who inspects, locally verifies, and approves the PR before merging). Roles rotate across all functional domains.
2. **Contracts First:** Any shared interfaces (HTTP schemas, database entity shapes, engine parameters, LLM structured outputs) are declared first in `packages/contracts` using Zod schemas and merged to `main` before dependent features are implemented.
3. **Shared Progress Board:** Task statuses and claims are tracked centrally in `docs/PROGRESS.md`. Each operator maintains a personal session log under `docs/progress/operator-<a|b>.md` to avoid merge conflicts.
4. **Git Branching and Commit Policy:** Direct commits to `main` are forbidden and enforced via Git pre-push hooks. Tasks use dedicated feature branches (`type/Txx-name`) with Conventional Commits, merged strictly via pull requests with merge commits.

## Consequences

- High cross-functional code ownership ensuring both students can defend any module.
- Elimination of schema divergence between API, UI, and engine.
- Clean, auditable Git history showing each contributor's verified role and commits.
