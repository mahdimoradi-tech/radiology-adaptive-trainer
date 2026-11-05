# Radiology Adaptive Trainer — Express API (`apps/api`)

Secure REST API backend built with Express 5, MongoDB (Mongoose 9), and Zod 4 runtime contracts.

## Architecture Highlights

- **Framework:** Express 5.3 (native async error forwarding) in ECMAScript Modules (`"type": "module"`).
- **Authentication:** Cookie-based session (`rt_session`) using HS256 JWT, `httpOnly`, `SameSite=Lax`.
- **Authorization:** Role-based access control with two roles: `resident` and `instructor`.
- **Catalog & Privacy:** Images are addressed via HMAC-SHA256 opaque `publicId`s to prevent data-source and label leakage.
- **CSRF Defense:** State-changing routes require `Content-Type: application/json` combined with `SameSite=Lax` cookies.

---

## Environment Variables

Configured in `.env` at the repository root:

| Variable                           | Type      | Default                               | Description                                         |
| ---------------------------------- | --------- | ------------------------------------- | --------------------------------------------------- |
| `NODE_ENV`                         | `string`  | `development`                         | `development`, `production`, or `test`              |
| `PORT`                             | `number`  | `4000`                                | HTTP listening port for Express                     |
| `MONGODB_URI`                      | `string`  | `mongodb://127.0.0.1:27017/radiology` | Local MongoDB connection URI                        |
| `MONGODB_URI_TEST`                 | `string`  | `mongodb://127.0.0.1:27017`           | Base URI for isolated test databases                |
| `JWT_SECRET`                       | `string`  | —                                     | Secret key for JWT signing (>= 32 chars)            |
| `JWT_TTL_HOURS`                    | `number`  | `12`                                  | Session lifetime in hours                           |
| `PUBLIC_ID_SALT`                   | `string`  | —                                     | Salt for HMAC-SHA256 public image IDs (>= 16 chars) |
| `BCRYPT_COST`                      | `number`  | `12`                                  | Bcrypt salt rounds (defaults to 4 in tests)         |
| `COOKIE_SECURE`                    | `boolean` | `false`                               | Whether cookies require HTTPS                       |
| `CORS_ORIGIN`                      | `string`  | `http://127.0.0.1:5173`               | Allowed CORS origin (empty = no CORS)               |
| `RATE_LIMIT_ENABLED`               | `boolean` | `true`                                | Rate limiting for authentication endpoints          |
| `ALLOW_REPEATS`                    | `boolean` | `false`                               | Allow question repeats across tests when exhausted  |
| `CATALOG_FILE`                     | `string`  | `ml/artifacts/catalog.json`           | Path to verified catalog JSON                       |
| `CATALOG_IMAGE_DIR`                | `string`  | `data/catalog/images`                 | Path to catalog JPEG images                         |
| `LLM_MODE`                         | `string`  | `cache-only`                          | Execution mode: `live`, `cache-only`, `fake`        |
| `LLM_ENABLED`                      | `boolean` | `true`                                | Master switch for LLM feedback features             |
| `GEMINI_API_KEY`                   | `string`  | —                                     | Google AI Studio API key for Gemini 3.8 Flash       |
| `GEMINI_MODEL`                     | `string`  | `gemini-3.8-flash`                    | Gemini model identifier                             |
| `LLM_DAILY_REQUEST_BUDGET`         | `number`  | `16`                                  | Max daily live requests (Pacific day boundary)      |
| `LLM_MIN_INTERVAL_MS`              | `number`  | `13000`                               | Inter-call throttle spacing in milliseconds         |
| `LLM_TIMEOUT_MS`                   | `number`  | `60000`                               | Request timeout in milliseconds                     |
| `LLM_RATE_LIMIT_PER_USER_PER_HOUR` | `number`  | `30`                                  | Per-user hourly rate limit for narrative generation |

---

## Setup & Image Installation (PowerShell)

### 1. Install Dependencies

From the repository root:

```powershell
npm install
```

### 2. Prepare Environment File

```powershell
Copy-Item .env.example .env
```

Generate secure keys:

```powershell
node -p "require('node:crypto').randomBytes(48).toString('hex')"
```

Paste one output as `JWT_SECRET` and another as `PUBLIC_ID_SALT` in `.env`.

### 3. Teammate Image Unpacking

If you received `catalog-images.zip` from a teammate or shared drive, extract it directly to `data/catalog/images`:

```powershell
Expand-Archive -Path path\to\catalog-images.zip -DestinationPath data\catalog\images -Force
```

Verify the image count:

```powershell
(Get-ChildItem data\catalog\images).Count
```

---

## Available Scripts

Run from repository root with `-w @radiology/api`:

### Start Development Server

```powershell
npm run dev -w @radiology/api
```

Listens at `http://127.0.0.1:4000`.

### Seed the Image Catalog

```powershell
# Standard seed
npm run seed:catalog -w @radiology/api

# Seed with pruning and verification of image files on disk
npm run seed:catalog -w @radiology/api -- --prune --require-files
```

### Create / Promote Instructor Account

```powershell
npm run create-instructor -w @radiology/api
```

Interactively prompts for email, display name, and password.

### Run Tests & Lint

```powershell
npm test -w @radiology/api
npm run lint -w @radiology/api
```

### Multimodal Image Analysis Pipeline (T08a)

Batch-oriented, resumable closed-vocabulary analysis using Google Gemini (`gemini-3.8-flash`).

> **Privacy & Terms Notice:** Catalog images are submitted to Google's Gemini API. The operator must verify Google AI Studio free-tier terms regarding content usage. No trainee, user, or patient identifiable information is transmitted.

```powershell
# 1. Deterministically sample 120-image analysis set (seed/analysis-set.json)
npm run analysis:select -w @radiology/api

# 2. Plan 40 batches (groups of 6 images, run A and B) in MongoDB
npm run analysis:plan -w @radiology/api

# 3. Dry-run verification (offline fake provider, 0 budget used)
npm run analysis:run -w @radiology/api -- --dry-run

# 4. Live execution (runs within daily budget, resumable)
npm run analysis:run -w @radiology/api -- --max-batches 2 --runs A

# 5. Compute consensus & validation
npm run analysis:validate -w @radiology/api

# 6. View pipeline coverage & accuracy dashboard
npm run analysis:status -w @radiology/api

# 7. Export / import portable analyses
npm run analysis:export -w @radiology/api
npm run analysis:import -w @radiology/api
```

---

### Question Bank & Instructor Review (T08b)

```powershell
# Run question generator (dry-run or live)
npm run questions:generate -w @radiology/api -- --dry-run
npm run questions:generate -w @radiology/api -- --max-requests 12

# Check question bank status & rejection counts
npm run questions:status -w @radiology/api

# Export approved bank questions to portable JSON
npm run bank:export -w @radiology/api

# Import approved bank questions
npm run bank:import -w @radiology/api
```

---

## API Surface

Base path: `/api`

### Public & Auth

- `GET /api/health` — System health and MongoDB ping status
- `POST /api/auth/register` — Register a resident user (`{ email, password, displayName, language? }`)
- `POST /api/auth/login` — Login (`{ email, password }`)
- `POST /api/auth/logout` — Clear session cookie
- `GET /api/me` — Get current user profile (requires session cookie)

### Images

- `GET /api/images/:publicId/file` — Serve raw JPEG image bytes (authenticated; residents only for images in their own sessions, instructors global)

### Resident Training Sessions

- `POST /api/sessions` — Create a new test session (baseline or adaptive, body: `{ size: 45..120 }`)
- `GET /api/sessions` — List own sessions (newest first, paginated)
- `GET /api/sessions/:id` — Get full session with questions (`{ no, imageUrl, answered, answer }`)
- `PUT /api/sessions/:id/questions/:no/answer` — Submit answer for question `no` (`{ answer, timeMs? }`)
- `POST /api/sessions/:id/finish` — Finish session, trigger metrics calculation, and receive report
- `GET /api/sessions/:id/report` — View performance report for a finished session

### Resident Progress

- `GET /api/progress` — View learning trajectory across all finished sessions with top error confusion pairs

### Instructor Only

- `GET /api/catalog/stats` — Aggregated catalog distribution counts
- `GET /api/catalog/images` — Paginated catalog list with filters (`page`, `pageSize`, `trueClass`, `bucket`, `source`)
- `GET /api/admin/users` — Paginated resident summary list (`sessionsFinished`, `lastAccuracy`, `lastActiveAt`)
- `GET /api/admin/users/:userId/progress` — View progress trajectory for any resident
- `GET /api/admin/sessions/:id/report` — View report for any finished session
- `GET /api/admin/questions` — Paginated question bank list with filters (`status`, `type`, `trueClass`, `confusedWith`, `page`, `pageSize`)
- `GET /api/admin/questions/stats` — Review panel statistics counts
- `GET /api/admin/questions/:id` — Full question detail with image URL and AI consensus analysis
- `POST /api/admin/questions/:id/approve` — Approve question (`{ note? }`)
- `POST /api/admin/questions/:id/reject` — Reject question (`{ note? }`)
- `PUT /api/admin/questions/:id` — Edit question and reset status to `pending_review` (`{ stem, options, correctIndex, rationale, note? }`)

---

## PowerShell Verification Examples

```powershell
# 1. Health check
Invoke-RestMethod http://127.0.0.1:4000/api/health

# 2. Register a new resident
$body = @{
  email = "resident@hospital.org"
  password = "Password123"
  displayName = "Dr. Resident"
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4000/api/auth/register -ContentType 'application/json' -Body $body -SessionVariable s

# 3. Check /me
Invoke-RestMethod -Uri http://127.0.0.1:4000/api/me -WebSession $s

# 4. Verify 403 Forbidden for resident on instructor endpoint
try {
  Invoke-RestMethod -Uri http://127.0.0.1:4000/api/catalog/stats -WebSession $s
} catch {
  $_.Exception.Response.StatusCode # Returns 403
}
```
