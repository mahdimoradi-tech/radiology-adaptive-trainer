# T12 - Documentation cleanup and workflow alignment

- Branch: `docs/T12-solo-docs-cleanup`
- PR: #23
- Type: Documentation and agent configuration update only.

## Goal
Establish a single-developer documentation baseline and aligned engineering workflow across all project guides, task records, and agent definitions, while preserving all technical decisions, empirical findings, and test gates.

## Renamed and deleted files
- Renamed workflow specification to `docs/WORKFLOW.md`.
- Renamed ADR 0003 to `docs/adr/0003-development-workflow.md`.
- Renamed developer progress record to `docs/progress/developer-log.md`.
- Deleted unused secondary template log in `docs/progress/`.
- Renamed skill directory to `.agents/skills/review-workflow/`.
- Updated all links and references across repository files.

## Summary of acceptance criteria met
1. Verification searches for legacy workflow terms and local system file paths return clean results across the repository.
2. Development workflow document defines task lifecycle, merge gate criteria, and review steps.
3. Repository instructions and workflows reflect the unified development process.
4. Progress board updated with current release state and upcoming milestone items.
5. All automated quality checks (lint, tests, and production build) pass with zero code modifications under functional application packages.
