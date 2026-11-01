---
name: persian-rtl-ui
description: Rules for building the Persian right-to-left React UI in apps/web (plain JavaScript/JSX) with Tailwind CSS 4, i18next, Vazirmatn font, Jalali dates, Persian digits, charts, medical image display, and the separate resident and instructor panels. Use this skill whenever you create or edit anything in apps/web - pages, components, layouts, forms, charts, translations, panels - or when anyone mentions Persian, Farsi, RTL, i18n, bilingual, font, UI text, resident panel, or instructor panel.
---

# Persian RTL UI rules (apps/web, JavaScript + JSX)

## Setup facts
- `<html lang="fa" dir="rtl">` by default; English sets `lang="en" dir="ltr"` through ONE `useDirection` hook driven by the i18n language.
- Font: `@fontsource-variable/vazirmatn` imported once in `main.jsx`; Tailwind theme font stack `Vazirmatn Variable, system-ui, sans-serif`.
- i18n: `i18next` + `react-i18next`; locale files `src/i18n/locales/{fa,en}.json`; default `fa`. ZERO hard-coded user-visible text in components. A unit test fails if `fa` and `en` key sets differ.
- Numbers/dates only through helpers in `lib/format.js`: `fmt.number/percent` using `Intl.NumberFormat(lang==='fa'?'fa-IR':'en-US')`, `fmt.date` using `Intl.DateTimeFormat('fa-IR-u-ca-persian')`. Never store Persian digits in data/API.
- Files are `.jsx`; props documented with JSDoc `@param`/`@typedef`. Vite template: plain React (JavaScript, React Router 7 in library mode).

## Two panels (routes)
- Resident panel: `/app/*` (home, tests, quiz, report, progress, education).
- Instructor panel: `/instructor/*` (home, question review, resident roster, catalog monitoring).
- Route guards: `RequireAuth` and `RequireRole` from `useMe()` query. A resident is routed to `/forbidden` if attempting to access `/instructor`. Shared layout architecture with role-specific navigation bars and persistent educational disclaimer in footers.

## Layout and CSS
- Logical utilities only: `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `border-s`, `rounded-s-*`. Never `ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`, `text-left`, `text-right`.
- Enforced by `scripts/check-rtl-classes.js` in `npm run lint` and CI. Lines requiring intentional physical classes (directional icon flip, LTR code blocks) must append `rtl-ok`.
- Directional icons (chevron, arrow, back) flip with `rtl:rotate-180` / `rtl:-scale-x-100` on the ICON only (with `rtl-ok`).
- Mixed-direction text (`COVID-19`, `Pneumonia`, numbers with units): wrap in `<bdi>` or a `dir="ltr"` span.
- Forms: label above input, message under it; server `error.code` mapped to i18n keys (`errors.<CODE>`), never raw server text.

## Medical images (critical)
Radiographs contain L/R markers: NEVER mirror, flip or rotate them in RTL. Image container `dir="ltr"`; no `rtl:` transforms on images. Use the `XrayImage` component which strictly enforces `dir="ltr"` and fixed aspect ratio. Alt text via i18n; lazy-load; images come from the API file route (`/api/images/:publicId/file`).

## Charts (Recharts)
Time runs left-to-right inside charts (ADR 0009); wrap each chart in `dir="ltr"`; localize labels, tooltips, legends with i18n.

## Quiz and review UX
Keyboard-operable (arrows select, Enter submits), visible focus, AA contrast, `aria-live` feedback, 44px touch targets. Loading, empty and error states on every data screen. LLM panels: skeleton -> text -> `disclaimer.educational`; generated questions show a small "AI-generated, instructor-approved" badge.

## Testing
Vitest + React Testing Library + jsdom: render key pages in `fa` and assert `dir="rtl"`; i18n key-parity test; role-guard tests; RTL class scanner regression suite.
