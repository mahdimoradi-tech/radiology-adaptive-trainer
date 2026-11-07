# /finish-task

1. Run, one per line, with real output: `npm run lint`, `npm test`, `npm run build` (and `uv run pytest`, `uv run ruff check` if `ml/` changed). Fix failures; same failure twice -> STOP and report.
2. Re-read the task's acceptance criteria; mark each with evidence (command + output or file path).
3. Update the task row in `docs/PROGRESS.md` to `in-review` and update `docs/progress/developer-log.md`; update README/ADR if the task requires.
4. Following `git-workflow`: stage explicitly, read `git diff --staged`, commit (Conventional Commits, your identity), `git pull --rebase origin main`, push, open the PR with the template: fill task ID, branch, what/why/how to test, dependencies added with exact versions, contract changes.
5. Conduct independent AI review in a fresh chat session with the strict reviewer prompt; verify zero unresolved Blockers.
6. Send the final report (Persian, format in `AGENTS.md` section 8) with the PR URL. Verify merge gates before merging with `--merge`.
