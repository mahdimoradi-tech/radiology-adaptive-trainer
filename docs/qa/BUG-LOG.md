# Bug and finding log

One row per finding. Never delete rows; change the status. New findings get the next number (BUG-001, BUG-002, ...). Security findings use the same table and the tag `security`.

## Severity scale
- **Blocker**: data/label leak to a resident, authentication or authorization bypass, data loss, crash or dead end in the main flow (register -> baseline test -> report -> adaptive test -> practice), demo cannot run offline. Fixed before anything else.
- **Major**: a feature gives a wrong result or a confusing error but the main flow can continue; wrong numbers in a report; visible layout break on a main screen. Fixed before the feature freeze ends (target: 2026-11-18).
- **Minor**: small wrong text, rare edge case with a workaround, cosmetic issue on a secondary screen. Fix only if the change is tiny; otherwise Defer.
- **Cosmetic**: spacing/colour polish. Handled by T15, not here.

## Status values
`open` -> `fix-in-progress` (branch name) -> `fixed` (PR number) | `deferred` (reason) | `wont-fix` (reason) | `invalid`.

## Table
| ID | Found by (test id) | Severity | Tag | Short title | Steps to reproduce | Expected | Actual | Status | Fix branch / PR |
|---|---|---|---|---|---|---|---|---|---|
| (example) BUG-000 | M15 | Major | functional | Double click sends two answers | 1. Open quiz 2. Double-click option | one answer saved | two requests | invalid | - |
| BUG-001 | S16 | Major | security | Malformed ObjectId in URL parameters returns 500 instead of 404/400 | 1. Authenticate 2. Send GET /api/sessions/invalid-id | HTTP 404 NOT_FOUND or 400 VALIDATION_ERROR | HTTP 500 INTERNAL_ERROR (unhandled Mongoose CastError) | fixed | #26 |
| BUG-002 | S06 | Minor | security | Training session and practice routes lack route-level rate limiting | 1. Authenticate 2. Rapid loop of POST /api/sessions | HTTP 429 RATE_LIMITED after threshold | Unlimited requests accepted until DB lock | deferred | - |
| BUG-003 | S08 | Minor | security | Stateless JWT remains signature-valid until expiry (12h) after logout | 1. Login and save raw cookie 2. Call /api/auth/logout 3. Use saved cookie | Token rejected immediately | Accepted until 12h expiry (ADR 0007 stateless trade-off) | deferred (ADR 0007 accepted) | - |
| BUG-004 | S22 | Minor | security | Dev dependency minimatch has moderate DoS vulnerability via eslint | 1. Run npm audit | 0 vulnerabilities across all packages | 4 moderate vulnerabilities in dev tooling (0 in prod) | deferred (breaking eslint upgrade) | - |
| BUG-005 | M08 | Minor | functional | دکمه بازگشت در صفحه خطای عدم دسترسی کار نمی‌کند | 1. ورود با اکانت مدرس 2. باز کردن /app 3. کلیک روی بازگشت | بازگشت به صفحه مجاز اصلی (/instructor) | دکمه غیرفعال است یا ریدایرکت نمی‌کند | fixed | #26 |
| BUG-006 | M34 | Cosmetic | UI | اسکرول افقی در ابعاد موبایل (۳۹۰×۸۴۴) | 1. باز کردن نمای موبایل DevTools 2. مشاهده صفحه آزمون/کارنامه | چیدمان ریسپانسیو بدون اسکرول افقی | اسکرول افقی مشاهده می‌شود | deferred (T15 UI polish) | - |
| BUG-007 | M23 | Minor | UX | عدم وجود بنر توضیحی درباره الزام آزمون خط پایه قبل از انطباقی | 1. ثبت‌نام رزیدنت جدید 2. مشاهده صفحه آزمون‌ها | توضیح صریح که آزمون ۱ الزاما خط پایه است | آزمون مستقیماً خط پایه ایجاد می‌شود بدون توضیح | deferred (T15 UI polish) | - |

## Fix policy
- One bug = one branch `fix/BUG-nnn-short-name` = one PR; the PR adds a regression test that fails before the fix.
- Claude classifies each finding (Blocker / Major / Minor / Defer / Ignore) before the agent fixes it.
- After any Blocker or Major fix, re-run the related manual tests (see MANUAL-TEST-PLAN.md) and `npm test`.
