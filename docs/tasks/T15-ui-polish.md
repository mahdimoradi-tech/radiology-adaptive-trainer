# T15 - UI polish pass (all screens)

- Branch: `style/T15-ui-polish`
- Depends on: T14 Part C finished (no open Blocker/Major bugs), so that bug fixes do not collide with style changes.
- Type: web styling and small markup changes ONLY. No new features, no API/contract changes, no new pages, no behaviour changes.
- Estimate: 6-8 h in 3-4 sessions (audit 1 h, tokens and shared components 2 h, screens 3-4 h, final check 1 h).
- Skills to read first: persian-rtl-ui, review-workflow. Docs: `docs/qa/UI-CHECKLIST.md` (the rules AND the screen table), ADR 0009, ADR 0011.

## Goal
Remove the visible roughness of the finished UI: low-contrast text that cannot be read, missing margins/padding (for example a button touching a section divider, a select arrow touching the border), RTL spacing errors and missing empty/loading/error states. Fix the causes once in tokens and shared components, then walk through every screen.

## Context (verified facts, do not re-discover)
- 19 page components exist under `apps/web/src/pages/{auth,resident,instructor,system}` (see the table in UI-CHECKLIST.md) plus layouts and navigation.
- Stack: React 19, Vite 8, Tailwind 4 (RTL with logical classes), Vazirmatn font, i18next (no hard-coded UI strings). An RTL logical-class scanner test already exists in the web tests (find it with `git grep -n -i "rtl" apps/web/src --include=*.test.*`).
- The previous agent could not see the screen. Mahdi reviews every screen in the browser; screenshots stay OUTSIDE git.

## Hard rules
- Behaviour must not change: all existing tests (727 reported; run `npm test` to get the real number) still pass without editing their expectations. Changing a test only because a class name changed is allowed when the test checks markup; say so in the commit body.
- Use Tailwind logical utilities only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`). No inline pixel styles, no `!important`, no new dependencies, no new fonts.
- Do not edit i18n text content (wording) except where the checklist needs a missing empty/error message; add keys to BOTH language files.
- One commit per logical change; do not mix tokens, components and screens in one commit.

## Steps

Step 0 - Static audit (no code change). Search `apps/web/src` for candidate problems and write `docs/qa/UI-AUDIT.md` with a table `file:line | problem | proposed fix | screen`: (a) low-contrast text classes (`text-(gray|slate|zinc|neutral|stone)-(300|400)`, `text-white/..`, `opacity-50/60` on text, placeholder colors); (b) buttons directly after a border/divider without `mt-`/`pt-`; (c) `<select` without `appearance-none` or without padding-end; (d) physical classes that slipped past the scanner (`left-`, `right-`, `ml-`, `mr-`, `pl-`, `pr-`, `text-left`, `text-right`); (e) pages without loading/empty/error branches (look for `isLoading`, `isError`, empty arrays). Commit: `docs(qa): add UI audit`. STOP and show Mahdi the table size; he may add items from his own screen review (he will append rows under "Found by Mahdi").

Step 1 - Tokens. Define the colour and spacing tokens in the Tailwind 4 theme (find where `@theme` is declared; do not guess the file) so that: body text, muted text, border, surface, primary, danger, success have contrast of at least 4.5:1 against their backgrounds (compute with the WCAG formula and write the measured ratios in the commit body). Replace every low-contrast class from the audit by the token. Commit: `style(web): define accessible colour and spacing tokens`.

Step 2 - Shared components. Fix once, in this order (check which exist; do not create new components unless duplicated markup appears in 3+ places): Button (min height 40px, padding, hover/focus-visible/disabled/loading), Input, Select (rule A4 of the checklist: wrapper + chevron icon, `appearance-none ps-3 pe-10`), Card, Section/Divider (rule A2), Badge, Empty/Loading/Error states, page container. Commit per component group: `style(web): fix Button and Input`, `style(web): fix Select`, `style(web): fix Card, section and divider spacing`.

Step 3 - Guard test. Extend the existing class-scanner test (same pattern as the RTL scanner) with a second scan that FAILS when a forbidden low-contrast class from the audit list appears in `apps/web/src` (exclude tests and an explicit allow-list file with a comment per entry). Commit: `test(web): add low-contrast class scanner`.

Step 4 - Screens, one commit per screen group, in this order: (1) auth + system pages; (2) resident home, tests list; (3) quiz; (4) report + review; (5) practice home + practice set; (6) progress + education; (7) instructor home + residents + resident detail; (8) instructor review panel; (9) catalog; (10) shell/navigation/mobile menu. For each group: apply checklist sections A and B, add missing loading/empty/error states, then STOP and ask Mahdi to look at the listed routes at 1366x768, 1920x1080 and 390x844 and to fill the sign-off table in UI-CHECKLIST.md (section C). Fix what he reports in a follow-up commit before moving on. Commits: `style(web): polish <screen group>`.

Step 5 - Final. `npm run lint`, `npm test`, `npm run build` (report the bundle size line). Ask Mahdi to run Lighthouse (Chrome DevTools, mode Navigation, category Accessibility, desktop) on: login, resident home, quiz, report, instructor review, catalog; target score 95 or higher on each; paste the six scores in the PR body together with any remaining failed audits (do not hide them). `/finish-task`.

## Verification commands (paste real output in the PR body)
```powershell
git grep -n -E "text-(gray|slate|zinc|neutral|stone)-(300|400)" -- apps/web/src
git grep -n -E "(^|[^a-z-])(ml|mr|pl|pr)-[0-9]|text-(left|right)([^a-z-]|$)|(^|[^a-z-])(left|right)-[0-9]" -- apps/web/src ":!*.test.*"
git grep -n "<select" -- apps/web/src ":!*.test.*"
npm run lint
npm test
npm run build
git diff --stat main
```
Expected: first two print nothing (or only allow-listed lines explained in the PR body); every `<select` hit uses the shared Select component or has `appearance-none`; `git diff --stat main` shows only `apps/web/src`, `docs/qa/` and test files.

## Acceptance criteria
1. `docs/qa/UI-AUDIT.md` exists and every row has status fixed or a written reason.
2. All 19 screens signed off by Mahdi at the three viewports (section C filled).
3. Every normal text/background pair in the tokens measures at least 4.5:1 (ratios recorded).
4. The new low-contrast scanner test passes and the RTL scanner still passes.
5. Select, buttons and dividers follow rules A2-A4 on every screen (spot-check: report, quiz, instructor review panel, catalog).
6. Lighthouse Accessibility is 95+ on the six listed pages or the exceptions are explained.
7. Zero behaviour change: no changes under `apps/api`, `packages`, `ml`; `npm test` passes; no test deleted.

## Out of scope
New features, redesign, dark mode, animations, new fonts or icon sets, code-splitting (ISS-06), translating to English, backend changes.
