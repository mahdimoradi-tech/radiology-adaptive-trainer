---
name: api-conventions
description: Conventions for the Express 5 + MongoDB (Mongoose) + Zod REST API in apps/api written in plain JavaScript (ES modules) on Windows - folder layout, config, validation, error format, JWT cookie auth with resident and instructor roles, models, endpoint list including question-bank review and targeted practice, local MongoDB, testing with Vitest and supertest, and Postman upkeep. Use this skill whenever you create or edit anything in apps/api, an endpoint, a Mongoose model, middleware, auth, seed or batch scripts, or when anyone mentions backend, API, MongoDB, route, controller, or Postman.
---

# API conventions (apps/api, JavaScript ESM)

## Layout (module per feature)
```
src/
  app.js            // builds the Express app (no listen) -> testable with supertest
  server.js         // loads config, connects Mongo, listens
  config/env.js     // Zod-validated env (fail fast)
  middleware/       // errorHandler, validate(schema), requireAuth, requireRole, rateLimit
  modules/<name>/   // <name>.routes.js, .controller.js, .service.js, .model.js, __tests__/
  lib/              // logger (pino), httpErrors
scripts/            // seed-images.js, create-instructor.js, analyze-images.js, generate-questions.js, export/import bank
seed/               // question-bank.approved.json
```
Routes only wire; controllers parse (Zod from `packages/contracts`) and call services; services hold logic and call `packages/engine`; models define schemas/indexes. Dev: `node --watch --env-file=.env src/server.js`. ES modules (`"type": "module"`), no TypeScript, JSDoc on exports.

## Express 5 facts
Rejected promises in async handlers reach the error middleware automatically. Wildcards need names (`/*splat`). Check the official migration guide for anything else before coding.

## Responses and errors
Success `{ data }` (+ `meta` for pagination). Error `{ error: { code, message, details? } }` with stable machine `code`s; the web app maps `code` to Persian via i18n. HTTP: 400 validation, 401, 403, 404, 409, 429, 500 (log with request id; never leak stacks).

## Auth and security
Email + password; `bcryptjs` (cost 12). JWT (1h) in an `httpOnly`, `sameSite=lax` cookie (`secure` in production); no tokens in localStorage. Roles: `resident`, `instructor`. Instructors are created by script (`npm run create-instructor`), never by public registration. `helmet`, CORS allow-list from env, `express-rate-limit` on auth and LLM routes, body limit 100kb, Zod on every input, never build Mongo queries from raw user objects. `.env.example` lists every variable with dummy values.

## Local MongoDB (Windows, no Docker)
`MONGODB_URI=mongodb://127.0.0.1:27017/radiology`; tests use `MONGODB_URI_TEST=mongodb://127.0.0.1:27017/radiology_test` and drop it before each suite. CI uses a GitHub Actions MongoDB service container. Never point tests at the dev database.

## Collections
`users` (email unique, passwordHash, displayName, role, language) · `images` (imageId unique, filename, trueClass, source, difficulty, bucket, probs, confusedWith; index `{trueClass,bucket}`) · `sessions` (userId, index, kind `baseline|adaptive|targeted`, itemIds, plan, config snapshot, startedAt, finishedAt, metrics) · `responses` (sessionId, userId, itemType `image|question`, itemId, imageId, trueClass, answer, correct, bucket, answeredAt, timeMs; unique `{sessionId,itemId}`) · `image_analyses`, `question_bank` (see `question-generation`) · `llm_cache`, `llm_eval_samples` (see `llm-feedback`).

## Endpoints (`/api`)
Auth: `POST /auth/register`, `/auth/login`, `/auth/logout`, `GET /me`. Resident: `POST /sessions` (kind baseline|adaptive|targeted, engine builds it) · `GET /sessions` · `GET /sessions/:id` · `PUT /sessions/:id/answers/:itemId` (idempotent) · `POST /sessions/:id/finish` · `GET /sessions/:id/report` · `POST /sessions/:id/explanations` · `POST /sessions/:id/report-narrative` · `GET /progress` · `GET /images/:imageId/file` (auth required). Instructor: `GET /instructor/residents`, `GET /instructor/residents/:id/progress`, `GET /instructor/stats`, `GET /instructor/questions?status=&type=&pair=`, `PATCH /instructor/questions/:id` (approve|reject|edit, note), `GET /instructor/questions/stats`. `GET /health`.
Rules: answers only for items that belong to the session; the true label/correct option is never sent before the answer is saved (reveal in the review/report); instructor routes require role `instructor`.

## Testing
Vitest 4 + supertest. Each endpoint: happy path, validation error, auth/role error. Engine is real (pure), LLM is fake. Keep `docs/postman/radiology-api.postman_collection.json` updated (one request per endpoint, login pre-request).
