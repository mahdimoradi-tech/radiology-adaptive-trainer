# T12 - Solo-project documentation cleanup

- Branch: `docs/T12-solo-docs-cleanup`
- Depends on: T11 merged (PR #21, merge commit c546152 on main).
- Type: docs + agent-rules edit ONLY. NO code changes (apps/, packages/, ml/, scripts/ stay untouched).
- Estimate: 1.5-2 h.
- Skills to read first: git-workflow, team-collaboration (you will rename it in this task).

## Goal
Every document and agent rule in the repository must describe the project as built by ONE developer (Mahdi Moradi, repository owner) with an AI coding agent. Remove all instructions and records that assume a second person: task claims, cross-review, "other operator" approvals, operator logs. Keep every factual statement, number, decision and rule that is still valid.

## Context (verified facts, do not re-discover)
- `git grep -il -E "operator|partner|collaborat"` matches 52 files (about 107 hits of "operator", 46 "operator A", 26 "operator B", 15 "team-collaboration").
- `.github/pull_request_template.md` contains the partner's first name.
- Two files contain local Windows links `file:///d:/university/...` (find them with `git grep -l "file:///"`).
- `docs/PROGRESS.md` still shows T11 as `in-review`, but PR #21 is merged.
- Files to rename: `docs/SOLO-MODE.md`, `docs/adr/0003-team-workflow.md`, `docs/progress/operator-a.md`, skill folder `.agents/skills/team-collaboration`. File to delete: `docs/progress/operator-b.md`.
- `git shortlog -sn --all` = 196 commits, all by Mahdi Moradi. NEVER rewrite history (no rebase of main, no force push).

## Replacement rules (apply with judgement, never blind sed)
- R1: "Operator A", "Operator A (Mahdi)", "operator A" -> "the developer" (or "Mahdi" in logs and PR text).
- R2: bullets, sentences, table rows or sections whose only purpose is the other person (claims, rows owned by B, other-operator approval, cross-review, `operator-b`, the partner's first name) -> DELETE.
- R3: "both operators", "the other operator reviews", "both must approve" -> remove. Where a review step is described, use: "independent AI review in a fresh chat (strict reviewer prompt) + CI green + local gates".
- R4: "operator" meaning the person who runs scripts ("operator checklist") -> "developer".
- R5: "operator" with a technical meaning (MongoDB `$` operators, comparison operators) -> leave unchanged.
- R6: Historical files (`docs/tasks/T00..T11`, `docs/tasks/pr-*-body.md`, ADRs 0001-0014): change wording only. NEVER change numbers, dates, PR numbers, decisions, acceptance criteria or test counts.
- Allowed exceptions: ONE sentence in `docs/WORKFLOW.md`, section "History" (see Step 1), and the two files that describe this cleanup itself (`docs/tasks/T12-solo-docs-cleanup.md`, `docs/tasks/BATCH4-NOTES.md`); do not edit those two.

## Steps (one commit per step; Conventional Commits)

Step 0 - Inventory (no commit). Run `git grep -n -i -E "operator|partner|collaborat|team-collaboration|abolfazl|file:///"` and read each hit IN CONTEXT. Do not commit the inventory.

Step 1 - Workflow doc. `git mv docs/SOLO-MODE.md docs/WORKFLOW.md`. Read it fully first, then rewrite as "Development workflow" with sections: 1 Task lifecycle (task file -> branch `type/Txx-name` -> small Conventional Commits -> PR -> review -> merge commit), 2 Merge gate (keep ALL still-valid conditions: CI green, `npm run lint`/`npm test`/`npm run build` pass with real output, every acceptance criterion shown with command evidence), 3 Review (independent AI review in a fresh chat with the strict reviewer prompt; findings classified Blocker / Fix-small / Defer / Ignore), 4 Rules (no direct push to main, no force push, no `--no-verify`, merge commit never squash, no secrets, no datasets in git), 5 History: exactly this one sentence: "The project was initially planned for a team of two. The second member did not take part, so all design, development, review and testing work was done by the repository owner (Mahdi Moradi), assisted by an AI coding agent." Commit: `docs: replace solo-mode protocol with development workflow`.

Step 2 - ADR 0003. `git mv docs/adr/0003-team-workflow.md docs/adr/0003-development-workflow.md`. Rewrite title to "Development workflow", keep Status Accepted, keep the decisions that are still valid (branching, commits, PR, merge commits, ADR habit), remove team-specific decisions. Update every link to the old filename (`git grep -n "0003-team-workflow"` must return nothing). Commit: `docs(adr): rename ADR 0003 to development workflow`.

Step 3 - Logs. `git mv docs/progress/operator-a.md docs/progress/developer-log.md` and apply R1-R4 inside. Read `docs/progress/operator-b.md`; if it holds ANY project fact not present elsewhere, STOP and tell Mahdi; otherwise `git rm` it. Update all links (`git grep -n "docs/progress/operator"`). Commit: `docs: keep a single developer log`.

Step 4 - Skill. `git mv .agents/skills/team-collaboration .agents/skills/review-workflow`. Update the frontmatter `name:` and `description:` and rewrite the body for ONE developer: fill the PR template, update the board row in `docs/PROGRESS.md`, run the independent AI review in a fresh chat, classify findings, merge gate. Update the skills list in AGENTS.md and every other reference (`git grep -n "team-collaboration"` must return nothing). Commit: `chore(agents): replace team-collaboration skill with review-workflow`.

Step 5 - AGENTS.md and workflows. Edit AGENTS.md (the lines that mention operators: roughly lines 8, 12-14, 18, 50-51, 56, 64, 67): line 8 becomes "SINGLE DEVELOPER: Mahdi (repository owner)..." keeping the machine/skill description; replace the SOLO MODE line and the "Which operator are you" question with: read `docs/WORKFLOW.md` at session start; verify `git config user.name` and `user.email` belong to the repository owner; never commit as "agent". Rule "only a task claimed by this operator" -> "only a task listed in `docs/PROGRESS.md`". Remove the other-operator PR clause. The new-chat reading order becomes: `AGENTS.md` -> `docs/PROGRESS.md` -> `docs/progress/developer-log.md` -> the task file. Then apply the same to `.agents/workflows/sync.md`, `start-task.md`, `finish-task.md`, `status.md` (no Driver/Reviewer, no "claim"; start-task sets the row to in-progress). Also check the other skills (git-workflow, llm-feedback, ml-difficulty-pipeline). Commit: `chore(agents): update rules and workflows for a single developer`.

Step 6 - Board. Rewrite `docs/PROGRESS.md`: columns `Task | Status | Branch | PR | Folders touched` (drop Driver and Reviewer); keep every existing row fact; set T11 to `merged`, PR #21; add rows T12, T13, T14, T15, T16a, T16b, T16c with status `todo` (branches: `docs/T12-solo-docs-cleanup`, `chore/T13-data-seeds`, `chore/T14-qa-security`, `style/T15-ui-polish`, `docs/T16a-srs`, `docs/T16b-sdd`, `docs/T16c-test-report-and-process`). Keep the professor-meeting question; delete questions about the other person; rename "Team decisions" to "Project decisions" and delete "both operators drive every area". Commit: `docs: rewrite progress board for a single developer and add T12-T16`.

Step 7 - PR template. In `.github/pull_request_template.md` replace the "Task & Team" section with "Task" (Task ID + Branch only); replace the contract line with: "Contract changed? [ ] Yes [ ] No. If yes, list the changed schemas in `packages/contracts` and add or update an ADR." Commit: `chore(github): simplify pull request template`.

Step 8 - Core docs. Apply the rules in README.md, apps/api/README.md, docs/ROADMAP.md (remove any owner/operator assignment columns), docs/TOOLCHAIN.md, docs/DATA-SOURCES.md, docs/DEMO-SCRIPT.md, docs/LLM-RUNBOOK.md, docs/KNOWN-ISSUES.md (ISS-05: "a single technical operator (system author)" -> "a single reviewer (the system's author)"). Commit: `docs: neutralize team wording in core documents`.

Step 9 - Task files. Same rules in `docs/tasks/T00..T11*.md`, `pr-*-body.md`, `BATCH2-NOTES.md`, `BATCH3-NOTES.md` (R6 applies). Commit: `docs(tasks): neutralize team wording in historical task files`.

Step 10 - ADRs 0001-0014 (R6). Commit: `docs(adr): neutralize team wording in ADRs`.

Step 11 - Local links. Replace every Markdown link of the form `[text](file:///d:/.../path#Lnn)` with plain text `path:Lnn` relative to the repo root (for example `apps/api/scripts/analysis-run.js:32`). Do not re-verify line numbers (out of scope). Commit: `docs: replace local file links with repo-relative references`.

Step 12 - Finalize this record (last commit, after the verification below passed once with the two exclusions). Rewrite `docs/tasks/T12-solo-docs-cleanup.md` into a SHORT historical record (goal, list of renamed/deleted files, acceptance criteria summary, PR number) that does not contain the words searched by the verification regex or any person's name. In `docs/tasks/BATCH4-NOTES.md` replace the table row that counts team-related mentions with: "Docs contained team-workflow wording and local file links (cleaned in T12)". Then run the verification greps again WITHOUT the two `:!docs/tasks/...` exclusions; they must print nothing (only `docs/WORKFLOW.md` may match). Commit: `docs(tasks): finalize T12 record`.

## Verification (run and paste the real output in the PR body)
```powershell
git grep -n -i -E "operator [ab]([^a-z]|$)|operator-[ab]|partner|collaborat|team-collaboration|abolfazl|both operators|team of two|SOLO-MODE|solo mode|\(solo\)|0003-team-workflow" -- . ":!docs/WORKFLOW.md" ":!docs/tasks/T12-solo-docs-cleanup.md" ":!docs/tasks/BATCH4-NOTES.md"
git grep -n "file:///"
git grep -n -i "operator" -- . ":!docs/tasks/T12-solo-docs-cleanup.md" ":!docs/tasks/BATCH4-NOTES.md"
git diff --name-only main | Select-String "^(apps|packages|ml|scripts)/"
git ls-files docs/progress docs/WORKFLOW.md docs/SOLO-MODE.md
npm run lint
npm test
npm run build
```
Run them first with the exclusions shown; after Step 12 run them again without the two task-file exclusions. Expected: first, second and fourth commands print nothing; third prints ONLY technical uses (list each one in the PR body with file:line and why it stays); `git ls-files` shows `docs/WORKFLOW.md` and `docs/progress/developer-log.md` only; lint/test/build pass.

## Acceptance criteria
1. The verification greps return what is expected above.
2. `docs/WORKFLOW.md` contains exactly one "team of two" sentence (the History sentence) and the merge gate rules are preserved.
3. AGENTS.md, the 5 workflows and the skills list mention no second person; the skill `review-workflow` exists and AGENTS.md lists it.
4. `docs/PROGRESS.md` shows T11 merged (#21) and rows T12-T16c as `todo`.
5. `git diff --stat main` contains only `.md`, `.yml`/template and `.agents/` files. Zero changes under apps/, packages/, ml/, scripts/.
6. No numbers, dates, PR numbers or decisions changed in historical files (reviewer spot-checks 3 task files and 2 ADRs with `git diff`).

## Out of scope
Code changes; rewriting git history; deleting task files or ADRs; changing any decision; new features; editing `.env`; touching `docs/EVALUATION.md` (T13 does that).
