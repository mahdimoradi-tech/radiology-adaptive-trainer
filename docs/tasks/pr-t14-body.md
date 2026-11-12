## Task

- **Task ID:** T14
- **Branch:** chore/T14-qa-security

## Summary

### What
This PR completes **Task T14 Part B (Security verification, route inventory, regression testing, and bug logging)**:
1. **API Route Inventory (`docs/qa/ROUTE-INVENTORY.md`):** Cataloged all 31 Express 5 routes with HTTP methods, URL paths, middleware stacks, authentication rules, and role constraints (`public`: 4, shared authenticated: 2, `resident`-only: 13, `instructor`-only: 12).
2. **Security Verification Report (`docs/qa/SECURITY-REPORT.md`):** Full empirical evaluation of all 26 checklist items (S01–S26):
   - **PASS: 23 / 26 items** (88.5%)
   - **PARTIAL: 3 / 26 items** (11.5% — S06 rate limiting coverage, S16 invalid ObjectId 500 error, S22 dev-only minimatch audit)
   - **FAIL: 0**
   - **N/A: 0**
   - **NOT-TESTED: 0**
3. **Automated Security Regression Suite (`apps/api/src/__tests__/security/`):** Added 43 new unit/integration tests across 5 focused security test suites:
   - `auth.security.test.js` (12 tests): Cookie security flags, JWT algorithm pinning & tamper resistance (`alg:none`, bad secret, expired, deleted user), database-driven dynamic role changes, password byte limits (8..72 bytes), constant-time dummy hash mitigation against user enumeration.
   - `authz.security.test.js` (11 tests): Logout cookie clearing, strict IDOR isolation across residents, path traversal denial on radiographs, opaque HMAC public IDs.
   - `input.security.test.js` (10 tests): CSRF content-type enforcement (`jsonOnly` 415), NoSQL object injection prevention (400), malformed JSON syntax handling (400), payload size cap (100kb -> 413), mass assignment role escalation prevention.
   - `headers.security.test.js` (4 tests): Helmet security headers (`nosniff`, `SAMEORIGIN`, `x-powered-by` disabled), preflight CORS with credentials, Zod rejection of wildcard `*` CORS origin.
   - `lifecycle.security.test.js` (6 tests): Baseline requirement enforcement, answering after finish rejection (409), double finish rejection (409), question number bounds checks (404), answer idempotency, question bank status filtering (`status: 'approved'` only).
4. **Bug & Finding Log (`docs/qa/BUG-LOG.md`):** Recorded all findings (BUG-001 through BUG-004) with reproduction commands and proposed severities for triage in Part C:
   - **BUG-001 (Major):** Malformed ObjectId in URL parameter triggers unhandled Mongoose `CastError`, returning HTTP 500 instead of 404/400.
   - **BUG-002 (Minor):** General training session and practice endpoints lack route-level rate limiters.
   - **BUG-003 (Minor / Deferred):** Stateless JWT remains signature-valid until TTL (12h) after logout (ADR 0007 accepted trade-off).
   - **BUG-004 (Minor / Deferred):** 4 moderate severity vulnerabilities in `minimatch` via dev dependency `eslint` (production runtime has 0 vulnerabilities).
5. **Manual Test Run Template (`docs/qa/manual-run-2026-11-12.md`):** Initialized execution matrix for Part A (M01–M38) for developer browser testing.

### Why
Ensures that before release tagging, all system endpoints are documented, access controls and input boundaries are verified with empirical test evidence, regression guardrails are locked into CI, and any discovered flaws are logged for triage and targeted fixing without modifying application code in the audit branch.

---

## How to Test

```bash
# 1. Monorepo linting and RTL utility checks
npm run lint

# 2. Run new security regression tests
npm test -- apps/api/src/__tests__/security

# 3. Full monorepo test suite (771 tests across 94 files)
npm test

# 4. Monorepo production builds
npm run build

# 5. Verify diff only touches docs and security tests
git diff --name-only main
```

---

## Contract Changes

- **Contract changed?** [ ] Yes / [x] No

---

## Dependencies Added

| Package | Version | Why Needed |
|---|---|---|
| None | - | No dependencies added |

---

## Review & Architecture Notes

- **Zero Application Code Changes:** `git diff --name-only main` lists strictly files under `docs/` and `apps/api/src/__tests__/security/`.
- **Zero Secrets / Zero Bloat:** Verified with `git grep` and `git log` that no credentials, tokens, or raw image binaries were introduced.
- **Part A & Part C Hand-off:** Part B security verification is complete. Developer can execute Part A browser run (M01–M38), and triage findings (BUG-001 through BUG-004) in Part C with targeted `fix/BUG-nnn` branches.

---

## Checklist

- [x] `npm run lint` passes
- [x] `npm test` passes (771/771 tests passed across 94 test files)
- [x] `npm run build` passes
- [x] `docs/PROGRESS.md` board row updated
