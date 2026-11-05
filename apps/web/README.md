# @radiology/web

Persian right-to-left React application for the Radiology Adaptive Training Platform.

## Stack

- React 19 (JavaScript, ES modules)
- Vite 8 with `@tailwindcss/vite`
- Tailwind CSS 4 (RTL-first logical utilities)
- React Router 7 (`react-router`)
- TanStack Query 5 (`@tanstack/react-query`)
- i18next & react-i18next (`fa` default, `en` parity)
- `@fontsource-variable/vazirmatn`
- Vitest 4 + React Testing Library + jsdom

## Scripts

- `npm run dev`: starts the Vite dev server with proxy to API (`127.0.0.1:4000`)
- `npm run build`: builds the production distribution in `dist/`
- `npm run test`: runs Vitest component and unit tests
- `npm run lint`: runs ESLint

## Resident Training Features (T06)

- **Tests Overview (`/app/tests`):** Past sessions list, active session continuation, test size selector (45, 60, 90, 120), and error handling (`SESSION_IN_PROGRESS`, `POOL_EXHAUSTED`).
- **Interactive Quiz (`/app/tests/:sessionId`):** Two-column layout with numbered question navigator, dark X-ray viewer without anatomical mirroring, radio diagnosis selection with keyboard shortcuts (1/2/3), optimistic autosave, next-image prefetching, and finish dialog. Zero diagnostic leakage during exam (`QuizLeak.test.jsx`).
- **Performance Report (`/app/reports/:sessionId`):** Accuracy summary, 3x3 confusion matrix, one-vs-rest per-class metrics table, difficulty breakdown tables, mastery indicators without hardcoded cutoffs, and pedagogical plan explanations without revealing catalog deficits.
- **Detailed Review (`/app/reports/:sessionId/review`):** Color-coded status navigator, user vs ground truth diagnosis comparison, filters (all, incorrect, unanswered), and extension slot for AI/LLM feedback.
