# UI polish checklist (used in T15)

Viewports to check for every screen: 1366x768 (main laptop), 1920x1080, 390x844 (mobile). Language Persian (RTL).
Screenshots stay outside git (they contain dataset radiographs).

## A. Global rules (fixed once in shared components/tokens)
1. Text contrast: normal text at least 4.5:1, large text (18px+ or 14px+ bold) at least 3:1, against the REAL background. No `text-*-300/400` light grays on white, no text on image or colored cards without a contrast check, placeholders at least 4.5:1 (or clearly secondary but readable). Disabled state still readable (3:1).
2. Spacing scale (Tailwind): page padding `px-4 md:px-6`, vertical rhythm between sections `space-y-6`, card padding `p-4 md:p-6`, gap inside forms `space-y-4`, gap between buttons `gap-3`. A button is never glued to a divider/border: at least `mt-4` below a divider and `pt-4` above a footer border.
3. Buttons: min height 40px (`h-10`), horizontal padding `px-4`, visible hover, focus ring (`focus-visible:ring-2`), disabled style, loading state keeps width.
4. Select/dropdown: native arrow is hidden (`appearance-none`), a chevron icon sits in a `relative` wrapper with `pointer-events-none absolute inset-y-0 end-3`; the select has `ps-3 pe-10` (RTL-safe logical padding), same height as inputs; the arrow is never touching the border.
5. Inputs: same height as buttons, label above with `mb-1.5`, error text below with `mt-1`, error color with 4.5:1 contrast, focus ring.
6. RTL: only logical classes (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`); arrows/chevrons mirrored; numbers and percentages not breaking the line (`dir="ltr"` or `bdi` for mixed text); tables align to start.
7. Typography: Vazirmatn everywhere, body 16px, line-height comfortable for Persian (`leading-7` for paragraphs), headings with clear hierarchy, no text smaller than 12px.
8. States on every data screen: loading (skeleton or spinner), empty (friendly text + next action), error (message + retry), populated, long Persian text (no overflow), 1 item and many items.
9. Keyboard: Tab order logical, focus visible everywhere, Esc closes modals, shortcuts hint visible on the quiz.
10. Radiographs: image never stretched (`object-contain`), fixed aspect box so layout does not jump while loading, alt text generic (no class name).
11. Consistency: one digit style (decide: keep the current one), one date format, one button wording per action, one card style, one badge style.

## B. Screens (route -> check)
| # | Screen | File | Special checks |
|---|---|---|---|
| 1 | Login | `pages/auth/LoginPage.jsx` | form spacing, error text contrast, link to register |
| 2 | Register | `pages/auth/RegisterPage.jsx` | same + password hint text |
| 3 | Forbidden | `pages/system/ForbiddenPage.jsx` | clear action button |
| 4 | Not found | `pages/system/NotFoundPage.jsx` | clear action button |
| 5 | Resident home | `pages/resident/ResidentHomePage.jsx` | cards, call-to-action button spacing |
| 6 | Tests list | `pages/resident/TestsPage.jsx` | table/list, status badges, empty state |
| 7 | Quiz | `pages/resident/QuizPage.jsx` | image box, option buttons, progress bar, shortcut hints, sticky footer actions |
| 8 | Report | `pages/resident/ReportPage.jsx` | 3x3 matrix cell contrast, numbers LTR, section dividers vs buttons, LLM text block |
| 9 | Review | `pages/resident/ReviewPage.jsx` | answer list, correct/incorrect colors not color-only |
| 10 | Practice home | `pages/resident/PracticeHomePage.jsx` | pair cards |
| 11 | Practice set | `pages/resident/PracticeSetPage.jsx` | feedback panel, buttons |
| 12 | Progress | `pages/resident/ProgressPage.jsx` | chart colors/labels, empty state |
| 13 | Education | `pages/resident/EducationPage.jsx` | long text readability, headings |
| 14 | Instructor home | `pages/instructor/InstructorHomePage.jsx` | cards |
| 15 | Residents | `pages/instructor/InstructorResidentsPage.jsx` | table, search/select spacing |
| 16 | Resident detail | `pages/instructor/ResidentDetailPage.jsx` | charts, tables |
| 17 | Review panel | `pages/instructor/InstructorReviewPage.jsx` | question card, approve/reject buttons, edit form, shortcut hints |
| 18 | Catalog | `pages/instructor/InstructorCatalogPage.jsx` | tables, confounder disclosure box contrast |
| 19 | Shells/layouts/nav | `apps/web/src` layouts, header, sidebar | active link contrast, mobile menu, logout button |

## C. Per-screen sign-off (Mahdi fills during T15)
| Date | Screen # | Screen | 1366 OK | 1920 OK | 390 OK | Contrast OK | States OK | Notes |
|---|---|---|---|---|---|---|---|---|
| 2026-11-12 | 1 | Login (`LoginPage.jsx`) | [ ] | [ ] | [ ] | [x] | [x] | Standard inputs & accessible error tokens |
| 2026-11-12 | 2 | Register (`RegisterPage.jsx`) | [ ] | [ ] | [ ] | [x] | [x] | 40px buttons, readable password hint |
| 2026-11-12 | 3 | Forbidden (`ForbiddenPage.jsx`) | [ ] | [ ] | [ ] | [x] | [x] | High contrast text, clear action button |
| 2026-11-12 | 4 | Not found (`NotFoundPage.jsx`) | [ ] | [ ] | [ ] | [x] | [x] | Sky-500 bold 404 display |
| 2026-11-12 | 5 | Resident home (`ResidentHomePage.jsx`) | [ ] | [ ] | [ ] | [x] | [x] | Task badges (T06, T09) removed |
| 2026-11-12 | 6 | Tests list (`TestsPage.jsx`) | [ ] | [ ] | [ ] | [x] | [x] | Custom Select filter, friendly EmptyState |
| 2026-11-12 | 7 | Quiz (`QuizPage.jsx`) | [ ] | [ ] | [ ] | [x] | [x] | [1][2][3] shortcut hints, image box canvas |
| 2026-11-12 | 8 | Report (`ReportPage.jsx`) | [ ] | [ ] | [ ] | [x] | [x] | 3x3 matrix contrast, LTR numbers |
| 2026-11-12 | 9 | Review (`ReviewPage.jsx`) | [ ] | [ ] | [ ] | [x] | [x] | Multi-attribute answer list, LlmPanel |
| 2026-11-12 | 10 | Practice home (`PracticeHomePage.jsx`) | [ ] | [ ] | [ ] | [x] | [x] | Pair practice cards, CardFooter spacing |
| 2026-11-12 | 11 | Practice set (`PracticeSetPage.jsx`) | [ ] | [ ] | [ ] | [x] | [x] | Radio buttons, feedback panel |
| 2026-11-12 | 12 | Progress (`ProgressPage.jsx`) | [ ] | [ ] | [ ] | [x] | [x] | High contrast LineChart labels & dark mode |
| 2026-11-12 | 13 | Education (`EducationPage.jsx`) | [ ] | [ ] | [ ] | [x] | [x] | Persian typography text-sm leading-7 |
| 2026-11-12 | 14 | Instructor home (`InstructorHomePage.jsx`) | [ ] | [ ] | [ ] | [x] | [x] | Task badges (T08, T09) removed |
| 2026-11-12 | 15 | Residents (`InstructorResidentsPage.jsx`) | [ ] | [ ] | [ ] | [x] | [x] | Residents table contrast & dark mode |
| 2026-11-12 | 16 | Resident detail (`ResidentDetailPage.jsx`) | [ ] | [ ] | [ ] | [x] | [x] | Resident charts, error pattern tables |
| 2026-11-12 | 17 | Review panel (`InstructorReviewPage.jsx`) | [ ] | [ ] | [ ] | [x] | [x] | Shortcuts pill, Select dropdowns, alert |
| 2026-11-12 | 18 | Catalog (`InstructorCatalogPage.jsx`) | [ ] | [ ] | [ ] | [x] | [x] | Confounder disclosure, Select dropdowns |
| 2026-11-12 | 19 | Shells/layouts/nav (`apps/web/src`) | [ ] | [ ] | [ ] | [x] | [x] | Mobile drawer menu, responsive padding |
