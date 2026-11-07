---
name: git-workflow
description: Mandatory protocol for ALL git and GitHub work in this repository - identity checks, branch naming, Conventional Commits, push cadence, pull requests, independent AI review, merging, tags, Windows specifics, and mistake recovery. Use this skill whenever you are about to run any git command, create a commit, push, open or review a PR, or when anyone mentions GitHub, repository, commit, branch, merge, conflict, or version control.
---

# Git workflow (follow exactly)

## 1. Developer verification
1. Verify commit identity locally (`git config user.name` / `user.email`). Commits must belong to the repository owner (Mahdi Moradi).
2. Auth: GitHub CLI (`gh auth login`, recommended) or SSH key. The developer performs the login in their own terminal. NEVER ask for or store a token/password in chat or files.
3. Shell: PowerShell 7 (`pwsh`) or Windows PowerShell 5.1 (5.1 has no `&&`).
4. Windows Git settings: `git config core.autocrlf false`, `git config core.longpaths true`.

## 2. Main branch protection
- Direct pushes to `main` are blocked by the pre-push hook (`no-push-main.js`).
- All work merges to `main` through Pull Requests only after quality gates pass.

## 3. Daily start and branching
- Before working: `git switch main`, `git pull --rebase origin main`, check `gh pr list`.
- `main` is always green. One branch per task: `<type>/<TaskId>-<kebab-name>` (e.g. `feat/T03-auth-api`). Types: feat, fix, docs, test, refactor, chore, ci, build, perf. Keep branches short-lived; rebase on `main` before PR: `git pull --rebase origin main`.

## 4. Commits (Conventional Commits)
`type(scope): imperative subject, max 72 chars, no period`. Scopes: api, web, engine, contracts, ml, docs, ci, repo, llm.
Examples: `feat(engine): add largest-remainder allocation`, `test(engine): cover zero-error fallback`, `fix(api): reject answers for images outside the session`.
- One logical change per commit; builds and passes lint/tests of what you touched. Rhythm: every 20-60 min. Body = WHY; add `Refs: T03`.
- Stage explicit paths, read `git status` and `git diff --staged` before committing. Never stage secrets, datasets, `.env`, `node_modules`.
- Never `--no-verify`.
- The commit author is ALWAYS the human developer (Mahdi Moradi).

## 5. Push and PR (one PR per task)
1. Push often: `git push -u origin <branch>` then `git push`. Never `--force` (use `--force-with-lease` only after asking and only on your own branch before PR).
2. Before the PR: `git pull --rebase origin main`; run lint, test, build.
3. `gh pr create --base main --head <branch> --title "<type>(scope): ..."` using the PR template.
4. Independent AI review is conducted in a fresh chat session with the strict reviewer prompt; inspect diffs, test coverage, and security boundaries.
5. Merge with a MERGE COMMIT (`gh pr merge <n> --merge`), not squash, so the step-by-step history stays visible. Then `git switch main`, `git pull --ff-only`, delete the local and remote feature branch.

## 6. Tags
After each milestone: `git tag -a v0.<week>.0 -m "<summary>"` and `git push origin --tags`. Final: `v1.0.0`.

## 7. Conflicts and mistakes
- Conflict: do not guess. Show both sides to the developer, explain, propose a resolution, ask. Prefer rebasing small branches over big merges.
- Wrong message on an unpushed commit: `git commit --amend`.
- Secret or dataset committed: STOP. The developer rotates the key first; never attempt history rewriting without explicit developer confirmation.

## 8. Self-check before every push
Identity correct? `git status` clean? messages valid? no secrets in the diff? tests ran? PR status matches the board?
