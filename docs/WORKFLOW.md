# Development workflow

This document defines the official engineering workflow for the repository. All design, implementation, testing, and reviews proceed through this process.

---

## 1. Task lifecycle

Every unit of work follows a strict, traceable lifecycle:
1. **Task specification:** Read and follow the corresponding task file in `docs/tasks/Txx-*.md`.
2. **Branching:** Create an isolated feature branch named `type/Txx-kebab-name` (e.g., `feat/T03-api-foundation`, `docs/T12-solo-docs-cleanup`) from an up-to-date `main`.
3. **Incremental progress:** Make frequent, small Conventional Commits (`type(scope): subject`). Every commit must build and pass relevant linting and unit tests.
4. **Pull Request:** Open a pull request using `.github/pull_request_template.md`. Clearly state the task ID, branch, summary of changes, and contract impacts.
5. **Review:** Execute the review process outlined in Section 3.
6. **Merge commit:** Merge the PR using a standard merge commit (`gh pr merge <pr_number> --merge`), preserving the fine-grained commit history.

---

## 2. Merge gate

A Pull Request may be merged to `main` **ONLY** when **ALL** of the following conditions are strictly satisfied:
1. **CI is Green:** `gh pr checks <pr_number>` passes completely on GitHub Actions.
2. **Local Quality Gates Pass:** `npm run lint`, `npm test`, and `npm run build` pass locally with real verification output.
3. **Acceptance Criteria Met:** Every acceptance criterion specified in the task file is demonstrated with empirical command evidence in the PR body.
4. **Self-Review Completed:** Verification checklists are executed and documented in the PR.
5. **Independent AI Review:** An AI code review is conducted in a fresh chat session examining diffs, potential bugs, edge cases, and design purity.
6. **Developer Confirmation:** The developer explicitly verifies the checks and confirms merge.

---

## 3. Review

Every PR undergoes a rigorous independent AI review in a fresh chat session:
- **Reviewer role:** The AI is prompted with a strict reviewer persona instructed to scrutinize the full branch diff against `main`.
- **Classification of findings:**
  - **Blocker:** Architectural violations, contract regressions, unhandled security issues, data leakage, broken tests, or unmet acceptance criteria. Must be resolved before merge.
  - **Fix-small:** Minor edge cases, missing docs, or small refactors. Resolved in the current PR or batched into an immediate cleanup commit.
  - **Defer:** Valid enhancements or non-critical debt documented as an issue for a subsequent phase.
  - **Ignore:** False positives or intentional design trade-offs justified in the PR notes.

---

## 4. Rules

The following core engineering rules are non-negotiable:
- **No Direct Push to `main`:** All work must proceed via feature branches. The pre-push hook prevents direct pushes to `main`.
- **No Force Pushing:** Never run `git push --force` or `--no-verify`. Use `--force-with-lease` only when explicitly rebasing your own local branch before PR creation.
- **Merge Commit, Never Squash:** All PRs are merged using `--merge` to maintain full, verifiable commit audit trails.
- **Conventional Commits:** Commit messages strictly follow the Conventional Commits specification with recognized scopes (`api`, `web`, `engine`, `contracts`, `ml`, `docs`, `ci`, `repo`, `llm`, `agents`).
- **Zero Secrets / Zero Bloat:** Never commit `.env`, API keys, credentials, raw datasets, medical images, or model binaries.
- **Tests First:** Write tests before or alongside implementation; never weaken or delete existing tests to force a pass.

---

## 5. History

The project was initially planned for a team of two. The second member did not take part, so all design, development, review and testing work was done by the repository owner (Mahdi Moradi), assisted by an AI coding agent.
