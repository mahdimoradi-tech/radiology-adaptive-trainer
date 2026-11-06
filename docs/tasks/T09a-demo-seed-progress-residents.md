# T09a - Demo seed, resident progress page, instructor residents pages

- Branch: `feat/T09a-progress-and-residents`
- Depends on: T08b merged. (Does not need real LLM data.)
- Estimate: about 6 h including review.
- Skills to read first: persian-rtl-ui, api-conventions, adaptive-engine. ADRs: 0008, 0009, 0010, 0011.
- Also read: docs/tasks/T06-resident-ui.md (to see what the Progress page was meant to be), packages/contracts/src/session.js (the exact shape of the `/api/progress` response), apps/web/src/pages/resident/ReportPage.jsx (pattern for loading/error states), apps/web/src/features/sessions (pattern for TanStack Query hooks).

## Goal
1. A demo seed script that creates a clearly labelled SYNTHETIC demo resident with several finished sessions (needed to test T09a/T09b and to run the demo).
2. Replace the placeholder `/progress` page (resident).
3. Replace the placeholder `/instructor/residents` page and add a resident detail page.

## Rules specific to this task
- Do not guess response shapes. Read the Zod schemas in packages/contracts first and use them.
- No new npm dependency. The chart is a small hand-written SVG component.
- Use RTL logical utilities only (ms-/me-/ps-/pe-/start-/end-); `npm run lint` runs scripts/check-rtl-classes.js.
- All user-visible text goes through i18next (fa first; follow the existing convention for en).
- Synthetic demo data must NEVER be mixed into evaluation numbers (T10). Mark it in the data (displayName) and in the README.

## Step 0 - Inventory (no commit)
Run `Select-String -Path apps/web/src -Pattern PlaceholderPage -Recurse` and confirm the 4 placeholder routes in router.jsx. Open the contract of GET /api/progress, GET /api/admin/users and GET /api/admin/users/:userId/progress and write the field names you will use in the PR body.

## Step 1 - Demo seed script
Add `apps/api/scripts/demo-seed.js` and the npm script `demo:seed` (same `--env-file-if-exists` style as other scripts).
Behaviour:
- Refuse to run if `NODE_ENV === 'production'` (exit code 1, clear message).
- Create (or reuse, idempotent) a resident `demo.resident@example.com`, displayName `Demo Resident (synthetic)`. Password comes from env `DEMO_PASSWORD` or a documented dev-only default printed once at the end. Hash it through the same code path as register.
- Create 4 finished sessions (sizes 45) through the EXISTING session service functions (create session -> answers -> finish) so that adaptive allocation, metrics and reports are computed by the real code. If the service layer cannot be called without HTTP, STOP and report in the PR body instead of copying logic.
- Answers come from the engine's virtual resident (packages/engine simulator) with a fixed seed, so per-class accuracy improves across the 4 sessions but never equals exactly 100%.
- Print a summary table: session no, accuracy per class.
- `--reset` flag deletes ONLY the demo resident and its sessions.
- Tests: refuses in production; idempotent (run twice -> still 4 sessions); `--reset` removes only the demo user.
Commit: `feat(api): add synthetic demo seed script`.

## Step 2 - Shared pieces
- `apps/web/src/components/charts/LineChart.jsx`: props `series` ([{id,label,points:[{x,y}]}]), `yDomain` (default [0,1]), `threshold` (optional number, drawn as a dashed line with label), `ariaLabel`. SVG wrapper has `dir="ltr"` (time axis runs left to right even in RTL), `role="img"`. Series are distinguished by dash pattern AND a text legend, not by colour alone. Below the chart render a plain `<table>` with the same numbers (accessibility + fallback).
- A constant `MASTERY_THRESHOLD = 0.8`: search contracts/engine first. If no shared export exists, add it to packages/contracts and use it in the web code; add a test that `isMastered` default threshold equals the constant. Do not change engine behaviour.
- Number/percent formatting: reuse the helper the app already has (grep for `Intl.NumberFormat`). Do not add a new one if one exists.
Tests: LineChart renders N lines, threshold line, table rows; empty series does not crash.
Commit: `feat(web): add line chart component and mastery threshold constant`.

## Step 3 - Resident Progress page (`/progress`)
Replace the placeholder. Create hook `useProgress` in `apps/web/src/features/progress/` (TanStack Query, same style as sessions). Content:
a) Line chart: per-class accuracy per finished session (3 series) with the 80% threshold.
b) Table: session no, date, overall accuracy (one row per finished session).
c) "Most frequent confusions" list from the response (class pair + count).
d) Mastery badge per class from the LATEST finished session using MASTERY_THRESHOLD; if all three classes are mastered show a clear "goal reached" message.
e) States: loading, error (with retry), empty (no finished session -> text + button to start a test).
f) Educational-only note (existing i18n text if present).
Do not request catalog or admin endpoints. Do not show any per-image information.
Tests: the four states; chart gets 3 series; mastery badge uses latest session only; Persian digits (follow existing tests).
Commit: `feat(web): add resident progress page`.

## Step 4 - Instructor residents list (`/instructor/residents`)
Replace the placeholder. Data: GET /api/admin/users (paginated). Table: displayName, sessionsFinished, lastAccuracy, lastActiveAt; pagination controls; empty state; error state. Row click -> `/instructor/residents/:userId`.
Commit: `feat(web): add instructor residents list`.

## Step 5 - Instructor resident detail (`/instructor/residents/:userId`)
Data: GET /api/admin/users/:userId/progress. Extract the presentational part of the Progress page into `ProgressView` (props = data) and reuse it for both pages (no copy-paste). Add the route under the existing instructor guard. If the progress response contains session ids and the report page can be reused read-only with GET /api/admin/sessions/:id/report, link to it; otherwise do NOT build it (note in PR body).
Tests: route is forbidden for a resident (extend guards test); detail page shows data; 404/invalid userId handled.
Commit: `feat(web): add instructor resident detail view`.

## Step 6 - Docs and board
README endpoints/scripts table: add `demo:seed`. Update docs/PROGRESS.md row. Postman: no change needed (no new endpoint). Commit: `docs: record T09a`.

## Verification commands
```powershell
npm run lint
npm test
npm run demo:seed -w apps/api
npm run dev   # then log in as the demo resident and the instructor
```
Manual checklist: /progress shows 4 points per line and the dashed 80% line; instructor sees the demo resident in the list; resident cannot open /instructor/residents (Forbidden page); no placeholder text on these 3 pages.

## Acceptance criteria
- `npm run lint` and `npm test` pass; new tests exist for every step.
- Only /education and /instructor/catalog placeholders remain.
- demo:seed is idempotent, refuses production, labels data as synthetic.
- No new dependency in package.json files (`git diff main -- '**/package.json'` shows only the new script).

## Out of scope
Education page, catalog page (T09c), targeted practice (T09b), export/print of reports, English translation beyond existing conventions.
