# T03 — Contracts and API foundation (config, auth, roles, catalog, images)

Developer: Mahdi · Branch: `feat/T03-api-foundation` · Skills: `api-conventions`, `git-workflow`, `review-workflow` · Estimate: 6 h · Folders: `packages/contracts`, `apps/api`, `docs/`, plus the root files named below.

If this task and a skill disagree, THIS TASK WINS. Write every deviation into ADR 0007 and, at the end, sync the skill (last step).

## Goal
A secure, tested Express 5 API on the local MongoDB: health check, cookie-based auth with two roles (`resident`, `instructor`), the image catalog imported from `ml/artifacts/catalog.json`, and authenticated image serving with OPAQUE public ids. No tests-taking yet (that is T05).

## Read this first: why some rules are strict
1. **Label leakage.** Catalog ids look like `cohen_ab12...` or `kermany_...`. The prefix reveals the data source, and the source reveals the class (cohen and figure1 contain ONLY COVID-19). A resident must never see an internal id. Residents see only an opaque `publicId`. No resident-facing response may ever contain `trueClass`, `bucket`, `difficulty`, `confusedWith` or `source` for a question that is not finished. This is tested.
2. **Express 5 facts** (check the official migration guide via Context7): rejected promises in async handlers reach the error middleware automatically (do NOT add `express-async-errors`); `req.query` is a read-only getter, so a validation middleware must NOT assign to `req.query` — store validated data in `req.valid = { body, query, params }`; wildcard routes need names (`/*splat`).
3. **Zod 4 idioms** (check zod.dev via Context7): use `z.email()` not `z.string().email()`; `z.toJSONSchema` exists; an object schema with refinements cannot be `.extend()`ed — extend first, refine last.
4. **Windows:** commands in PowerShell, `127.0.0.1` for MongoDB, no bash-only npm scripts.

## Prerequisites
- T01 and T02 merged; `/sync` done; board row for T03 set to in-progress.
- MongoDB service running: `mongosh "mongodb://127.0.0.1:27017" --quiet --eval "db.runCommand({ping:1}).ok"` prints `1`.
- `.env` exists at the repo root (copy of `.env.example`). The agent never prints its values.

## Human steps (agent: ask, then wait)
1. Generate a JWT secret and put it in `.env` as `JWT_SECRET=`: `node -p "require('node:crypto').randomBytes(48).toString('hex')"`. Same for `PUBLIC_ID_SALT=` (another random value).
2. Tell the agent how many JPEG files are in `data/catalog/images/`: `(Get-ChildItem data\catalog\images).Count`.
3. Choose the instructor account (email + display name) for yourself. Never type the password into chat; the script asks for it in the terminal.

## Binding decisions
| Topic | Decision | Reason |
|---|---|---|
| Language | JavaScript ES modules, JSDoc, Zod for runtime types | project rule |
| Env loading | `node --env-file-if-exists=../../.env` (no dotenv); `loadEnv(source)` is a pure function validated by Zod | fewer dependencies, testable |
| Auth | email + password, bcryptjs, JWT (HS256) in `httpOnly` cookie `rt_session`, SameSite=Lax, 12 h lifetime, no refresh token | simple, safe enough for a local/demo app |
| CSRF | state-changing routes require `Content-Type: application/json` (else 415) + SameSite=Lax | no token machinery needed |
| Dev topology | the web app (T04) proxies `/api` through the Vite dev server, so everything is same-origin; CORS is configurable but off by default | cookies work without `SameSite=None` |
| Roles | `resident` (default on register), `instructor` (only via script) | ADR 0006 |
| Image ids | `publicId = HMAC-SHA256(PUBLIC_ID_SALT, id)` first 20 hex chars; stored in the DB; URL `/api/images/<publicId>/file` | no label leakage |
| Tests | Vitest 4 projects + supertest against a REAL local MongoDB, one unique database per test file, dropped afterwards | no extra packages; CI has a MongoDB service |
| Passwords | length 8..72 BYTES (bcrypt truncates at 72 bytes; Persian characters are 2 bytes), must differ from the email | correctness |

## Contracts to add (`packages/contracts/src/`), contract change justified in the PR
- `common.js`: `API_ERROR_CODES` = `VALIDATION_ERROR, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, EMAIL_TAKEN, INVALID_CREDENTIALS, RATE_LIMITED, UNSUPPORTED_MEDIA_TYPE, INTERNAL_ERROR` (later tasks append); `ApiErrorSchema` = `{ error: { code, message, details? } }`; `PaginationQuerySchema` (`page` default 1, `pageSize` default 20, max 100; coerce numbers); `ObjectIdSchema` (24 hex chars).
- `auth.js`: `RoleSchema = z.enum(['resident','instructor'])`; `LanguageSchema = z.enum(['fa','en'])`; `RegisterBodySchema { email, password, displayName (2..60, trimmed), language default 'fa' }`; `LoginBodySchema { email, password }`; `UserPublicSchema { id, email, displayName, role, language, createdAt }`. Email: trimmed, lowercased, max 254.
- `catalog.js`: `CatalogEntrySchema` = `ImageMetaSchema.extend({ imageId: z.string().optional(), filename: /^[A-Za-z0-9_.-]+\.jpe?g$/, source: z.string().min(1) })` then refine "if `imageId` exists it equals `id`". `CatalogFileSchema = z.array(CatalogEntrySchema).min(1)` with a refine for duplicate ids. `ImagePublicSchema { id: publicId, url }`. `CatalogImageAdminSchema` = entry without `imageId` plus `publicId` and `url`. `CatalogStatsSchema { total, byClass, byBucket, byClassBucket, bySource }`.
- Export everything from `index.js`; keep `ENGINE`-related exports untouched. Tests for each schema: valid, invalid, edge (73-byte password, uppercase email, duplicate catalog ids).

## Environment variables (validate with Zod in `src/config/env.js`; add all to `.env.example`)
`NODE_ENV`, `PORT` (4000), `MONGODB_URI` (`mongodb://127.0.0.1:27017/radiology`), `MONGODB_URI_TEST` (`mongodb://127.0.0.1:27017`), `JWT_SECRET` (min 32 chars; reject `change-me` when `NODE_ENV=production`), `JWT_TTL_HOURS` (12), `PUBLIC_ID_SALT` (min 16 chars), `BCRYPT_COST` (12; tests use 4), `COOKIE_SECURE` (false), `CORS_ORIGIN` (empty = no CORS), `RATE_LIMIT_ENABLED` (true), `CATALOG_FILE` (`ml/artifacts/catalog.json`), `CATALOG_IMAGE_DIR` (`data/catalog/images`). Paths are resolved from the repo root: `src/config/paths.js` exports `REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url))`. LLM variables already in `.env.example` stay untouched.

## API surface (prefix `/api`; success `{ data }`, error `{ error: { code, message, details? } }`)
| Method + path | Auth | Notes |
|---|---|---|
| `GET /health` | none | `{ data: { status:'ok', db:'up'|'down', version } }`; db via a Mongo ping |
| `POST /auth/register` | none, rate-limited | 201; creates a `resident`; sets the cookie; 409 `EMAIL_TAKEN` |
| `POST /auth/login` | none, rate-limited | 200; 401 `INVALID_CREDENTIALS` with the SAME message for unknown email and wrong password; compare against a dummy hash when the user does not exist |
| `POST /auth/logout` | none | 204; clears the cookie; idempotent |
| `GET /me` | cookie | 200 `{ user }`; 401 `UNAUTHENTICATED` |
| `GET /images/:publicId/file` | cookie | image bytes; `Cache-Control: private, max-age=86400`; no filename in any header; 404 `NOT_FOUND`; T05 adds the per-session ownership check through one function `canViewImage(user, image)` (default now: any authenticated user) |
| `GET /catalog/stats` | instructor | counts by class, bucket, class x bucket, source |
| `GET /catalog/images` | instructor | paginated; filters `trueClass`, `bucket`, `source`; full metadata + `publicId` + `url` |
Security: `helmet`, `express-rate-limit` on auth routes (e.g. 20 requests / 15 min / IP; disabled when `RATE_LIMIT_ENABLED=false`), JSON body limit 100 kb, `pino-http` with request ids and redaction of `req.headers.cookie`, `req.headers.authorization`. Responses never contain `passwordHash`. File route: validate the stored filename against `^[A-Za-z0-9_.-]+\.jpe?g$` and serve with `res.sendFile(filename, { root: imageDir, dotfiles: 'deny' })` (path-traversal safe).

## Folder layout (`apps/api`)
`src/app.js` (`createApp({ config })`, no listen) · `src/server.js` · `src/config/{env,paths}.js` · `src/middleware/{validate,requireAuth,requireRole,errorHandler,notFound,jsonOnly}.js` · `src/lib/{logger,httpErrors,db}.js` · `src/modules/health` · `src/modules/auth/{routes,controller,service,model,mapper}.js` · `src/modules/catalog/{routes,controller,service,model,seed,publicId}.js` · `src/modules/images/routes.js` · `scripts/{seed-catalog,create-instructor}.js` · `test/helpers/{testDb,fixtures}.js`. Scripts in `package.json`: `dev` (`node --watch --env-file-if-exists=../../.env src/server.js`), `start`, `seed:catalog`, `create-instructor`, `test`, `lint`, `build` (no-op message).

## Models (Mongoose 9)
- `User`: `email` (unique, lowercase), `passwordHash`, `displayName`, `role`, `language`, timestamps. Mapper `toPublicUser(doc)` picks fields explicitly (never spread a document).
- `Image` (collection `images`): `_id: String` = catalog id, `publicId` (unique), `filename`, `trueClass`, `source`, `difficulty`, `bucket`, `confusedWith`, timestamps; index `{ trueClass:1, bucket:1 }`. Use `.lean()` for reads and a mapper to the contract shapes.

## Seed script `npm run seed:catalog -w @radiology/api -- [--file] [--images] [--prune] [--require-files]`
Use `node:util` `parseArgs` (no dependency). Steps: read the JSON; validate with `CatalogFileSchema` (on failure print the first 10 issues and exit 1); compute `publicId`; check that each image file exists (count missing; with `--require-files` exit 1); upsert with `bulkWrite` in batches of 500 (idempotent: running twice changes nothing); `--prune` deletes images missing from the file. Print a summary: totals, class x bucket and class x source tables, and a **pool health** warning for every class x bucket cell with fewer than 6 images ("tests need at least 2 per test and images do not repeat"). The COVID-19 class is expected to be small — report real numbers, do not hide them.

## Instructor script `npm run create-instructor -w @radiology/api`
Asks (readline) for email, display name and password (password never as a CLI argument), validates with the contracts, creates or promotes the user to `instructor`, prints only the email and role.

## Tests (Vitest + supertest; no mocks of Mongo)
`test/helpers/testDb.js`: connect to `MONGODB_URI_TEST` (default `mongodb://127.0.0.1:27017`) with a unique database name per test file, drop it in `afterAll`; if MongoDB is unreachable fail with the clear message "Start the MongoDB service". Cover: env loader (valid/invalid/production rules); health up/down; register (201, cookie flags, duplicate 409, validation errors, 72-byte password rule); login (success, wrong password and unknown email give identical bodies); logout; `/me` with and without cookie; 415 for non-JSON POST bodies; instructor-only routes (resident 403, anonymous 401, instructor 200); seed function with a 6-entry fixture (idempotent, prune, invalid file rejected); **leak tests**: no response to a resident contains `passwordHash`, and the stats/list responses for the instructor contain `publicId` while the resident-visible image URL contains no `cohen_`/`kermany_`/`figure1_`; image file route returns bytes for a fixture file and 404 for an unknown or traversal-like id.

## Steps (commit after each, push after every 1-3)
1. `feat(contracts): add api error, auth and catalog schemas` (+ tests).
2. `build(repo): run all workspace tests through vitest projects` — root `vitest.config.js` with `test.projects: ['packages/*', 'apps/*']` (verify the Vitest 4 syntax via Context7), per-project config for `apps/api` (`environment: 'node'`). Record the number of tests BEFORE and AFTER; it must not decrease. Keep root scripts working: `npm test`, `npm run lint`, `npm run build`.
3. `chore(api): scaffold express app with validated env config` — dependencies via the protocol: `express`, `mongoose`, `zod`, `helmet`, `express-rate-limit`, `cookie-parser`, `pino`, `pino-http`, `bcryptjs`, `jsonwebtoken`, workspace packages `@radiology/contracts` and `@radiology/engine`; dev: `supertest`. Env, paths, app factory, server, validate/error/notFound/jsonOnly middleware, health route, tests.
4. `feat(api): add mongoose connection and test database helper`.
5. `feat(api): add user model and auth endpoints` (+ tests).
6. `feat(api): add role guard and instructor bootstrap script` (+ tests).
7. `feat(api): add catalog model, public ids and seed script` (+ tests).
8. `feat(api): add catalog stats, catalog list and image file endpoints` (+ tests, leak tests).
9. `docs(api): add postman collection, api readme and ADRs` — `docs/postman/radiology-api.postman_collection.json` (one request per endpoint with example bodies), `apps/api/README.md` (setup, env table, scripts, PowerShell examples, how a teammate installs images: `Expand-Archive`), ADR 0007 (API architecture, auth, CSRF stance, dev proxy topology), ADR 0008 (opaque public ids and label leakage; note that image CONTENT can still reveal the source — see ADR 0006).
10. `docs(repo): sync api-conventions skill and board` — update `.agents/skills/api-conventions/SKILL.md` to what was really built (keep it under 12,000 characters), `.env.example`, board row, developer log.

## Verification (show real outputs; PowerShell)
- `npm run lint`, `npm test`, `npm run build` all pass; test count not lower than before.
- Seed the real catalog: `npm run seed:catalog -w @radiology/api` and paste the summary tables into the PR. Run it twice: the second run reports 0 changes.
- Start the API (`npm run dev -w @radiology/api`) and run:
  `Invoke-RestMethod http://127.0.0.1:4000/api/health`
  `Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4000/api/auth/register -ContentType 'application/json' -Body '{"email":"t1@example.com","password":"password123","displayName":"Test One"}' -SessionVariable s`
  `Invoke-RestMethod -Uri http://127.0.0.1:4000/api/me -WebSession $s`
  and one forbidden call: `Invoke-RestMethod -Uri http://127.0.0.1:4000/api/catalog/stats -WebSession $s` must return 403.
- Create the instructor with the script, log in as instructor and fetch `/api/catalog/stats`.
- Postman: import the collection and run register, login, me.

## Acceptance criteria
- [ ] All endpoints above work and are tested; no response leaks `passwordHash`, internal ids or labels to residents.
- [ ] Seed is idempotent, validates the file, prints pool-health warnings, and the real catalog is imported (counts reported to the developer).
- [ ] CI is green (MongoDB service container) and `npm test` runs every workspace through Vitest projects.
- [ ] ADR 0007 and 0008 written; contracts change described in the PR; skill synced; no secret or image committed.
- [ ] AI review done in a fresh chat (see `docs/WORKFLOW.md`) and its blockers fixed.

## After merge
Send the PR's catalog summary tables to Claude (they decide how T05/T06/T08 handle small pools, especially COVID-19). Then `/sync` and `/start-task T04`.

## Out of scope
Sessions, answers, metrics, LLM, refresh tokens, email verification, password reset, Docker, deployment.
