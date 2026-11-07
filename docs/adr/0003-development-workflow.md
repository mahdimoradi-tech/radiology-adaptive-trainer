# 3. Development workflow, quality gates, and contracts-first engineering

Date: 2026-10-22

## Status

Accepted

## Context

The capstone project requires rigorous engineering standards, transparent change tracking, reproducibility, and verified test gates across all components (ML pipeline, adaptive engine, API, web frontend, and LLM integration).

## Decision

We establish the following development and quality rules:
1. **Contracts First:** Any shared interfaces (HTTP schemas, database entity shapes, engine parameters, LLM structured outputs) are declared first in `packages/contracts` using Zod schemas and merged to `main` before dependent features are implemented.
2. **Quality Gates and Verification:** Every task must satisfy automated verification before merge: CI green, lint, test, and build passing, with zero regressions. Pull requests undergo rigorous independent review and empirical verification against all task acceptance criteria.
3. **Structured Tracking:** Task status is tracked centrally in `docs/PROGRESS.md`. Development progress and operational notes are maintained in `docs/progress/developer-log.md`.
4. **Git Branching and Commit Policy:** Direct commits to `main` are forbidden and enforced via Git pre-push hooks. Tasks use dedicated feature branches (`type/Txx-name`) with Conventional Commits, merged strictly via pull requests with merge commits.
5. **Architectural Decision Records (ADR):** Significant architectural and design decisions are documented in `docs/adr/` using the Michael Nygard template to maintain architectural integrity.

## Consequences

- Elimination of schema divergence between API, UI, and engine.
- Clean, auditable Git history showing verified commits and quality gate compliance.
- Strict prevention of regressions and contract drift.
