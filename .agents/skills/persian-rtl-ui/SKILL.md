---
name: persian-rtl-ui
description: Rules for building the Persian right-to-left React UI in apps/web (plain JavaScript/JSX) with Tailwind CSS 4, i18next, Vazirmatn font, Jalali dates, Persian digits, charts, medical image display, and the separate resident and instructor panels. Use this skill whenever you create or edit anything in apps/web - pages, components, layouts, forms, charts, translations, panels - or when anyone mentions Persian, Farsi, RTL, i18n, bilingual, font, UI text, resident panel, or instructor panel.
---

# Persian RTL UI rules (apps/web, JavaScript + JSX)

## Setup facts
- `<html lang="fa" dir="rtl">` by default; English sets `lang="en" dir="ltr"` through ONE `useDirection` hook driven by the i18n language.
- Font: `@fontsource-variable/vazirmatn` imported once in `main.jsx`; Tailwind theme font stack `Vazirmatn Variable, system-ui, sans-serif`. Verify the package with `npm view` first.
- i18n: `i18next` + `react-i18next`; per-feature files `src/i18n/locales/{fa,en}/<feature>.json` (fewer merge conflicts between the two operators); default `fa`. ZERO hard-coded user-visible text in components. A unit test fails if `fa` and `en` key sets differ.
- Numbers/dates only through helpers: `fmt.number/percent` using `Intl.NumberFormat(lang==='fa'?'fa-IR':'en-US')`, `fmt.date` using `Intl.DateTimeFormat('fa-IR-u-ca-persian')`. Never store Persian digits in data/API.
- Files are `.jsx`; props documented with JSDoc `@param`/`@typedef`. Vite template: plain React (JavaScript).

## Two panels (routes)
`/resident/*` (dashboard, start test, quiz, report, review, targeted practice, progress, education) and `/instructor/*` (residents list and progress, question review, statistics). Route guards by role from `GET /me`; a resident never sees instructor routes. Shared layout components, separate navigation per role.

## Layout and CSS
- Logical utilities only: `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `border-s`, `rounded-s-*`. Never `ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`, `text-left`, `text-right` (add a grep check in CI).
- Directional icons (chevron, arrow, back) flip with `rtl:rotate-180` / `rtl:-scale-x-100` on the ICON only.
- Mixed-direction text (`COVID-19`, `Pneumonia`, numbers with units): wrap in `<bdi>` or a `dir="ltr"` span.
- Forms: label above input, message under it; server `error.code` mapped to i18n keys, never raw server text.

## Medical images (critical)
Radiographs contain L/R markers: NEVER mirror, flip or rotate them in RTL. Image container `dir="ltr"`; no `rtl:` transforms on images. Alt text via i18n; lazy-load; fixed aspect-ratio box; images come from the API file route, not base64 in JSON.

## Charts (Recharts)
Time runs left-to-right inside charts (record in an ADR); wrap each chart in `dir="ltr"`; localize labels, tooltips, legends with i18n.

## Quiz and review UX
Keyboard-operable (arrows select, Enter submits), visible focus, AA contrast, `aria-live` feedback, 44px touch targets. Loading, empty and error states on every data screen. LLM panels: skeleton -> text -> `disclaimer.educational`; generated questions show a small "AI-generated, instructor-approved" badge.

## Testing
Vitest + React Testing Library: render key pages in `fa` and assert `dir="rtl"`; i18n key-parity test; role-guard test; one component in both languages.
