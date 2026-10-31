# ADR 0007 — API Architecture, Authentication, CSRF Stance, and Dev Proxy Topology

Status: accepted (2026-10-31, Operator A)

## Context
The Radiology Adaptive Training Platform backend (`apps/api`) provides REST endpoints for residents and instructors. We needed architectural decisions on framework selection, authentication session mechanics, CSRF mitigation, and local development networking topology.

## Decisions

### 1. Framework and Language
- **Express 5 in ES Modules (Node 24 LTS):** Leverages native promise rejection propagation in route handlers without external packages like `express-async-errors`.
- **Runtime Validation:** All inputs (HTTP bodies, query strings, path params, environment variables) are strictly validated with Zod 4 schemas shared from `@radiology/contracts`. In Express 5, `req.query` is a read-only getter; validated data is stored on `req.valid = { body, query, params }`.

### 2. Cookie-Based Authentication
- **Mechanism:** JWT (HS256 signed with `JWT_SECRET`) stored inside an `httpOnly`, `SameSite=Lax` cookie named `rt_session`.
- **Lifetime:** 12-hour expiration window (`JWT_TTL_HOURS=12`). No refresh token machinery is required for a demo/educational workstation application.
- **Role Differentiation:** Two mutually exclusive roles: `resident` (default on registration) and `instructor` (only created or promoted via the CLI script `create-instructor.js`).
- **Timing Attack Mitigation:** Authentication verifies passwords against a precomputed dummy bcrypt hash when an email is not found, guaranteeing consistent response times and identical `INVALID_CREDENTIALS` error payloads.

### 3. CSRF Protection Stance
- **Enforcement:** State-changing HTTP methods (`POST`, `PUT`, `PATCH`) require `Content-Type: application/json` via the `jsonOnly` middleware.
- **Rationale:** Standard browser cross-origin form submissions (`<form method="POST">`) can only submit `application/x-www-form-urlencoded`, `multipart/form-data`, or `text/plain`. Combined with `SameSite=Lax` cookies, requiring JSON content types prevents cross-site request forgery without needing anti-CSRF token synchronization.

### 4. Development Proxy Topology
- **Vite Dev Server Proxy:** The React frontend (`apps/web` on port 5173) proxies requests matching `/api` directly to Express (`apps/api` on port 4000).
- **Same-Origin Delivery:** From the browser's perspective, both the UI and the API reside on the same origin (`http://127.0.0.1:5173`). This allows `SameSite=Lax` cookies to be sent and received seamlessly in local development without requiring `SameSite=None` or HTTPS certificates.

### 5. Local MongoDB Without Docker
- The API connects to a locally installed MongoDB Community Server 8 instance (`127.0.0.1:27017`). Automated integration tests create and drop a distinct, isolated database per test file (`radiology_test_<uuid>`).

## Consequences
- No client-side tokens are stored in `localStorage` or `sessionStorage`, mitigating XSS token exfiltration risks.
- Browser cross-site form submissions cannot execute state changes on the API.
- Integration tests run directly against real local MongoDB instances matching production behavior.
