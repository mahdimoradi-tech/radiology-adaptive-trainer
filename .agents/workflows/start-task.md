# /start-task <TaskId>

1. Ask: "Which operator are you (A or B)?" Run `git config user.name` and `git config user.email`; confirm they belong to that person.
2. Read, in order: `AGENTS.md`, `docs/PROGRESS.md`, `docs/progress/operator-<a|b>.md`, `docs/tasks/<TaskId>-*.md` (whole file; if the file does not exist yet, STOP and tell the operator the task file must be written first).
3. Run `git switch main` then `git pull --rebase origin main`. Run `gh pr list` and check that no open PR touches the files this task will touch. Check the board: the task must be claimed by this operator; if it is unclaimed, propose the claim edit (a one-row change in `docs/PROGRESS.md`, pushed in the task's first commit).
4. List the skills from `.agents/skills/` this task needs and read them.
5. Check "Prerequisites" and "Human steps" of the task. If a human step is not done, tell the operator exactly what to do and wait.
6. Reply IN PERSIAN: (a) the goal in 3 lines, (b) a numbered plan (max 10 steps, each with its verification command), (c) the branch name, (d) open questions.
7. WAIT for "go". No code, no installs before that.
