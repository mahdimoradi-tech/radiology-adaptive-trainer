# /sync

Run at the start of every work session and before opening a PR. Explain results in Persian.
1. `git status --short`. If there are uncommitted changes, STOP and ask the operator whether to commit or stash (never discard).
2. Remember the current branch (`git branch --show-current`). Run `git fetch origin`, then `git switch main`, then `git pull --rebase origin main`.
3. Show what changed on `main` since the operator's last session: `git log --oneline -15`. Highlight changes to `packages/contracts`, `AGENTS.md`, `docs/PROGRESS.md`, root `package.json`.
4. Run `gh pr list` and show open PRs, authors and reviewers. Warn if an open PR touches folders of the operator's current task.
5. If the operator was on a task branch: `git switch <branch>` then `git rebase main`. On conflicts STOP: show the conflicting hunks, explain both sides, propose a resolution, ask. Never use `--force` pushes; if the branch was already pushed, use `git push --force-with-lease` ONLY after the operator approves.
6. If `package-lock.json` changed on `main`: run `npm install` (reports changes only; never edit the lockfile by hand).
7. Show the board rows of `docs/PROGRESS.md` and recommend the next action.
