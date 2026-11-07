---
name: review-workflow
description: Review protocol, quality gates, PR creation, independent AI review, and merge criteria for the repository. Use this skill whenever preparing a pull request, conducting an AI code review, verifying merge gates, or updating task statuses on the board.
---

# Review workflow and quality gates

## 1. Pull Request preparation
1. Ensure the feature branch is up to date with `main`: `git pull --rebase origin main`.
2. Verify local quality gates: `npm run lint`, `npm test`, and `npm run build`.
3. Open the pull request using `.github/pull_request_template.md`:
   - Fill in Task ID and Branch.
   - Summarize What and Why.
   - Include empirical command verification evidence for each acceptance criterion in the task file.
   - Explicitly note any contract changes in `@radiology/contracts`.

## 2. Progress board tracking (`docs/PROGRESS.md`)
- Update the task row in `docs/PROGRESS.md` to `in-review` when the PR is opened.
- Detailed developer notes and execution results belong in `docs/progress/developer-log.md`.
- When merged, update the row status to `merged` with the PR number.

## 3. Contracts first
- Shared schemas, interfaces, and shapes are defined in `packages/contracts` using Zod schemas and JSDoc typedefs.
- Contracts are merged to `main` before dependent features are implemented.
- Any modification to contracts must be highlighted in the PR description and justified.

## 4. Independent AI review
Every PR undergoes an independent AI code review in a fresh chat session:
- **Prompt:** Use a strict reviewer prompt instructed to inspect the branch diff against `main` for security vulnerabilities, contract regressions, untested paths, label/dataset leakage, and scope creep.
- **Classification of findings:**
  - **Blocker:** Architecture violation, broken tests, security vulnerability, data leakage, contract regression, or failed acceptance criteria. Must be resolved before merging.
  - **Fix-small:** Minor edge cases, missing docs, or small refactors. Resolved before merge or in an immediate follow-up commit.
  - **Defer:** Non-critical technical debt documented for a future milestone.
  - **Ignore:** Intentional trade-off or false positive justified in the PR notes.

## 5. Merge gate
A pull request may be merged to `main` ONLY when ALL of the following are satisfied:
1. CI checks pass completely on GitHub Actions (`gh pr checks <pr_number>`).
2. Local quality gates pass (`npm run lint`, `npm test`, `npm run build`).
3. Acceptance criteria are demonstrated with empirical command output.
4. Independent AI review findings have zero unresolved Blockers.
5. The developer confirms merge: `gh pr merge <pr_number> --merge`.
