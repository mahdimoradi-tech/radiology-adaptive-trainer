---
name: api-conventions
description: Conventions for the Express 5 + MongoDB (Mongoose) + Zod REST API in apps/api written in plain JavaScript (ES modules) on Windows - folder layout, config, validation, error format, JWT cookie auth with resident and instructor roles, models, endpoint list including question-bank review and targeted practice, local MongoDB, testing with Vitest and supertest, and Postman upkeep. Use this skill whenever you create or edit anything in apps/api, an endpoint, a Mongoose model, middleware, auth, seed or batch scripts, or when anyone mentions backend, API, MongoDB, route, controller, or Postman.
---

# API conventions (apps/api, JavaScript ESM)

## Layout (module per feature)
```
src/
  app.js            // builds Express app (no listen) -> testable with supertest
  server.js         // loads config, connects Mongo, listens on PORT (4000)
  config/
    env.js          // Zod-validated env with pure loadEnv(source)
    paths.js        // REPO_ROOT and resolveRepoPath helpers
  middleware/       // errorHandler, validate(schemas), requireAuth, requireRole, jsonOnly
  modules/
    health/         // health routes and ping
    auth/           // routes, controller, service, model, mapper
    catalog/        // routes, controller, service, model, seed, publicId
    images/         // authenticated image file serving
    sessions/       // routes, controller, service, model, engine.adapter, metrics, mapper, admin.routes
  lib/              // logger (pino/pino-http), httpErrors, db (connectDb/disconnectDb)
scripts/            // seed-catalog.js, create-instructor.js
test/
  helpers/          // testDb.js (isolated database per test file, dropped on teardown)
```
Routes only wire; controllers parse (Zod from `packages/contracts`) and call services; services hold business logic and call `packages/engine` or models. Dev: `node --watch --env-file-if-exists=../../.env src/server.js`. ES modules (`"type": "module"`), no TypeScript, JSDoc on exports.

## Express 5 facts
- Rejected promises in async handlers reach the error middleware automatically without extra packages.
- `req.query` is a read-only getter: never assign to `req.query`. All validated inputs are stored in `req.valid = { body, query, params }`.
- Wildcards require names (e.g. `/*splat`).

## Responses and errors
- Success: `{ data }` (+ `meta` for pagination).
- Error: `{ error: { code, message, details? } }` with stable machine codes defined in `packages/contracts` (`VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `RATE_LIMITED`, `UNSUPPORTED_MEDIA_TYPE`, `INTERNAL_ERROR`).
- HTTP codes: 400 validation/malformed JSON, 401 unauthenticated / invalid credentials, 403 forbidden role, 404 not found, 409 conflict, 413 payload too large (> 100kb), 415 non-JSON state-changing body, 429 rate-limited, 500 internal server error.
- Internal errors are logged with request IDs via `pino-http`; stacks and sensitive details are never leaked to clients.

## Auth, roles and security
- Email + password; `bcryptjs` (cost 12 in production, 4 in tests); passwords strictly 8..72 bytes (bcrypt truncation boundary; Persian UTF-8 characters are 2 bytes each).
- JWT (HS256) in `httpOnly`, `SameSite=Lax` cookie `rt_session` with 12 h lifetime (`JWT_TTL_HOURS=12`).
- Timing attack mitigation: `loginUser` compares against a precomputed dummy hash when an email is not found, returning the identical `INVALID_CREDENTIALS` error.
- Roles: `resident` (default on register) and `instructor` (only created or promoted via `scripts/create-instructor.js`).
- CSRF protection: state-changing routes require `Content-Type: application/json` via `jsonOnly` middleware (415 if missing) + `SameSite=Lax` cookies.
- Dev topology: `apps/web` (Vite) proxies `/api` to Express (`http://127.0.0.1:4000`), ensuring same-origin cookie handling in development.

## Image IDs and label leakage
- Internal IDs (`cohen_...`, `kermany_...`) contain dataset names, which are confounded with disease classes.
- Public images use opaque 20-character hexadecimal IDs: `publicId = HMAC-SHA256(PUBLIC_ID_SALT, id).slice(0, 20)`.
- Image serving URL is `/api/images/:publicId/file` with `Cache-Control: private, max-age=86400` and no filename in headers.
- Path traversal protection: stored filenames match `^[A-Za-z0-9_.-]+\.jpe?g$` and are served with `dotfiles: 'deny'`.

## Local MongoDB (Windows, no Docker)
- Dev: `MONGODB_URI=mongodb://127.0.0.1:27017/radiology`.
- Tests: `MONGODB_URI_TEST=mongodb://127.0.0.1:27017`. Each test file gets a unique database `radiology_test_<uuid>` via `setupTestDb()`, dropped in `afterAll`.
- If MongoDB is unreachable, tests fail with: "Start the MongoDB service".

## Endpoints (`/api`)
- Health: `GET /api/health` (status, db ping, version).
- Auth: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/me`.
- Images: `GET /api/images/:publicId/file` (cookie auth required; resident limited to own session or practice set images, instructor global).
- Sessions: `POST /api/sessions`, `GET /api/sessions`, `GET /api/sessions/:id`, `PUT /api/sessions/:id/questions/:no/answer`, `POST /api/sessions/:id/finish`, `GET /api/sessions/:id/report`.
- Practice: `POST /api/practice`, `GET /api/practice`, `GET /api/practice/:id`, `PUT /api/practice/:id/questions/:no/answer`.
- Progress: `GET /api/progress`.
- Instructor admin: `GET /api/catalog/stats`, `GET /api/catalog/images`, `GET /api/admin/users`, `GET /api/admin/users/:userId/progress`, `GET /api/admin/sessions/:id/report`, `GET /api/admin/questions`, `GET /api/admin/questions/stats`, `GET /api/admin/questions/:id`, `POST /api/admin/questions/:id/approve`, `POST /api/admin/questions/:id/reject`, `PUT /api/admin/questions/:id`.

## Testing and Postman
- Vitest 4 workspaces project (`vitest run`).
- Integration tests against real local MongoDB with supertest.
- Strict leak tests ensure no response reveals `passwordHash`, internal IDs, or ground-truth labels to residents.
- Postman collection maintained in `docs/postman/radiology-api.postman_collection.json`.
