# Operator A log (repo owner)

Name (as in git): Mahdi Moradi · GitHub: mahdimoradi-tech · Daily sync time: TBD

## Environment (no secrets)

OS/shell: Windows 11 / PowerShell 5.1 · Node/npm: v24.11.0 / 11.21.1 · MongoDB/mongosh: 8.3 / 2.13.0 · Python/uv: Python 3.11.0 (Python 3.12 + uv pending T01) · Antigravity skills/workflows visible: yes · paper.pdf: present

## Current task

- T00: Team bootstrap (Driver Part 1)

## Done (newest first)

- Initialized Git repository, main branch, and pushed to GitHub (`mahdimoradi-tech/radiology-adaptive-trainer`).
- Configured monorepo workspaces (`packages/*`, `apps/*`), ESLint flat config, Prettier, and Vitest.
- Created package skeletons for `@radiology/contracts` and `@radiology/engine` with smoke tests.
- Set up Husky 9 hooks: conventional commitlint (scoped), lint-staged, and branch protection hook (`no-push-main.js`).
- Created GitHub Actions CI workflow (MongoDB 8 service, Node 24, test/lint/build) and PR template.

## Decisions and why

- Temporary exception: solo mode (Date: 2026-10-24, Reason: Operator B is temporarily unavailable; Operator A switches to solo mode through at least T03 per `docs/SOLO-MODE.md` to keep project moving forward without stalling).
- Stack: Pure JavaScript ESM (no TypeScript) so both operators can fully understand and defend every line.
- Native Windows installation (no Docker) with local MongoDB service.
- Prevent pushes to `main` branch via pre-push hook to enforce PR review workflow.

## Things I must be able to explain at the defense

- How the npm workspaces monorepo links `@radiology/contracts` to `@radiology/engine`.
- Why conventional commit enforcement and branch protection were put in place.
- Structure of the CI workflow and how MongoDB tests run in GitHub Actions.

## Open questions

- Daily sync schedule with Operator B (Abolfazl).
- Professor meeting agenda and delivery expectations.
