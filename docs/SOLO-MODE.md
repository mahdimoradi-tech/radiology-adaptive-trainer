# SOLO MODE PROTOCOL

**Status:** ACTIVE (Activated: 2026-10-24 by Operator A, repository owner)  
**Scope:** Through at least T03 (re-evaluated when reached or when Operator B returns)

This document establishes the official protocol for solo work by Operator A while Operator B is unavailable. It is an explicit repository owner decision and overrides any team-workflow rules requiring the other operator's simultaneous presence or approval.

---

## 1. Task Claims and Progress Board
- Operator A may claim and drive tasks previously assigned to Operator B (specifically T02 and T03 now, and subsequent tasks if reached before B returns).
- When claiming such tasks, only the `Driver`, `Reviewer`, and `Status` columns in `docs/PROGRESS.md` may be updated, marking them with `(solo)`.
- This provision explicitly overrides the general rule "never edit another person's row" in `docs/PROGRESS.md`.

## 2. Reviewer Role and Merge Gate
- The Reviewer column for solo tasks is designated as `none (solo)`.
- Operator A may merge their own Pull Request **ONLY** when **ALL** of the following conditions are strictly satisfied:
  1. **CI is Green:** `gh pr checks <pr_number>` passes completely on GitHub Actions.
  2. **Local Quality Gates Pass:** `npm run lint`, `npm test`, and `npm run build` pass with real verification output.
  3. **Acceptance Criteria Met:** Every acceptance criterion in the task file is demonstrated with empirical command evidence.
  4. **Self-Review Checklist Completed:** The review checklist from `team-collaboration` is executed and documented in the PR.
  5. **Independent AI Review:** An AI code review is conducted in a fresh chat session to examine diffs, potential bugs, edge cases, and design purity.
  6. **Human Approval:** Operator A explicitly types and confirms `merge`.

## 3. Strict Identity Integrity (Never Impersonate Operator B)
- **Zero Impersonation:** No Git commits may ever be authored under Operator B's name or email.
- **No False Approvals:** No statements or logs may claim that Operator B reviewed, verified, or approved the PR.
- **No False Co-authorship:** Never add `Co-authored-by: Abolfazl Rahmati ...` to commit trailers during solo mode.

## 4. Contract Changes
- Any modifications to `@radiology/contracts` during solo mode must be explicitly justified, highlighted, and approved by Operator A directly in the PR description.

## 5. Unchanged Core Quality Rules
The following non-negotiable rules remain fully in effect:
- **No Direct Push to `main`:** All work must proceed via feature branches (`type/Txx-name`). The pre-push hook remains active.
- **One PR per Task:** Every task has its own isolated PR.
- **Merge Commit:** All PRs are merged using standard merge commits (`--merge`), never squash or rebase, preserving fine-grained history.
- **Conventional Commits:** Commit messages must strictly follow the conventional commit format and scopes.
- **Zero Secrets / Zero Bloat:** Never commit `.env`, raw datasets, images, model binaries, or large files.
- **Tests First:** Write tests before or alongside implementation; never weaken or delete existing tests.
- **No Force Pushing:** Never run `git push --force` or `--no-verify`.

## 6. Onboarding Operator B Upon Return
When Operator B returns:
1. Operator B pulls the latest `main` branch.
2. Operator B reviews all merged solo PRs, studies the architectural diffs, and writes catch-up notes in `docs/progress/operator-b.md`.
3. Operator B takes ownership of the next available unclaimed tasks according to the roadmap.
