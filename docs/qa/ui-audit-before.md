# UI Audit Report — Baseline (Before Polish Pass)

- **Date:** 2026-11-12
- **Scope:** All 19 page components under `apps/web/src/pages/` plus layout shells, shared navigation, and UI components.
- **Viewports Inspected:** Desktop (1366x768), Large Desktop (1920x1080), Mobile (390x844).
- **Target Guidelines:** `docs/qa/UI-CHECKLIST.md` (WCAG 2.1 AA, 4.5:1 text contrast, 40px touch targets, RTL logical layout, state coverage).

---

## 1. Executive Summary

A comprehensive pre-polish audit was performed on `apps/web/src` prior to the T15 styling changes. The audit identified **58 static code issues** and **2 user-reported visual defects** across the application:

| Category | Finding Count | Severity | Summary |
|---|---|---|---|
| **Text Contrast (< 4.5:1 / 3:1)** | 42 | High | Low-contrast classes (`text-slate-400`, `text-slate-300`, `placeholder:text-slate-400`), unreadable dark mode texts, muted table text. |
| **Divider & Border Clearance** | 3 | Medium | Card footers and action rows directly touching dividers/borders without required `pt-4` / `mt-4` margin. |
| **Native Unstyled Selects** | 6 | Medium | Native `<select>` tags missing custom chevron wrapper, RTL logical padding (`ps-3 pe-10`), and uniform 40px height. |
| **Missing States & Error Handling** | 2 | Medium | Missing query error/retry banner in Instructor Review; unstyled empty state in question list. |
| **Component Variants & Layout Shell** | 5 | Medium | `danger` variant missing in Alert; `primary` variant missing in Badge; buttons lacking 40px min-height; header/layout lacking mobile drawer menu. |
| **Production Badge Artifacts** | 2 | Low | Developer task badges (`T06`, `T08`, `T09`) visible on production cards; chart labels and metrics unreadable on dark canvases. |
| **Total Baseline Findings** | **60** | - | Complete inventory cataloged in `docs/qa/UI-AUDIT.md`. |

---

## 2. Most Frequent Findings (Shared Root Causes)

1. **Stray Low-Contrast Palette Classes (42 instances):**
   - Classes `text-slate-400` (~3.2:1 contrast against white) and `text-slate-300` (~2.1:1) were widely used for helper text, card subtitles, chart legends, table cells, and input placeholders.
   - None of these met WCAG AA 4.5:1 requirement for normal text.

2. **CardFooter and Button Divider Collision (3 instances):**
   - Default `CardFooter` had `p-5 pt-0 border-t` causing action buttons to physically touch the divider border.
   - Question list pagination and education card footers had minimal `pt-2 / mt-2` clearance.

3. **Unstyled Native Dropdowns (6 instances):**
   - `<select>` elements in `TestsPage`, `BankFilterBar`, and `CatalogFilterBar` had default browser styling, inconsistent font sizing, and no custom chevron indicator.

4. **Incomplete Responsive Layout Shells:**
   - Both `ResidentLayout` and `InstructorLayout` had rigid horizontal layouts that overflowed or cramped on mobile viewports (390x844) without a hamburger drawer navigation menu.

---

## 3. Baseline Audit Metrics per Target Category

| Target Category | Baseline Count | Target for Final |
|---|---|---|
| Low-contrast text violations (< 4.5:1) | 42 | 0 |
| Touching dividers / borders (< 16px) | 3 | 0 |
| Native unstyled `<select>` elements | 6 | 0 |
| Physical directional CSS classes | 0 | 0 (pass) |
| Missing error / empty states | 2 | 0 |
| Developer task badges on UI | 7 | 0 |
| Console errors during navigation | 0 | 0 (pass) |
| Text smaller than 12px | 8 | 0 |

---

## 4. Per-Screen Breakdown at Baseline

1. **Login & Register (`/login`, `/register`):**
   - Button heights variable (not fixed 40px).
   - Input placeholder contrast was 3.2:1 (`placeholder:text-slate-400`).
   - Register name placeholder was hardcoded Persian.
2. **Resident Dashboard (`/resident`):**
   - Displayed development badges `T06`, `T09` on production action cards.
   - Responsive padding was fixed `p-6` instead of `px-4 md:px-6`.
3. **Tests List (`/resident/tests`):**
   - Filter dropdown was unstyled native `<select>`.
   - Empty state lacked friendly illustration/card structure.
4. **Quiz (`/resident/tests/:id`):**
   - Keyboard shortcut badges (`[1]`, `[2]`, `[3]`) used `text-slate-400`.
   - Image box error fallback used raw low-contrast text.
5. **Score Report (`/resident/tests/:id/report`):**
   - 3x3 matrix zero-count cells used `text-slate-400`.
   - Subtitle metadata used low-contrast classes.
6. **Review (`/resident/tests/:id/review`):**
   - Filter empty state text used `text-slate-400`.
7. **Practice Home & Practice Set (`/resident/practice`):**
   - Missing pagination translation keys causing fallback issues.
   - Practice set question buttons lacked localized accessible aria labels.
8. **Progress (`/resident/progress`):**
   - Chart labels and axes in `LineChart` had poor contrast against dark theme tokens.
   - Confusion pair arrows were reversed in English mode.
9. **Education (`/resident/education`):**
   - Card headers repeated disease titles three times.
   - Badges were hardcoded in Persian even when language was English.
10. **Instructor Dashboard (`/instructor`):**
    - Displayed development badges `T08`, `T09` on cards.
11. **Instructor Residents & Detail (`/instructor/residents`, `/instructor/residents/:id`):**
    - Resident table cells and footer metadata used `dark:text-slate-400`.
12. **Instructor Review Panel (`/instructor/review`):**
    - Dropdowns in filter bar were native unstyled `<select>`.
    - Question options letters were hardcoded to Persian `[الف, ب, ج, د]`.
    - Missing error alert and retry button on query failure.
13. **Instructor Catalog (`/instructor/catalog`):**
    - Image ID metadata used `text-[11px] text-slate-400`.
    - Bias notice title contained internal reference `(ADR 0005)`.
14. **Navigation Shells (`ResidentLayout`, `InstructorLayout`):**
    - No mobile drawer menu; fixed desktop padding.
    - Avatar initial fallback was hardcoded to Persian `ر` and `ا`.

---

*This baseline report establishes the initial defect count (60 issues) to be eliminated in the T15 UI polish pass.*
