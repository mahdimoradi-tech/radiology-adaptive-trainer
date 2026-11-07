# /start-task <TaskId>

1. Verify `git config user.name` and `git config user.email` belong to the repository owner (Mahdi Moradi).
2. Read, in order: `AGENTS.md`, `docs/PROGRESS.md`, `docs/progress/developer-log.md`, `docs/tasks/<TaskId>-*.md` (whole file; if the file does not exist yet, STOP and tell the developer the task file must be written first).
3. Run `git switch main` then `git pull --rebase origin main`. Run `gh pr list` and check that no open PR touches the files this task will touch. Set the task row in `docs/PROGRESS.md` to `in-progress`.
4. List the skills from `.agents/skills/` this task needs and read them.
5. Check "Prerequisites" and "Human steps" of the task. If a human step is not done, tell the developer exactly what to do and wait.
6. Reply IN PERSIAN: (a) the goal in 3 lines, (b) a numbered plan (max 10 steps, each with its verification command), (c) the branch name, (d) open questions.
7. WAIT for "go". No code, no installs before that.
