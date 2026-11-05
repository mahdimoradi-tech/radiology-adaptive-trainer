# T06 — Resident UI: tests list, quiz, report and review

Driver: **A (solo)** · Reviewer: none (solo) -> AI review per `docs/SOLO-MODE.md` · Branch: `feat/T06-resident-ui` · Skills: `persian-rtl-ui`, `api-conventions`, `git-workflow`, `team-collaboration` · Estimate: 7-8 h · Folders: `apps/web`, `docs/`.

If this task and a skill disagree, THIS TASK WINS. Record deviations in ADR 0011 and sync the skill at the end.
No API or contracts change in this task. If you find an API gap, STOP, write it in the PR as a question, and do not patch the API here.

## Goal
The resident can use the whole training loop in the browser: start a test, answer questions with a question navigator, finish, read the report (confusion matrix, per-class metrics, difficulty tables), and review every question with the correct answer. The design follows the professor's paper (figures 5, 6, 7): a quiz page with a numbered side list, a report page with a confusion matrix and per-class tables, and a review page with green/red question buttons. LLM panels come later (T07). Educational page and progress page are NOT in this task (T09).

## Prerequisites
T04 and T05 merged. `/sync` done. API running on `127.0.0.1:4000`, real catalog seeded, images present in `data/catalog/images` (`(Get-ChildItem data\catalog\images).Count` must be 1177). A resident account exists.

## Step 0 (no commit): recon — write the findings in the PR description, WITHOUT guessing
Run and read:
```powershell
Get-ChildItem apps/web/src -Recurse -File | Select-Object -ExpandProperty FullName
Get-Content apps/web/src/lib/api.js -TotalCount 100
Get-Content apps/web/src/features/auth/hooks.js -TotalCount 80
Get-Content apps/web/src/components/ui/index.js
Get-Content apps/web/vite.config.js
Get-ChildItem apps/web/src/i18n -Recurse -File
Get-Content apps/web/src/app/layouts/ResidentLayout.jsx
Get-Content docs/adr/0010-session-lifecycle-and-metrics.md
```
Record: (1) how the API base URL / dev proxy / credentials work and the shape of the thrown error (status, code, details); (2) query-key and hook conventions; (3) which UI components exist and their props; (4) i18n file layout and whether fa/en key parity is tested; (5) number/date/Persian-digit helpers; (6) how existing tests mock the API; (7) what ResidentLayout already renders (header/nav) so pages do not duplicate it; (8) how an `imageUrl` from the API must be turned into a working `<img src>` (same-origin proxy or absolute base). If any of this contradicts the plan below, follow the CODE and note it.

## Human steps
None before coding. At the end the human runs the manual check in Verification.

## Binding decisions
| Topic | Decision |
|---|---|
| Source of numbers | The UI NEVER computes metrics. Every number comes from the API (`SessionReport`). The UI only formats and lays out. |
| Autosave | Selecting an option immediately calls `PUT /api/sessions/:id/questions/:no/answer`. There is no separate "submit answer" step (deviation from the paper, reason: no lost answers on refresh). Changing the answer later is allowed until finish. |
| No feedback during the test | Quiz never shows correctness, class names of the image, difficulty or source. Only after finish (report/review). |
| Answer options | Fixed order: covid19, pneumonia, normal (never shuffled). Labels (fa): «کووید-۱۹ (COVID-19)», «ذات‌الریه (Pneumonia)», «سالم (Normal)». Radio group, keyboard keys 1/2/3 select an option. |
| Question text | «سؤال {n}: تصویر زیر کدام مورد را نشان می‌دهد؟» (single label, not "all diseases visible" as in the paper) |
| Resume | Session state comes from `GET /api/sessions/:id`. The current question is kept in the URL (`?q=7`, 1-based). Without `q`, open the first unanswered question (or 1). |
| Finish | Button «ثبت نهایی و خروج» opens a confirmation dialog that shows the number of unanswered questions; finishing with unanswered questions is allowed. After success go to the report. |
| Finished session | Opening `/app/tests/:id` of a finished session redirects to `/app/reports/:id`. Opening a report of an in-progress session redirects to the quiz. |
| Test size | Selector with 45 / 60 / 90 / 120 (default 60). |
| Band labels | Per-class band in the report text: `mastered` (from `perClassMastered`) -> «خوب (به هدف رسیده‌اید)»; else accuracy >= 0.5 -> «متوسط»; else «ضعیف». The 80% threshold is NOT hard-coded in the UI. |
| Difficulty labels | easy «آسان», medium «متوسط», hard «سخت». The numeric difficulty is not shown. |
| Plan card | Report shows «چرا این آزمون؟»: for `adaptive` the class counts and weights from `plan`; for `baseline` a one-line text that it was a balanced test. `plan.shortfalls` are NOT shown to residents. |

## Routes (replace the T06 placeholders in `apps/web/src/app/router.jsx`; keep `progress` and `education` placeholders for T09)
| Path | Page |
|---|---|
| `/app/tests` | `TestsPage`: own sessions list + start/continue |
| `/app/tests/:sessionId` | `QuizPage` |
| `/app/reports/:sessionId` | `ReportPage` |
| `/app/reports/:sessionId/review` | `ReviewPage` (new child route) |
Update the resident nav/home so the main call to action leads to `/app/tests`. Pages live in `src/pages/resident/`, feature code in `src/features/sessions/` (`api.js`, `hooks.js`, `keys.js`, components).

## Screens
### TestsPage
- If an `in_progress` session exists (from `GET /api/sessions`): primary button «ادامه آزمون» to it, and a note that a new test cannot start before finishing it.
- Otherwise: size selector + «شروع آزمون جدید». While creating, disable the button (double-click safe).
- Errors: 409 `SESSION_IN_PROGRESS` -> navigate to `details`' session id; 409 `POOL_EXHAUSTED` -> friendly message «تصاویر جدید کافی برای ساخت این آزمون وجود ندارد؛ با مدرس تماس بگیرید» (no numbers needed); other errors -> generic toast.
- List of finished sessions (newest first): index, kind badge (پایه / تطبیقی), date (Persian formatting), answered count, overall accuracy, link to report. Pagination via `PaginationQuery` (`page`, `pageSize`).
- Empty state for new residents.

### QuizPage (paper figure 5)
- Two-column layout on `lg`: navigator column first in the DOM (it appears on the right in RTL), question card second. On small screens the navigator is a collapsible strip above the card.
- Navigator: grid of numbered buttons; states: answered (green + check icon), unanswered (gray), current (strong ring). Do not rely on color alone: add an icon and an `aria-label` («سؤال ۴، پاسخ داده شده»). Header shows «تعداد سؤال‌ها: N» and «پاسخ‌داده‌شده: k».
- Card: title, image (`object-contain`, dark background, max height about 70vh, `draggable={false}`, `alt` = «تصویر رادیوگرافی قفسه سینه» only), the three radio options, buttons «قبلی», «بعدی» (on the last question «بعدی» is hidden), «ثبت نهایی و خروج».
- Prefetch the next question's image (`new Image().src`) after the current one loaded.
- `timeMs`: time from showing the question to the latest selection, capped at 600000, sent with the answer.
- Optimistic selection: show the choice at once; if the PUT fails, restore the previous choice and show an error toast with retry. If the PUT returns 409 `SESSION_NOT_IN_PROGRESS`, go to the report.
- Image load error: show a retry button, never a broken icon alone.
- No `crossOrigin` attribute on `<img>` (cookies must be sent); verify in Step 0 how the cookie reaches the image request.

### Finish dialog
Uses the existing dialog component. Text: «{k} سؤال بی‌پاسخ دارید. پس از ثبت نهایی امکان تغییر وجود ندارد.» Buttons: «بازگشت», «ثبت نهایی». While finishing, buttons are disabled. 409 `SESSION_ALREADY_FINISHED` is treated as success (go to the report).

### ReportPage (paper figure 6)
Data: `GET /api/sessions/:id/report`.
1. Summary card: answered/size, correct/total, overall accuracy, unanswered count (if > 0), mastery banner (`mastered` true -> «هدف برای هر سه کلاس محقق شد»).
2. Per-class text block like the paper: one short sentence per class with accuracy, band label and the easy/medium/hard breakdown from `byClassBucket` (e.g. «از سؤال‌های آسان 8 از 10 را درست پاسخ داده‌اید»); skip a bucket with zero questions.
3. Confusion matrix table (3x3): rows = true class, columns = your answer, order = `CLASS_IDS`; diagonal cells highlighted; header cell «کلاس واقعی / پاسخ شما».
4. Per-class metrics table: TP, FP, FN, TN, recall, precision, F1 (formatted as percent where it is a ratio). A short footnote explains one-vs-rest.
5. Two tables like the paper: «پاسخ‌های درست» and «پاسخ‌های غلط» (class x easy/medium/hard).
6. «چرا این آزمون؟» card (see decisions).
7. Actions: «مرور سؤال‌ها» -> review, «شروع آزمون بعدی» -> creates a session with the same `size` (handle errors as in TestsPage).
Zero answered questions: show a friendly note and hide the tables that would be all zeros.

### ReviewPage (paper figure 7)
Data: the same report query (`review[]`). Left/right: navigator (green correct, red incorrect, gray unanswered, current ring; icons + aria-labels), card: «سؤال n: درست/نادرست/بی‌پاسخ», difficulty badge, «پاسخ شما: …», «پاسخ صحیح: …», image. Filter: همه / فقط غلط‌ها / بی‌پاسخ‌ها. The component accepts an optional `extra` slot rendered under the answer summary (T07 will use it; do not add anything else for it). `?q=` in the URL as in the quiz.

## i18n, RTL, accessibility
Add keys for `sessions.*`, `quiz.*`, `report.*`, `review.*`, `classes.*`, `buckets.*` following the existing layout (fa complete; en keys at least present if the project tests parity). Use only logical classes (`ms-`, `me-`, `ps-`, `pe-`, `text-start`) — the RTL class check must pass. Persian digits via the existing formatter. Every interactive element is keyboard reachable; dialogs trap focus (use the existing component). Set `document.title` per page.

## Tests (Vitest + Testing Library; mock the API the way existing tests do)
1. `keys`/`api` functions call the right URLs and unwrap `{ data }`.
2. TestsPage: start flow, `SESSION_IN_PROGRESS` redirect, `POOL_EXHAUSTED` message, in-progress continue button, empty state.
3. QuizPage: renders question 1 with only the allowed content; navigator states; selecting an option calls PUT with the right `no`/`answer` and updates the navigator; resume opens the first unanswered question; keys 1/2/3; PUT failure restores the choice; 409 `SESSION_NOT_IN_PROGRESS` navigates to the report; finished session redirects.
4. Finish dialog: shows unanswered count; finishing navigates to the report; `SESSION_ALREADY_FINISHED` handled.
5. ReportPage: matrix orientation (row = true class), formatted numbers, band labels from `perClassMastered`, plan card for adaptive vs baseline, zero-answered state, in-progress redirect.
6. ReviewPage: correct/incorrect/unanswered states, filters, URL `q` sync.
7. **Leak test:** render QuizPage with a realistic session fixture and assert the DOM text and all attributes contain none of: `trueClass`, `bucket`, `difficulty`, `confusedWith`, `cohen_`, `kermany_`, `figure1_`, and that no image `src` contains a class name.
8. `npm run lint` including the RTL class check stays green.

## Steps (commit after each, push after every 1-3)
0. (no commit) recon note in PR description.
1. `feat(web): add sessions api client and query hooks` (+ test 1).
2. `feat(web): add tests list page and start flow` (+ test 2).
3. `feat(web): add quiz page with question navigator` (+ tests 3, 7).
4. `feat(web): add finish dialog and resume behavior` (+ test 4).
5. `feat(web): add report page with confusion matrix and metrics` (+ test 5).
6. `feat(web): add review page with filters` (+ test 6).
7. `docs(web): add ADR 0011, readme notes and sync persian-rtl-ui skill` — ADR 0011 documents: autosave deviation from the paper, no-feedback rule, band labels from `perClassMastered`, plan card without shortfalls, URL-based question state; update the board and operator log.

## Verification (show real outputs)
`npm run lint`, `npm test`, `npm run build`. Manual run (`npm run dev`): log in as a resident, start a 45-question test, answer about 10 (mix), refresh the page (answers and position survive), open DevTools -> Network and confirm no JSON field named `trueClass`/`bucket`/`difficulty` appears in any resident response, finish, open the report and the review, start the next test. Paste screenshots of quiz, report and review (desktop width and a narrow width) in the PR. Report what the baseline plan looked like for covid19 medium/hard (the catalog has only 2 medium and 3 hard covid19 images) — read it from `mongosh`, never from the UI.

## Acceptance criteria
- [ ] All screens and rules above implemented; leak test passes; no metric is computed in the UI.
- [ ] Manual run shows autosave, resume, finish, report, review working with the real API.
- [ ] RTL check, lint, tests, build green; CI green; ADR 0011; skill synced; board and log updated.
- [ ] AI review done in a fresh chat and its blockers fixed.

## Out of scope
Progress dashboard, education page (T09); LLM panels (T07); instructor pages (T08b/T09); targeted practice; timers; any API change.
