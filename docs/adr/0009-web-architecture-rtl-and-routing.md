# ADR 0009 — Web Architecture, RTL Enforcement, and Routing

Status: accepted (2026-11-01, Operator A)

## Context
The frontend application (`apps/web`) provides the user interface for both radiology residents and instructors. Building a bilingual (Persian RTL default, English LTR secondary) medical educational application on Windows requires precise architectural boundaries: avoiding layout shifts, enforcing accessible forms, preventing diagnostic image inversion, and cleanly managing authentication state without local storage token vulnerabilities.

## Decisions

### 1. Framework, Tooling, and Library-Mode Router
- **React 19 + Vite 8 (ES Modules, Plain JavaScript):** Uses pure JavaScript JSX without TypeScript, ensuring both operators can read, maintain, and defend every line.
- **React Router 7 (`react-router`):** Configured via `createBrowserRouter` and `<RouterProvider>` from the `react-router` package in library mode. All routes exist from day one, using structured placeholder components for features slated for T06 and T08.
- **Root Redirection:** An authenticated resident landing on `/` is automatically routed to `/app`; an instructor to `/instructor`; unauthenticated visitors are sent to `/login`.

### 2. Dev Server Proxy Topology and Cookie Sessions
- **Single-Origin Topology:** Vite dev server runs on `http://127.0.0.1:5173` with `strictPort: true` and proxies all `/api` traffic to Express on `http://127.0.0.1:4000`.
- **Zero Token Local Storage:** The browser receives and sends `httpOnly`, `SameSite=Lax` session cookies (`rt_session`) naturally without cross-origin configuration hurdles or CORS preflight overhead. `localStorage` is exclusively permitted for the UI language preference (`rt_lang`).

### 3. RTL Logical Utility Discipline and Automated Scanner
- **Logical Tailwind CSS 4 Utilities:** Components exclusively use logical utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `border-s`, `rounded-s-*`).
- **Automated Guard:** `scripts/check-rtl-classes.js` scans source files for physical direction patterns (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`, `scale-x-`). Lines annotated with `rtl-ok` are permitted (e.g., directional chevron icon flips or LTR code blocks). This script is wired into `npm run lint` and CI.

### 4. Anatomical Medical Image Integrity (`XrayImage`)
- **Marker Orientation Protection:** Radiographs contain anatomical Left/Right markers (`L`, `R`) critical to distinguishing dextrocardia, situs inversus, or asymmetric consolidation.
- **Container Directive:** The `XrayImage` component permanently enforces `dir="ltr"` on its outer container and prohibits any CSS transform or `scale-x` variants, ensuring medical images are never mirrored in RTL contexts.

### 5. Server State and Runtime Contracts
- **TanStack Query 5:** Manages server cache. The user session is modeled under query key `['me']`. A 401 response is handled gracefully as `null` rather than a fatal query error.
- **Contract Schema Validation:** Client-side form submissions validate inputs using the exact same Zod schemas (`LoginBodySchema`, `RegisterBodySchema`) exported by `@radiology/contracts`.

## Consequences
- Clean separation between server state (TanStack Query) and transient client state.
- Accidental introduction of physical CSS classes triggers immediate failure in lint and CI.
- Medical radiographs are guaranteed never to suffer diagnostic inversion.
