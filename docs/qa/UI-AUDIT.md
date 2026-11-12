# UI Audit Report (T15 Static Audit)

This static audit catalogs all visual polish issues across `apps/web/src` as required by **T15 Step 0**.
Issues are categorized according to the rules in `docs/qa/UI-CHECKLIST.md`:
- **(a) Contrast:** Low-contrast text classes (`text-*-300/400`), muted text, placeholders, and disabled states violating WCAG AA 4.5:1 (or 3:1 for large text).
- **(b) Dividers & Spacing:** Buttons or content directly touching borders/dividers without `pt-4` / `mt-4`.
- **(c) Select Elements:** Raw `<select>` tags missing `appearance-none`, chevron icon wrapper, and `ps-3 pe-10`.
- **(d) Physical Classes:** Directional classes (`left-`, `right-`, `ml-`, `mr-`, `pl-`, `pr-`) that slip past RTL logic.
- **(e) State Coverage:** Missing loading, error, or empty states on data-dependent screens.
- **(f) Component Consistency:** Missing variant keys (`danger` in Alert, `primary` in Badge, button height 40px) and responsive mobile navigation.

---

## 1. Static Audit Inventory (Found by AI Scanner)

| # | file:line | problem | proposed fix | screen |
|---|---|---|---|---|
| 1 | `apps/web/src/components/charts/LineChart.jsx:294` | `text-slate-700 dark:text-slate-300` has low contrast in dark theme | Replace with accessible token or `dark:text-slate-200` | Progress / Resident Detail |
| 2 | `apps/web/src/components/charts/LineChart.jsx:316` | `text-[10px] text-slate-400` (< 4.5:1 contrast against chart canvas) | Replace with `text-slate-500` (4.6:1 WCAG AA) | Progress / Resident Detail |
| 3 | `apps/web/src/components/charts/LineChart.jsx:356` | `text-slate-700 dark:text-slate-300` low contrast in dark mode table | Replace with accessible token or `dark:text-slate-200` | Progress / Resident Detail |
| 4 | `apps/web/src/components/ui/Input.jsx:22` | `placeholder:text-rose-300` (< 4.5:1 contrast on white) | Replace with `placeholder:text-rose-400` / `placeholder:text-rose-500` | All Input screens |
| 5 | `apps/web/src/components/ui/Input.jsx:23` | `placeholder:text-slate-400` (~3.2:1 contrast on white) | Replace with `placeholder:text-slate-500` (4.6:1 WCAG AA) | All Input screens |
| 6 | `apps/web/src/components/ui/Button.jsx:14-18` | Button `size="md"` lacks explicit 40px minimum height (`h-10`) | Add `min-h-[40px]` or `h-10` to `SIZE_CLASSES.md` | All Button screens |
| 7 | `apps/web/src/components/ui/Button.jsx:42` | `disabled:opacity-50` reduces text contrast below 3:1 | Refine disabled styling to preserve minimum 3:1 contrast | All Button screens |
| 8 | `apps/web/src/components/ui/XrayImage.jsx:33` | `text-slate-400 text-xs` image fallback text (< 4.5:1) | Replace with `text-slate-500` | Quiz / Review / Catalog / Detail |
| 9 | `apps/web/src/features/bank/BankQuestionDetail.jsx:20` | `text-slate-400 text-xs` empty selection prompt (< 4.5:1) | Replace with `text-slate-600` or shared EmptyState | Instructor Review |
| 10 | `apps/web/src/features/bank/BankQuestionDetail.jsx:174` | `text-[10px] text-slate-400 bg-slate-100` badge (< 3.5:1) | Replace with `text-slate-600 bg-slate-100` | Instructor Review |
| 11 | `apps/web/src/features/bank/BankQuestionDetail.jsx:194` | `text-[10px] text-slate-400 text-end block` (< 3.5:1) | Replace with `text-slate-500` | Instructor Review |
| 12 | `apps/web/src/features/bank/BankQuestionDetail.jsx:349` | `text-slate-400 text-[10px]` shortcut hint (< 4.5:1) | Replace with `text-slate-500` | Instructor Review |
| 13 | `apps/web/src/features/catalog/CatalogTable.jsx:109` | `text-[11px] text-slate-400 font-mono` image id (< 4.5:1) | Replace with `text-slate-500 font-mono` | Instructor Catalog |
| 14 | `apps/web/src/features/llm/LlmPanel.jsx:90` | `text-xs text-slate-400 pt-3 border-t` disclaimer text (< 4.5:1) | Replace with `text-slate-500` | Report / Review / Practice / Review |
| 15 | `apps/web/src/features/llm/LlmPanel.jsx:92` | `text-slate-400 shrink-0` disclaimer icon (< 4.5:1) | Replace with `text-slate-500` | Report / Review / Practice / Review |
| 16 | `apps/web/src/features/progress/ProgressView.jsx:52` | `text-slate-600 dark:text-slate-400` in dark theme | Replace with `dark:text-slate-300` | Progress / Resident Detail |
| 17 | `apps/web/src/features/progress/ProgressView.jsx:126` | `text-slate-500 dark:text-slate-400` in dark theme | Replace with `dark:text-slate-300` | Progress / Resident Detail |
| 18 | `apps/web/src/features/progress/ProgressView.jsx:152` | `text-slate-500 dark:text-slate-400` in dark theme | Replace with `dark:text-slate-300` | Progress / Resident Detail |
| 19 | `apps/web/src/features/progress/ProgressView.jsx:179` | `text-slate-500 dark:text-slate-400` in dark theme | Replace with `dark:text-slate-300` | Progress / Resident Detail |
| 20 | `apps/web/src/features/progress/ProgressView.jsx:205` | `text-slate-400 mx-1.5 font-sans` separator arrow (< 4.5:1) | Replace with `text-slate-500` | Progress / Resident Detail |
| 21 | `apps/web/src/features/progress/ProgressView.jsx:210` | `text-[10px] text-slate-400` error count subtitle (< 4.5:1) | Replace with `text-slate-500` | Progress / Resident Detail |
| 22 | `apps/web/src/features/progress/ProgressView.jsx:239` | `text-slate-700 dark:text-slate-300` in dark table thead | Replace with accessible token or `dark:text-slate-200` | Progress / Resident Detail |
| 23 | `apps/web/src/features/progress/ProgressView.jsx:283` | `text-slate-600 dark:text-slate-400` in dark table tbody | Replace with `dark:text-slate-300` | Progress / Resident Detail |
| 24 | `apps/web/src/features/progress/ProgressView.jsx:318` | `text-slate-500 dark:text-slate-400` in dark footnote | Replace with `dark:text-slate-300` | Progress / Resident Detail |
| 25 | `apps/web/src/pages/instructor/InstructorResidentsPage.jsx:70` | `text-slate-600 dark:text-slate-400` in dark theme | Replace with `dark:text-slate-300` | Instructor Residents |
| 26 | `apps/web/src/pages/instructor/InstructorResidentsPage.jsx:84` | `text-slate-500 dark:text-slate-400` in dark theme | Replace with `dark:text-slate-300` | Instructor Residents |
| 27 | `apps/web/src/pages/instructor/InstructorResidentsPage.jsx:101` | `text-slate-700 dark:text-slate-300` in dark thead | Replace with accessible token or `dark:text-slate-200` | Instructor Residents |
| 28 | `apps/web/src/pages/instructor/InstructorResidentsPage.jsx:154` | `text-slate-600 dark:text-slate-400` in dark tbody | Replace with `dark:text-slate-300` | Instructor Residents |
| 29 | `apps/web/src/pages/instructor/InstructorResidentsPage.jsx:165` | `text-slate-600 dark:text-slate-400` in dark tbody | Replace with `dark:text-slate-300` | Instructor Residents |
| 30 | `apps/web/src/pages/instructor/InstructorResidentsPage.jsx:178` | `text-slate-500 dark:text-slate-400` in dark footer | Replace with `dark:text-slate-300` | Instructor Residents |
| 31 | `apps/web/src/pages/instructor/ResidentDetailPage.jsx:56` | `text-slate-500 dark:text-slate-400` in dark meta header | Replace with `dark:text-slate-300` | Resident Detail |
| 32 | `apps/web/src/pages/resident/EducationPage.jsx:167` | `text-[11px] text-slate-400` card footer meta (< 4.5:1) | Replace with `text-slate-500` | Education |
| 33 | `apps/web/src/pages/resident/ProgressPage.jsx:47` | `text-slate-600 dark:text-slate-400` in dark subtitle | Replace with `dark:text-slate-300` | Progress |
| 34 | `apps/web/src/pages/resident/QuizPage.jsx:250` | `text-slate-400 text-sm` image error text (< 4.5:1) | Replace with `text-slate-600` or Alert banner | Quiz |
| 35 | `apps/web/src/pages/resident/QuizPage.jsx:307` | `text-xs text-slate-400 font-mono` [1] keyboard shortcut (< 4.5:1) | Replace with `text-slate-500` / `text-slate-600` | Quiz |
| 36 | `apps/web/src/pages/resident/QuizPage.jsx:313` | `text-xs text-slate-400 text-start` keyboard hint (< 4.5:1) | Replace with `text-slate-500` | Quiz |
| 37 | `apps/web/src/pages/resident/ReportPage.jsx:157` | `text-xs text-slate-400 block mt-1` subtitle (< 4.5:1) | Replace with `text-slate-500` | Report |
| 38 | `apps/web/src/pages/resident/ReportPage.jsx:169` | `text-sm text-slate-400 font-normal` denominator (< 4.5:1) | Replace with `text-slate-500` | Report |
| 39 | `apps/web/src/pages/resident/ReportPage.jsx:300` | `text-slate-400` zero count cell (< 4.5:1) | Replace with `text-slate-500` | Report |
| 40 | `apps/web/src/pages/resident/ReportPage.jsx:382` | `text-xs text-slate-400 border-t border-slate-100 pt-3` | Replace with `text-slate-500 pt-4` | Report |
| 41 | `apps/web/src/pages/resident/ReviewPage.jsx:181` | `text-xs text-slate-400 py-4 text-center` filter empty text | Replace with `text-slate-600` | Review |
| 42 | `apps/web/src/pages/system/NotFoundPage.jsx:10` | `text-6xl font-black text-slate-300` large 404 display text | Replace with `text-slate-400` or `text-sky-500` (>= 3:1) | Not Found |
| 43 | `apps/web/src/components/ui/Card.jsx:53` | `CardFooter` has default `p-5 pt-0 border-t` (glued to border) | Update default to `p-5 pt-4 border-t border-slate-100 mt-4` | All Card footers |
| 44 | `apps/web/src/features/bank/BankQuestionList.jsx:104` | `pt-3 mt-2 border-t border-slate-200` above pagination buttons | Update to `pt-4 mt-4` to satisfy Rule A2 | Instructor Review |
| 45 | `apps/web/src/pages/resident/EducationPage.jsx:167` | `pt-2 border-t border-slate-100` card footer | Update to `pt-4` to satisfy Rule A2 | Education |
| 46 | `apps/web/src/features/bank/BankFilterBar.jsx:94` | `<select id="filter-type">` lacks `appearance-none` & chevron padding | Migrate to shared `Select` component (`ps-3 pe-10`) | Instructor Review |
| 47 | `apps/web/src/features/bank/BankFilterBar.jsx:112` | `<select id="filter-class">` lacks `appearance-none` & chevron padding | Migrate to shared `Select` component (`ps-3 pe-10`) | Instructor Review |
| 48 | `apps/web/src/features/catalog/CatalogFilterBar.jsx:57` | `<select id="filter-class">` lacks `appearance-none` & chevron padding | Migrate to shared `Select` component (`ps-3 pe-10`) | Instructor Catalog |
| 49 | `apps/web/src/features/catalog/CatalogFilterBar.jsx:75` | `<select id="filter-bucket">` lacks `appearance-none` & chevron padding | Migrate to shared `Select` component (`ps-3 pe-10`) | Instructor Catalog |
| 50 | `apps/web/src/features/catalog/CatalogFilterBar.jsx:93` | `<select id="filter-source">` lacks `appearance-none` & chevron padding | Migrate to shared `Select` component (`ps-3 pe-10`) | Instructor Catalog |
| 51 | `apps/web/src/pages/resident/TestsPage.jsx:127` | `<select id={selectId}>` lacks `appearance-none` & chevron padding | Migrate to shared `Select` component (`ps-3 pe-10`) | Tests List |
| 52 | `apps/web/src` (all files) | Physical directional classes (`left-`, `right-`, `ml-`, `mr-`, `pl-`, `pr-`) | None detected (PASS via `scripts/check-rtl-classes.js`) | All screens |
| 53 | `apps/web/src/pages/instructor/InstructorReviewPage.jsx:25` | `useBankQuestions` lacks `isError` handling / retry action | Add `isError` branch with `<Alert variant="danger">` and retry | Instructor Review |
| 54 | `apps/web/src/features/bank/BankQuestionList.jsx:62` | Empty list when filters match no questions is unstyled | Enhance with structured empty state icon + clear message | Instructor Review |
| 55 | `apps/web/src/components/ui/Alert.jsx:5-10` | `ALERT_STYLES` lacks `danger` variant, defaulting to blue `info` | Add `danger: 'bg-rose-50 border-rose-200 text-rose-800'` | Quiz / Report / Tests / Catalog |
| 56 | `apps/web/src/components/ui/Badge.jsx:5-12` | `BADGE_STYLES` lacks `primary` variant, falling back to default | Explicitly define `primary: 'bg-sky-100 text-sky-800'` | Resident Home / Practice Home |
| 57 | `apps/web/src/app/layouts/ResidentLayout.jsx:24,62` | Header has `px-6`, main has `p-6` instead of `px-4 md:px-6`; no mobile menu | Add responsive mobile menu toggle and standard page padding | Shell / Nav (Resident) |
| 58 | `apps/web/src/app/layouts/InstructorLayout.jsx:26,66` | Header has `px-6`, main has `p-6` instead of `px-4 md:px-6`; no mobile menu | Add responsive mobile menu toggle and standard page padding | Shell / Nav (Instructor) |

---

## 2. Found by Mahdi

*(Mahdi reviewed the UI and reported these additional requirements)*

| # | file:line | problem | proposed fix | screen |
|---|---|---|---|---|
| M1 | `ResidentHomePage.jsx:34,55,76,97` & `InstructorHomePage.jsx:34,55,76` | Developer task badges (T06, T08, T09) displayed on production cards | Remove task badge tags from all dashboard cards | Resident Home, Instructor Home |
| M2 | `ProgressView.jsx` & `LineChart.jsx` & `ResidentDetailPage.jsx` | Chart labels, table text, and metrics in progress views are barely visible / low contrast | Overhaul text colors to high-contrast tokens, fix sizing and dark-mode readability | Resident Progress, Instructor Resident Detail |

---

## 3. Summary of Findings

- **Total issues identified by static audit:** 58 items.
  - Low-contrast text classes & placeholders: 42 items.
  - Border/divider spacing against buttons: 3 items.
  - Raw unstyled `<select>` elements: 6 items.
  - Physical CSS violations: 0 items (clean RTL).
  - Missing query error/empty states: 2 items.
  - Component variant mappings & responsive shell padding: 5 items.
- **Next Step:** Commit this audit as `docs(qa): add UI audit` and await Mahdi's review/additions before proceeding to Step 1 (Tokens).
