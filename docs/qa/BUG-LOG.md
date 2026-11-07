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

## Fix policy
- One bug = one branch `fix/BUG-nnn-short-name` = one PR; the PR adds a regression test that fails before the fix.
- Claude classifies each finding (Blocker / Major / Minor / Defer / Ignore) before the agent fixes it.
- After any Blocker or Major fix, re-run the related manual tests (see MANUAL-TEST-PLAN.md) and `npm test`.
