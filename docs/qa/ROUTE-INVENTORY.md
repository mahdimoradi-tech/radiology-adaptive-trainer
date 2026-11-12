# API Route Inventory

This inventory documents all 31 registered Express 5 routes in `apps/api`, including their HTTP methods, route paths, middleware stacks, authentication requirements, and role-based access controls.

## Global Middlewares (Executed in order on all requests)

1. **`helmet()`**: Sets secure HTTP response headers (`X-Content-Type-Options`, `Strict-Transport-Security`, `X-Frame-Options`, `Content-Security-Policy`, etc.) and disables `X-Powered-By`.
2. **`createHttpLogger(logger)`**: Request logging via `pino-http` (attaches `req.id` UUID to each request).
3. **CORS handler** (if `CORS_ORIGIN` configured): Sets CORS headers (`Origin`, `Credentials: true`, `Methods`, `Headers`), handles preflight `OPTIONS` returning 204.
4. **`express.json({ limit: '100kb' })`**: Parses JSON payloads up to 100kb limit; rejects larger bodies with HTTP 413.
5. **`cookieParser()`**: Parses signed/unsigned cookies from `Cookie` header (`rt_session`).
6. **`jsonOnly`**: Enforces `Content-Type: application/json` on state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) with non-empty bodies; rejects other formats with HTTP 415.
7. **`notFound`**: Fallback 404 handler for unregistered routes.
8. **`errorHandler`**: Centralized error middleware normalizing known errors into `{ error: { code, message, details? } }` and obfuscating 500 internal errors in production.

---

## Route Table

| # | Method | Path | Middlewares | Allowed Roles | Description |
|---|---|---|---|---|---|
| 1 | `GET` | `/api/health` | (none) | `public` | System health, MongoDB ping status, and contracts version |
| 2 | `POST` | `/api/auth/register` | `authLimiter`, `validate(body: RegisterBodySchema)` | `public` | Register new resident account |
| 3 | `POST` | `/api/auth/login` | `authLimiter`, `validate(body: LoginBodySchema)` | `public` | Authenticate resident or instructor, sets `rt_session` cookie |
| 4 | `POST` | `/api/auth/logout` | (none) | `public` | Clear `rt_session` authentication cookie |
| 5 | `GET` | `/api/me` | `requireAuth` | `resident`, `instructor` | Retrieve authenticated user profile and role |
| 6 | `GET` | `/api/images/:publicId/file` | `requireAuth`, `canViewImage` | `resident`, `instructor` | Serve radiograph image file (resident restricted to own active sessions/practice) |
| 7 | `POST` | `/api/sessions` | `requireAuth`, `requireRole('resident')`, `validate(body: CreateSessionBodySchema)` | `resident` | Start new baseline or adaptive session |
| 8 | `GET` | `/api/sessions` | `requireAuth`, `requireRole('resident')`, `validate(query: PaginationQuerySchema)` | `resident` | List own training sessions |
| 9 | `GET` | `/api/sessions/:id` | `requireAuth`, `requireRole('resident')` | `resident` | Retrieve own session details (questions, progress) |
| 10 | `PUT` | `/api/sessions/:id/questions/:no/answer` | `requireAuth`, `requireRole('resident')`, `validate(body: AnswerBodySchema)` | `resident` | Submit answer for question in active session |
| 11 | `POST` | `/api/sessions/:id/finish` | `requireAuth`, `requireRole('resident')` | `resident` | Finalize session and compute metrics |
| 12 | `GET` | `/api/sessions/:id/report` | `requireAuth`, `requireRole('resident')` | `resident` | Get detailed report for finished session |
| 13 | `GET` | `/api/progress` | `requireAuth`, `requireRole('resident')` | `resident` | Get historical training progress trajectory |
| 14 | `POST` | `/api/sessions/:id/explanations` | `requireAuth`, `requireRole('resident')`, `validate(body: ExplanationsBodySchema)` | `resident` | Fetch pedagogical explanations for mistake confusion pairs |
| 15 | `POST` | `/api/sessions/:id/report-narrative` | `requireAuth`, `requireRole('resident')`, `narrativeLimiter`, `validate(body: NarrativeBodySchema)` | `resident` | Request LLM pedagogical narrative report for session |
| 16 | `POST` | `/api/practice` | `requireAuth`, `requireRole('resident')`, `validate(body: PracticeCreateRequestSchema)` | `resident` | Create targeted practice set for confusion pair |
| 17 | `GET` | `/api/practice` | `requireAuth`, `requireRole('resident')`, `validate(query: PaginationQuerySchema)` | `resident` | List own targeted practice sets |
| 18 | `GET` | `/api/practice/:id` | `requireAuth`, `requireRole('resident')` | `resident` | Get single targeted practice set details |
| 19 | `PUT` | `/api/practice/:id/questions/:no/answer` | `requireAuth`, `requireRole('resident')`, `validate(body: PracticeAnswerRequestSchema)` | `resident` | Submit answer for practice question |
| 20 | `GET` | `/api/catalog/stats` | `requireAuth`, `requireRole('instructor')` | `instructor` | Get image catalog statistics by class and bucket |
| 21 | `GET` | `/api/catalog/images` | `requireAuth`, `requireRole('instructor')`, `validate(query: CatalogImagesQuerySchema)` | `instructor` | List catalog images with filters and pagination |
| 22 | `GET` | `/api/admin/users` | `requireAuth`, `requireRole('instructor')`, `validate(query: PaginationQuerySchema)` | `instructor` | List residents with session counts and metrics |
| 23 | `GET` | `/api/admin/users/:userId/progress` | `requireAuth`, `requireRole('instructor')` | `instructor` | Get resident progress trajectory |
| 24 | `GET` | `/api/admin/sessions/:id/report` | `requireAuth`, `requireRole('instructor')` | `instructor` | Get report for any finished resident session |
| 25 | `GET` | `/api/admin/questions` | `requireAuth`, `requireRole('instructor')`, `validate(query: QuestionBankQuerySchema)` | `instructor` | List question bank with status/type filters |
| 26 | `GET` | `/api/admin/questions/stats` | `requireAuth`, `requireRole('instructor')` | `instructor` | Get question bank status statistics |
| 27 | `GET` | `/api/admin/questions/:id` | `requireAuth`, `requireRole('instructor')` | `instructor` | Get single question details with image metadata |
| 28 | `POST` | `/api/admin/questions/:id/approve` | `requireAuth`, `requireRole('instructor')`, `validate(body: ApproveQuestionBodySchema)` | `instructor` | Approve generated question |
| 29 | `POST` | `/api/admin/questions/:id/reject` | `requireAuth`, `requireRole('instructor')`, `validate(body: RejectQuestionBodySchema)` | `instructor` | Reject question with review reason |
| 30 | `PUT` | `/api/admin/questions/:id` | `requireAuth`, `requireRole('instructor')`, `validate(body: EditQuestionBodySchema)` | `instructor` | Edit question stem, options, explanation |
| 31 | `GET` | `/api/admin/llm/status` | `requireAuth`, `requireRole('instructor')` | `instructor` | Get LLM health, quota status, and cache statistics |

---

## Route Distribution by Role

- **Public (Unauthenticated):** 4 routes (`/api/health`, `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`)
- **Shared Authenticated (`resident` + `instructor`):** 2 routes (`/api/me`, `/api/images/:publicId/file`)
- **Resident-only:** 13 routes (Sessions: 7, LLM Feedback: 2, Targeted Practice: 4)
- **Instructor-only:** 12 routes (Catalog: 2, Admin Residents: 3, Question Bank: 6, Admin LLM: 1)
- **Total:** 31 endpoints.
