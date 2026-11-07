# T04 — Web foundation (React + Vite + Tailwind RTL, i18n, auth pages, panel shells)

Developer: Mahdi · Branch: `feat/T04-web-foundation` · Skills: `persian-rtl-ui`, `git-workflow`, `review-workflow` · Estimate: 6 h · Folders: `apps/web`, root config files named below, `docs/`.

If this task and a skill disagree, THIS TASK WINS; record deviations in ADR 0009 and sync the skill at the end.

## Goal
A Persian right-to-left React app that logs in against the real API, knows the two roles, and has empty but navigable shells for the resident panel and the instructor panel, so later tasks (T06, T08, T09) only fill pages. No test-taking UI yet.

## Prerequisites
T03 merged; `/sync` done; the API runs (`npm run dev -w @radiology/api`), the catalog is seeded, and one instructor exists. Read `packages/contracts/src/auth.js` and `common.js` first (do not guess shapes).

## Binding decisions
| Topic | Decision |
|---|---|
| Template | `npm create vite@latest apps/web -- --template react` (JavaScript). Answer the prompts conservatively (no "start now", no experimental options unless the current docs recommend them; tell the developer what was asked) |
| UI kit | none; Tailwind CSS 4 utilities + a tiny own component set |
| Router | `react-router` v7 with `createBrowserRouter` + `RouterProvider` (verify imports in the current docs; the package is `react-router`, not `react-router-dom`) |
| Server state | TanStack Query 5; auth state is the `['me']` query |
| i18n | `i18next` + `react-i18next`; default `fa`; `en` has the same keys (English UI is a "Should", but the keys must exist) |
| Dev topology | Vite dev server on `127.0.0.1:5173`, `strictPort`, proxy `/api` -> `http://127.0.0.1:4000` (same-origin cookies) |
| Fonts | `@fontsource-variable/vazirmatn` (verify the package name with `npm view`) |
| RTL | logical Tailwind utilities only; enforced by `scripts/check-rtl-classes.js` |
| Images | X-ray images are never mirrored or flipped; the component `XrayImage` enforces it |
| Storage | `localStorage` only for the language choice (`rt_lang`); never for tokens |

## Routes (all pages exist now; unfinished ones show a "coming in Txx" placeholder with an i18n key)
Public: `/login`, `/register`. Resident (role `resident`): `/app` (home), `/app/tests`, `/app/tests/:sessionId`, `/app/reports/:sessionId`, `/app/progress`, `/app/education`. Instructor (role `instructor`): `/instructor` (home), `/instructor/review`, `/instructor/residents`, `/instructor/catalog`. Fallbacks: `/forbidden`, `*` (not found). After login: resident -> `/app`, instructor -> `/instructor`. `RequireAuth` redirects anonymous users to `/login` (remember the target in the router state); `RequireRole` sends a wrong-role user to `/forbidden`.

## Initial Persian strings (`src/i18n/locales/fa.json`; create `en.json` with the same keys and natural English)
```json
{
  "app": { "name": "آموزش تطبیقی رادیولوژی", "tagline": "تمرین تشخیص روی تصاویر رادیوگرافی قفسه سینه" },
  "nav": { "home": "خانه", "tests": "آزمون‌ها", "progress": "پیشرفت من", "education": "آموزش", "review": "بازبینی سؤال‌ها", "residents": "رزیدنت‌ها", "catalog": "کاتالوگ تصاویر", "logout": "خروج", "language": "زبان" },
  "auth": { "login": "ورود", "register": "ثبت‌نام", "email": "ایمیل", "password": "گذرواژه", "displayName": "نام نمایشی", "submitLogin": "ورود به سامانه", "submitRegister": "ایجاد حساب", "noAccount": "حساب ندارید؟", "haveAccount": "حساب دارید؟", "passwordHint": "حداقل ۸ نویسه" },
  "home": { "welcome": "خوش آمدید، {{name}}", "startTest": "شروع آزمون", "reviewTests": "بازبینی آزمون‌ها", "education": "آموزش", "profile": "اطلاعات کاربری", "comingSoon": "به‌زودی" },
  "errors": {
    "VALIDATION_ERROR": "اطلاعات واردشده معتبر نیست.",
    "EMAIL_TAKEN": "این ایمیل قبلاً ثبت شده است.",
    "INVALID_CREDENTIALS": "ایمیل یا گذرواژه درست نیست.",
    "UNAUTHENTICATED": "لطفاً دوباره وارد شوید.",
    "FORBIDDEN": "دسترسی به این بخش مجاز نیست.",
    "NOT_FOUND": "موردی پیدا نشد.",
    "RATE_LIMITED": "تعداد تلاش‌ها زیاد بود؛ چند دقیقه بعد دوباره امتحان کنید.",
    "UNSUPPORTED_MEDIA_TYPE": "درخواست نامعتبر بود.",
    "NETWORK": "ارتباط با سرور برقرار نشد.",
    "INTERNAL_ERROR": "خطای غیرمنتظره‌ای رخ داد."
  },
  "disclaimer": { "educational": "این سامانه فقط برای آموزش است و جایگزین تشخیص بالینی نیست." },
  "classes": { "covid19": "کووید-۱۹", "pneumonia": "ذات‌الریه", "normal": "طبیعی" },
  "buckets": { "easy": "آسان", "medium": "متوسط", "hard": "سخت" },
  "common": { "loading": "در حال بارگذاری…", "retry": "تلاش دوباره", "back": "بازگشت", "notFound": "صفحه پیدا نشد", "forbidden": "دسترسی ندارید" }
}
```
Add keys for placeholders and page titles as needed; every key must exist in both files (a test enforces it). Class names, `COVID-19`, `Pneumonia` and numbers with units inside Persian text are wrapped in `<bdi>`.

## Structure (`apps/web/src`)
`main.jsx` · `app/{router,providers,layouts/{PublicLayout,ResidentLayout,InstructorLayout},guards/{RequireAuth,RequireRole}}.jsx` · `pages/{auth,resident,instructor,system}/*` · `components/ui/{Button,Input,Field,Card,Alert,Badge,Spinner,XrayImage,LanguageSwitcher}.jsx` · `lib/{api,format,direction}.js` · `features/auth/{hooks.js,schemas.js}` · `i18n/{index.js,locales/fa.json,locales/en.json}` · `test/setup.js` · `scripts/check-rtl-classes.js`.

## Behaviors to implement
- **API client** (`lib/api.js`): `fetch` with `credentials: 'include'`, JSON in/out, throws `ApiError { code, status, message, details }`; network failure -> code `NETWORK`; every response body is parsed with the Zod schema from `@radiology/contracts` where a schema exists. Never show raw server messages: map `code` to `errors.<CODE>`.
- **Auth hooks** (`features/auth/hooks.js`): `useMe` (401 resolves to `null`, not an error), `useLogin`, `useRegister`, `useLogout` (clears the query cache).
- **Forms:** validate on the client with the SAME contract schemas (`LoginBodySchema`, `RegisterBodySchema`); show field errors under inputs, a form-level `Alert role="alert"` for API errors, disable the button while submitting, labels above inputs, keyboard friendly, `autocomplete` attributes set (`email`, `current-password`, `new-password`).
- **Direction:** `useDirection()` sets `<html lang dir>` from the i18n language; the language switcher persists to `rt_lang`.
- **Formatting** (`lib/format.js`): `fmt.number`, `fmt.percent`, `fmt.date` using `Intl` (`fa-IR`, Persian calendar for dates); digits stay Latin in data and are localized only at display time.
- **Layouts:** responsive; top bar with app name, nav, language switcher, user name and logout; the educational disclaimer in the footer; the resident home shows four cards (start test, review tests, education, profile) matching the paper's dashboard, the "start test" card disabled with the `comingSoon` badge until T06; the instructor home shows cards for review, residents, catalog, also disabled/placeholder.
- **`XrayImage`**: wrapper with `dir="ltr"`, fixed aspect ratio (`aspect-square`), `loading="lazy"`, `alt` from i18n, NO transform classes, no `rtl:` variants. Not used by a page yet; tested.

## `scripts/check-rtl-classes.js`
Scan `apps/web/src/**/*.{js,jsx,css}` and fail (exit 1, list file:line) on these patterns unless the same line contains `rtl-ok`: `\b(ml|mr|pl|pr|left|right)-(\d|\[|px\b|auto\b|full\b)`, `\btext-(left|right)\b`, `\b(rounded|border)-(l|r)(-|\b)`, `\bfloat-(left|right)\b`, `\bscale-x-`. Wire it into the web `lint` script and CI. Add a test with a fixture that proves it catches each pattern and honors `rtl-ok`.

## Tests (Vitest + React Testing Library + jsdom; `apps/web/vitest.config.js` with `environment: 'jsdom'`; stub `fetch`, no network)
i18n key parity fa/en · direction hook sets `dir="rtl"` for `fa` and `dir="ltr"` for `en` · format helpers (Persian digits for `fa`) · login success redirects by role · `INVALID_CREDENTIALS` shows the localized message · client-side validation messages · `RequireAuth` redirect and return-to-target · `RequireRole` blocks a resident from `/instructor` · `XrayImage` has `dir="ltr"` and no transform/rtl classes · the rtl-class script.

## Steps (commit after each, push after every 1-3)
1. `chore(web): scaffold vite react app in apps/web` — remove demo assets; package name `@radiology/web`; dependencies via the protocol (`react`/`react-dom` 19.3.x exact same version, `react-router`, `@tanstack/react-query`, `i18next`, `react-i18next`, `@fontsource-variable/vazirmatn`, `tailwindcss`, `@tailwindcss/vite`, `@radiology/contracts`; dev: `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`); Vite config (host, port, strictPort, proxy, React and Tailwind plugins).
2. `feat(web): add tailwind rtl base styles and ui kit` — `index.css` with `@import "tailwindcss";` and an `@theme` font stack; components + tests.
3. `feat(web): add i18n with fa and en locales and direction handling`.
4. `feat(web): add api client and auth hooks`.
5. `feat(web): add router, layouts and route guards` (+ placeholder pages).
6. `feat(web): add login and register pages`.
7. `feat(web): add resident and instructor home shells`.
8. `chore(web): add rtl class check and react lint rules` — extend the root `eslint.config.js` with a block for `apps/web/**/*.{js,jsx}` (browser globals, React rules); keep the existing rules for other packages.
9. `chore(repo): add root dev script for api and web` — `concurrently` (verify the package) so `npm run dev` starts both; document in the root README.
10. `docs(web): add web readme, ADR 0009 and sync persian-rtl-ui skill` — ADR 0009 records the proxy topology, the RTL lint rule, the router choice; sync the skill (under 12,000 characters), board, developer log.

## Verification (show real outputs)
`npm run lint`, `npm test`, `npm run build` pass (the web build must succeed). Run `npm run dev`, open `http://127.0.0.1:5173` with the Antigravity browser or your browser: register a resident, log in, see `/app` in RTL with Vazirmatn; log out; log in as the instructor and see `/instructor`; try `/instructor` as the resident and see `/forbidden`; switch to English and see `dir="ltr"`. Take two screenshots (login, resident home) and attach them to the PR.

## Acceptance criteria
- [ ] Both panels reachable with the right role; guards work; every route exists.
- [ ] No hard-coded user-visible strings; fa/en key parity test passes; RTL check script is in CI.
- [ ] Forms use the contract schemas; API errors are localized; no raw server text is shown.
- [ ] Web tests pass in the root `npm test` (Vitest projects); CI is green.
- [ ] ADR 0009, skill sync, board and log updated; AI review done and blockers fixed.

## Out of scope
Quiz UI, reports, charts, LLM panels (T06+), deployment, a UI component library, dark mode.
