---
name: git-workflow
description: Mandatory protocol for ALL git and GitHub work in this two-person repo - per-operator intake, identity checks, branch naming, Conventional Commits, push cadence, pull requests with Driver/Reviewer, merging, tags, Windows specifics, and mistake recovery. Use this skill whenever you are about to run any git command, create a commit, push, open or review a PR, or when anyone mentions GitHub, repository, commit, branch, merge, conflict, or version control.
---

# Git workflow (follow exactly)

## 1. Intake (each operator, once per machine). Ask in ONE message, wait for answers, never guess.
1. Which operator are you: A (repo owner) or B?
2. GitHub username? (B: has the invite from A been accepted?)
3. A only: repo name, public/private (suggest private), does it already exist? B only: repo URL to clone.
4. Name and email for commits (`git config user.name` / `user.email`, LOCAL to this repo). The email decides which GitHub account gets credit - it must be that person's own, used for their grade.
5. Auth: GitHub CLI (`gh auth login`, recommended) or SSH key. The operator performs the login in their own terminal. NEVER ask for or store a token/password in chat or files.
6. Shell: PowerShell 7 (`pwsh`) or Windows PowerShell 5.1? (5.1 has no `&&`.)
7. License (ask; if unsure do not add one yet).
Then verify: `git --version`, `gh --version`, `gh auth status`; set `git config core.autocrlf false`, `git config core.longpaths true`.

## 2. Repo bootstrap (A creates, B clones)
A: `git init -b main`, first commit, `gh repo create <owner>/<name> --private --source=. --remote=origin` (only after A confirmed), `git push -u origin main`, then add B as collaborator (GitHub UI: Settings -> Collaborators). B: `git clone <url>`, run intake, verify identity.
Branch protection for `main` (require PR + 1 approval) may be unavailable on a free private repo; if so the rule is social: nobody pushes directly to `main`, nobody merges their own PR before the other approves.

## 3. Daily start and branching
- Before working: `git switch main`, `git pull --rebase origin main`, check `gh pr list`.
- `main` is always green. One branch per task: `<type>/<TaskId>-<kebab-name>` (e.g. `feat/T03-auth-api`). Types: feat, fix, docs, test, refactor, chore, ci, build, perf. Keep branches short-lived (merge within 1-2 days); rebase on `main` daily: `git pull --rebase origin main`.

## 4. Commits (Conventional Commits)
`type(scope): imperative subject, max 72 chars, no period`. Scopes: api, web, engine, contracts, ml, docs, ci, repo, llm.
Examples: `feat(engine): add largest-remainder allocation`, `test(engine): cover zero-error fallback`, `fix(api): reject answers for images outside the session`.
- One logical change per commit; builds and passes lint/tests of what you touched. Rhythm: every 20-60 min. Body = WHY; add `Refs: T03`.
- Stage explicit paths, read `git status` and `git diff --staged` before committing. Never stage secrets, datasets, `.env`, `node_modules`.
- Never `--no-verify`. Pair sessions: add trailer `Co-authored-by: Name <email>` for the other person.
- The commit author is ALWAYS the human operator.

## 5. Push and PR (one PR per task)
1. Push often: `git push -u origin <branch>` then `git push`. Never `--force` (use `--force-with-lease` only after asking and only on your own branch).
2. Before the PR: `git pull --rebase origin main`; run lint, test, build.
3. `gh pr create --base main --head <branch> --title "<type>(scope): ..." --body-file <file>` using the PR template: Task, Driver, Reviewer, What/Why, How to test, Screenshots, Dependencies (package | version | why), Contract changes (yes/no), "What the reviewer must be able to explain".
4. The reviewer (other operator) reads the diff, runs the branch locally (`gh pr checkout <n>`), approves with comments (`gh pr review --approve` or GitHub UI). The reviewer must be able to explain the change in the defense.
5. Merge with a MERGE COMMIT (`gh pr merge <n> --merge`), not squash, so the step-by-step history stays visible. Then `git switch main`, `git pull --ff-only`, delete the branch.

## 6. Tags
After each weekly milestone: `git tag -a v0.<week>.0 -m "<summary>"` and `git push origin --tags`. Final: `v1.0.0`.

## 7. Conflicts and mistakes
- Conflict: do not guess. Show both sides to the operator, explain, propose a resolution, ask. Prefer rebasing small branches over big merges.
- Wrong message on an unpushed commit: `git commit --amend`.
- Secret or dataset committed: STOP. The operator rotates the key first; history rewriting only with explicit approval from both operators.
- Both operators touched the same file: the one who merges second resolves; tell the other.

## 8. Self-check before every push
Identity correct? `git status` clean? messages valid? no secrets in the diff? tests ran? PR claims match the board?
