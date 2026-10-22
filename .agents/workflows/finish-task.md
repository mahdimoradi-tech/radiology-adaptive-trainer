# /finish-task

1. Run, one per line, with real output: `npm run lint`, `npm test`, `npm run build` (and `uv run pytest`, `uv run ruff check` if `ml/` changed). Fix failures; same failure twice -> STOP and report.
2. Re-read the task's acceptance criteria; mark each with evidence (command + output or file path).
3. Update your row in the `docs/PROGRESS.md` board and your log `docs/progress/operator-<a|b>.md`; update README/ADR if the task requires.
4. Following `git-workflow`: stage explicitly, read `git diff --staged`, commit (Conventional Commits, your identity), `git pull --rebase origin main`, push, open the PR with the template: fill Driver (this operator), Reviewer (the other operator), what/why/how to test, dependencies added with exact versions, "what the reviewer must understand".
5. Send the final report (Persian, format in `AGENTS.md` section 8) with the PR URL. Do NOT merge your own PR before the other operator approved it.
