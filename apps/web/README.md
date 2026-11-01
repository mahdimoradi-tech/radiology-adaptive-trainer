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
