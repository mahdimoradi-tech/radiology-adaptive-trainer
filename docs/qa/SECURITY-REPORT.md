# Security Verification Report (T14 Part B)

Date of audit: 2026-11-12  
Auditor persona: Antigravity AI Agent  
Environment: Node.js v24.11.0, Express 5, MongoDB 8.3, Windows 11 PowerShell 5.1  
Repository branch: `chore/T14-qa-security`

---

## Executive Summary

A comprehensive 26-point security audit (S01–S26) was conducted across the backend API (`apps/api`), contracts (`packages/contracts`), frontend client (`apps/web`), and git repository history.

| Result | Count | Items |
|---|---|---|
| **PASS** | 23 | S01, S02, S03, S04, S05, S07, S08, S09, S10, S11, S12, S13, S14, S15, S17, S18, S19, S20, S21, S23, S24, S25, S26 |
| **PARTIAL** | 3 | S06 (rate limiting coverage), S16 (invalid ObjectId 500), S22 (dev-only minimatch audit) |
| **FAIL** | 0 | None |
| **N/A** | 0 | None |
| **NOT-TESTED** | 0 | None |
| **Total** | **26** | **100% of checklist evaluated with empirical command evidence** |

New regression test suites were authored under `apps/api/src/__tests__/security/` (43 passing tests across 5 test files):
1. `auth.security.test.js` (12 tests)
2. `authz.security.test.js` (11 tests)
3. `input.security.test.js` (10 tests)
4. `headers.security.test.js` (4 tests)
5. `lifecycle.security.test.js` (6 tests)

Identified weaknesses have been logged in `docs/qa/BUG-LOG.md` (BUG-001 through BUG-004) for triage and remediation.

---

## Detailed Item-by-Item Verification Table

| ID | Area | Decision | Evidence & Execution Summary | Findings / Notes |
|---|---|---|---|---|
| **S01** | Cookies | **PASS** | `npm test -- apps/api/src/__tests__/security/auth.security.test.js`<br>Passed: `rt_session` cookie sets `HttpOnly`, `Path=/`, and `SameSite=Lax`. When `COOKIE_SECURE=true` or `NODE_ENV=production`, `Secure` flag is enforced in Set-Cookie header. | Covered by `auth.security.test.js` |
| **S02** | JWT | **PASS** | `npm test -- apps/api/src/__tests__/security/auth.security.test.js`<br>Passed: Rejects `alg:none` tokens, tokens signed with wrong secrets, expired tokens (`-10s`), and tokens belonging to deleted users with `401 UNAUTHENTICATED`. Algorithm pinned to `HS256` in `requireAuth.js:19`. | Covered by `auth.security.test.js` |
| **S03** | JWT | **PASS** | `npm test -- apps/api/src/__tests__/security/auth.security.test.js`<br>Passed: Role is fetched dynamically from MongoDB on every request (`findUserById(payload.sub)`). Database role promotion from `resident` to `instructor` immediately takes effect on next request with identical token. | Covered by `auth.security.test.js` |
| **S04** | Passwords | **PASS** | `npm test -- apps/api/src/__tests__/security/auth.security.test.js`<br>Passed: `PasswordSchema` strictly enforces 8..72 bytes using `TextEncoder`. Passwords hashed with `bcryptjs` (cost 12 in prod, 4 in test). Responses and `toPublicUser` never leak `passwordHash` or `password`. | Covered by `auth.security.test.js` |
| **S05** | User enumeration | **PASS** | `npm test -- apps/api/src/__tests__/security/auth.security.test.js`<br>Passed: Non-existent email and wrong password return identical HTTP 401 `{ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }`. `DUMMY_HASH` comparison runs on missing users. | Covered by `auth.security.test.js` |
| **S06** | Rate limit | **PARTIAL** | Code inspection & tests in `auth.test.js` and `apps/api/src/modules/llm/__tests__/endpoints.test.js`<br>Passed: Rate limiters active on `/api/auth/register`, `/api/auth/login` (20/15min) and `/api/sessions/:id/report-narrative` (30/hour). Returns HTTP 429 `RATE_LIMITED`.<br>Weakness: Other state-changing routes (`/api/sessions`, `/api/practice`) lack route-level limiters. | Logged as **BUG-002** in `BUG-LOG.md` |
| **S07** | CSRF | **PASS** | `npm test -- apps/api/src/__tests__/security/input.security.test.js`<br>Passed: All 12 GET routes are strictly read-only. `jsonOnly` middleware rejects `application/x-www-form-urlencoded`, `multipart/form-data`, and `text/plain` on all POST/PUT routes with HTTP 415 `UNSUPPORTED_MEDIA_TYPE`. | Covered by `input.security.test.js` |
| **S08** | Logout | **PASS** | `npm test -- apps/api/src/__tests__/security/authz.security.test.js`<br>Passed: `POST /api/auth/logout` clears `rt_session` cookie (`Expires=Thu, 01 Jan 1970 00:00:00 GMT` / `Max-Age=0`). Subsequent requests return 401.<br>Note: Stateless JWT remains signature-valid until TTL (12h) if raw string is retained (accepted trade-off in ADR 0007). | Logged as **BUG-003** in `BUG-LOG.md` |
| **S09** | Route coverage | **PASS** | `npm test -- apps/api/src/__tests__/access-matrix.test.js`<br>Passed: 67/67 tests passed. `extractRegisteredRoutes` verifies bidirectional 100% parity between all 31 live Express routes and `ENDPOINT_ACCESS_MATRIX`. | Covered by `access-matrix.test.js` |
| **S10** | IDOR | **PASS** | `npm test -- apps/api/src/__tests__/access-matrix.test.js` & `authz.security.test.js`<br>Passed: Resident A cannot read, answer, finish, or list Resident B's sessions, reports, practice sets, or private session images (HTTP 404). Session list queries filter exclusively by authenticated `req.user._id`. | Covered by `access-matrix.test.js` & `authz.security.test.js` |
| **S11** | Images | **PASS** | `npm test -- apps/api/src/__tests__/security/authz.security.test.js`<br>Passed: Path traversal (`..%2f`, encoded dots, nonexistent IDs) returns 404 `NOT_FOUND`. `canViewImage` restricts residents to their active session/practice images; instructors have global catalog access. Headers set `Cache-Control: private, max-age=86400` with no filename leaks. | Covered by `authz.security.test.js` |
| **S12** | Lifecycle | **PASS** | `npm test -- apps/api/src/__tests__/security/lifecycle.security.test.js`<br>Passed: Answering after finish returns 409 `SESSION_NOT_IN_PROGRESS`. Double finish returns 409 `SESSION_ALREADY_FINISHED`. Out-of-bounds question numbers return 404 `QUESTION_NOT_FOUND`. Answering same question twice is strictly idempotent. New accounts are forced to baseline. | Covered by `lifecycle.security.test.js` |
| **S13** | Label leak | **PASS** | `npm test -- apps/api/src/__tests__/global-leak.test.js`<br>Passed: 8/8 tests pass. Deep recursive search proves `trueClass`, `confusedWith`, `bucket`, `difficulty`, `source`, `catalogId`, `imageId`, `filename`, `passwordHash` and substrings `cohen`, `kermany`, `figure1` never appear in resident payloads or headers. | Covered by `global-leak.test.js` |
| **S14** | Question bank | **PASS** | `npm test -- apps/api/src/__tests__/security/lifecycle.security.test.js`<br>Passed: Targeted practice set builder queries `{ status: 'approved' }`; pending and rejected questions are never loaded. Question `feedback`, `correctIndex`, and `rationale` are strictly omitted prior to answer submission. | Covered by `lifecycle.security.test.js` |
| **S15** | NoSQL injection | **PASS** | `npm test -- apps/api/src/__tests__/security/input.security.test.js`<br>Passed: Object injection payloads (`{"$ne": null}`) in email or password fields fail Zod parsing with 400 `VALIDATION_ERROR`. Grep confirms zero occurrences of raw `req.body` or `req.query` passed directly into Mongoose filters. | Covered by `input.security.test.js` |
| **S16** | Validation | **PARTIAL** | `npm test -- apps/api/src/__tests__/security/input.security.test.js`<br>Passed: Malformed JSON syntax returns 400 `VALIDATION_ERROR`. Oversized bodies (>100kb) return 413 `VALIDATION_ERROR`.<br>Weakness: Malformed/non-hexadecimal ObjectId in URL parameters (e.g. `GET /api/sessions/invalid-id`) causes unhandled Mongoose `CastError`, returning HTTP 500 `INTERNAL_ERROR` instead of 404/400. | Logged as **BUG-001** in `BUG-LOG.md` |
| **S17** | Mass assignment | **PASS** | `npm test -- apps/api/src/__tests__/security/input.security.test.js`<br>Passed: Passing `role: 'instructor'` or `isAdmin: true` during registration does not escalate privilege; `registerUser` forces `role: 'resident'`, and unknown keys are stripped without persisting in MongoDB. | Covered by `input.security.test.js` |
| **S18** | Headers/CORS | **PASS** | `npm test -- apps/api/src/__tests__/security/headers.security.test.js`<br>Passed: Helmet active globally (`nosniff`, `SAMEORIGIN`, `x-powered-by` suppressed). Preflight OPTIONS returns 204 with exact origin and credentials. Zod schema forbids wildcard `*` for `CORS_ORIGIN`. | Covered by `headers.security.test.js` |
| **S19** | Errors/logs | **PASS** | `npm test -- apps/api/src/__tests__/security/headers.security.test.js`<br>Passed: In production mode, error responses return generic `{ error: { code, message } }` with zero stack traces or filesystem paths. Pino HTTP logger redacts `cookie` and `authorization` headers (`[REDACTED]`). | Covered by `headers.security.test.js` |
| **S20** | Env | **PASS** | `npm test -- apps/api/src/config/__tests__/env.test.js`<br>Passed: `EnvSchema` enforces `JWT_SECRET` min 32 characters and forbids `'change-me'` in production. `PUBLIC_ID_SALT` requires min 16 characters. `.env.example` verified to contain exclusively placeholder dummy values. | Covered by `env.test.js` |
| **S21** | Secrets | **PASS** | Command evidence:<br>`git grep -I -E "AIza\|sk-[A-Za-z0-9]{20,}\|-----BEGIN\|mongodb(\+srv)?://[^ ]*:[^ ]*@"` -> 0 matches in code.<br>`git log --all -- .env` -> 0 commits.<br>`git log --all -p -G"AIza[0-9A-Za-z_-]{30,}" -- . ':(exclude)docs/*'` -> 0 commits. | Clean history, zero committed credentials |
| **S22** | Dependencies | **PARTIAL** | Command evidence:<br>`npm audit --omit=dev` -> **0 vulnerabilities** (clean production dependencies).<br>`npm audit` -> 4 moderate vulnerabilities in `minimatch` via dev dependency `eslint`. | Logged as **BUG-004** in `BUG-LOG.md` |
| **S23** | XSS | **PASS** | Command evidence:<br>`git grep -n -E "dangerouslySetInnerHTML\|innerHTML\|eval\(\|new Function" apps/web/src` -> 0 matches in application source code. All question texts and LLM pedagogical feedback are rendered via standard JSX text nodes, auto-escaped by React. | Clean frontend source |
| **S24** | LLM | **PASS** | `npm test -- apps/api/src/modules/llm/__tests__/endpoints.test.js apps/api/src/modules/llm/__tests__/guard.test.js`<br>Passed: Model outputs validated by Zod (`NarrativeSchema`, `AnalysisOutputSchema`). Prompts contain zero resident emails/names/IDs. `LLM_MODE=cache-only` makes zero outbound requests. Daily budget guard (16 requests/day) strictly enforced. | Covered by `endpoints.test.js` & `guard.test.js` |
| **S25** | Frontend storage | **PASS** | Command evidence:<br>`git grep -n "localStorage" apps/web/src` -> only stores `rt_lang` ('fa'/'en').<br>`git grep -n "sessionStorage" apps/web/src` -> 0 matches.<br>`queryClient.clear()` is called on logout (`apps/web/src/features/auth/hooks.js:80`). | No tokens or user data in browser storage |
| **S26** | Demo data | **PASS** | Code inspection & unit test in `apps/api/scripts/__tests__/demo-seed.test.js`<br>Passed: `demo-seed.js` strictly refuses execution when `NODE_ENV=production` (`PRODUCTION_REFUSED`). Passwords and accounts are explicitly documented as synthetic in `README.md`. | Verified by `demo-seed.test.js` |
