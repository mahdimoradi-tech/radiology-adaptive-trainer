## Task

- **Task ID:** T11 - Hardening, docs, demo script, release
- **Branch:** `chore/T11-hardening-release`
- **Review:** AI Review per `docs/WORKFLOW.md`

---

## 1. Security Review Matrix (Step 3)

| # | Security Check Item | Status | File & Line Reference | Notes & Mitigations |
|---|---|---|---|---|
| 1 | **Session Cookie Flags** | **PASS** | [`apps/api/src/modules/auth/service.js:18-22`](file:///d:/university/pamphlet/bachelor-project/radiology-adaptive-trainer/apps/api/src/modules/auth/service.js#L18-L22) | `httpOnly: true`, `sameSite: 'lax'`, `secure: Boolean(COOKIE_SECURE \|\| NODE_ENV === 'production')`, `maxAge: 12h`. Logout also clears with identical path and security flags. |
| 2 | **CORS Configuration** | **PASS** | [`apps/api/src/config/env.js:22-27`](file:///d:/university/pamphlet/bachelor-project/radiology-adaptive-trainer/apps/api/src/config/env.js#L22-L27), [`apps/api/src/app.js:32-43`](file:///d:/university/pamphlet/bachelor-project/radiology-adaptive-trainer/apps/api/src/app.js#L32-L43) | Limited strictly to configured `CORS_ORIGIN`. Zod schema strictly rejects wildcard `*` when credentials are used. |
| 3 | **Security Headers** | **PASS** | [`apps/api/src/app.js:26`](file:///d:/university/pamphlet/bachelor-project/radiology-adaptive-trainer/apps/api/src/app.js#L26) | Helmet middleware mounted as first middleware on Express application stack. |
| 4 | **Rate Limiting** | **PASS** | [`apps/api/src/modules/auth/routes.js:18-28`](file:///d:/university/pamphlet/bachelor-project/radiology-adaptive-trainer/apps/api/src/modules/auth/routes.js#L18-L28), [`apps/api/src/modules/llm/routes.js:22-34`](file:///d:/university/pamphlet/bachelor-project/radiology-adaptive-trainer/apps/api/src/modules/llm/routes.js#L22-L34) | Express-rate-limit active on `/api/auth/*` (20 attempts / 15m) and on LLM narrative reports (30 requests / hour / resident user). |
| 5 | **Body Size Limit & Zod Validation** | **PASS** | [`apps/api/src/app.js:46`](file:///d:/university/pamphlet/bachelor-project/radiology-adaptive-trainer/apps/api/src/app.js#L46), [`apps/api/src/middleware/validate.js`](file:///d:/university/pamphlet/bachelor-project/radiology-adaptive-trainer/apps/api/src/middleware/validate.js) | `express.json({ limit: '100kb' })` enforced globally. 100% of API endpoints validate bodies, queries, and params via shared contracts. |
| 6 | **Production Error Handling** | **PASS** | [`apps/api/src/middleware/errorHandler.js:10-45`](file:///d:/university/pamphlet/bachelor-project/radiology-adaptive-trainer/apps/api/src/middleware/errorHandler.js#L10-L45) | Unknown exceptions return generic `{ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }`. Stack traces and internal details are never returned to clients. |
| 7 | **Password Hashing & Strength** | **PASS** | [`apps/api/src/config/env.js:13`](file:///d:/university/pamphlet/bachelor-project/radiology-adaptive-trainer/apps/api/src/config/env.js#L13), [`apps/api/src/modules/auth/service.js:10,57`](file:///d:/university/pamphlet/bachelor-project/radiology-adaptive-trainer/apps/api/src/modules/auth/service.js#L10) | Bcrypt cost 12 in production; passwords strictly 8..72 bytes (UTF-8 safe); dummy hash verification on non-existent emails eliminates timing attacks. |
| 8 | **Image Endpoint Authorization** | **PASS** | [`apps/api/src/modules/images/routes.js:16-24`](file:///d:/university/pamphlet/bachelor-project/radiology-adaptive-trainer/apps/api/src/modules/images/routes.js#L16-L24), [`apps/api/src/modules/catalog/service.js`](file:///d:/university/pamphlet/bachelor-project/radiology-adaptive-trainer/apps/api/src/modules/catalog/service.js) | `canViewImage` restricts residents strictly to images in their own active/completed sessions or targeted practice sets; instructors have authorized global review access. Filename sanitized against path traversal (`dotfiles: 'deny'`). |
| 9 | **LLM Network Isolation (`cache-only`)** | **PASS** | [`apps/api/src/modules/llm/llm.service.js:46-48,201-209`](file:///d:/university/pamphlet/bachelor-project/radiology-adaptive-trainer/apps/api/src/modules/llm/llm.service.js#L46-L48) | `createProvider` returns `null` in `cache-only` mode. Verified by integration test (`endpoints.test.js`) ensuring throwing provider stubs are never invoked. |
| 10 | **Secrets & Environment Safety** | **PASS** | [`.gitignore:12`](file:///d:/university/pamphlet/bachelor-project/radiology-adaptive-trainer/.gitignore#L12), [`.env.example`](file:///d:/university/pamphlet/bachelor-project/radiology-adaptive-trainer/.env.example) | `git grep -n -I -E "AIza..."` returns 0 results. `.env` is ignored. `.env.example` documents all config variables with dummy values. |
| 11 | **Production Dependencies Audit** | **PASS** | Root `package.json` | `npm audit --omit=dev` reports **found 0 vulnerabilities**. |

---

## 2. Fresh-Clone Benchmark & Quickstart Validation (Step 6)

Tested in an isolated temporary directory outside the repository (`C:\Users\ASUS\AppData\Local\Temp\radiology-fresh-clone-test`) against a separate MongoDB database (`radiology_fresh_clone_test`):

- **Total Execution Time:** **24.9 seconds**
- **Discovered Deviations & Fixes:**
  1. `create-instructor.js` previously required interactive `readline` input without CLI argument support. Added non-interactive flag support (`--defaults` or `--email / --displayName / --password`), enabling seamless script automation.
  2. In `README.md`, updated demo resident email to `demo.resident@example.com` to match `demo-seed.js` verbatim.
- **Result:** Fresh clone runs end-to-end verbatim from README commands with zero errors.

---

## 3. Summary of Deliverables

1. **Access Matrix Test:** [`apps/api/src/__tests__/access-matrix.test.js`](file:///d:/university/pamphlet/bachelor-project/radiology-adaptive-trainer/apps/api/src/__tests__/access-matrix.test.js) validates all 31 registered Express routes against `ENDPOINT_ACCESS_MATRIX`, proving 401 unauthenticated, 403 role boundary, and 404 cross-resident isolation. (67 tests)
2. **Global Label Leakage Test:** [`apps/api/src/__tests__/global-leak.test.js`](file:///d:/university/pamphlet/bachelor-project/radiology-adaptive-trainer/apps/api/src/__tests__/global-leak.test.js) deep recursive response scan verifying zero diagnostic keys (`trueClass`, `bucket`, `difficulty`, `source`, `imageId`, `filename`, etc.) and zero dataset substrings (`cohen`, `kermany`, `figure1`) are exposed to residents before session finish or during practice. (8 tests)
3. **Console Output Encoding:** Replaced non-ASCII characters (`✔`, `✖`, `—`, `×`, emojis) with ASCII in `scripts/check-rtl-classes.js` and all API scripts, eliminating Windows PowerShell mojibake.
4. **README Rewrite:** Comprehensive, professional root [`README.md`](file:///d:/university/pamphlet/bachelor-project/radiology-adaptive-trainer/README.md) with educational disclaimer, Mermaid architecture diagram, quickstart, credentials, environment table, scripts table, and links to evaluation and limitations.
5. **Demo Script & Checklist:** Authored [`docs/DEMO-SCRIPT.md`](file:///d:/university/pamphlet/bachelor-project/radiology-adaptive-trainer/docs/DEMO-SCRIPT.md) (12-15 minute live presentation schedule, screen expectations, failure recovery steps, and honest defense Q&A answers) and [`docs/DEMO-CHECKLIST.md`](file:///d:/university/pamphlet/bachelor-project/radiology-adaptive-trainer/docs/DEMO-CHECKLIST.md) (pre-defense checklist).
6. **Known Issues & Limitations:** Authored [`docs/KNOWN-ISSUES.md`](file:///d:/university/pamphlet/bachelor-project/radiology-adaptive-trainer/docs/KNOWN-ISSUES.md) documenting technical debt, dataset demographic confounders, and scientific boundaries.

---

## 4. Verification Evidence

```powershell
npm run lint              # ESLint + RTL Logical Utility Scanner passed (0 errors, 0 warnings)
npm test                  # 89 test files passed, 727 unit and integration tests passed
npm run build             # Production bundles built cleanly
npm audit --omit=dev      # found 0 vulnerabilities
git grep -n -I -E "AIza[0-9A-Za-z_-]{30,}" # 0 matches (zero secrets)
```

---

## 5. Release Instructions (For Mahdi After PR Merge)

Per project rules, the AI agent does **not** create Git tags or GitHub releases. Once this PR is merged to `main`, Mahdi should run:

```powershell
git checkout main
git pull
npm run lint
npm test
git tag -a v1.0.0 -m "Radiology Adaptive Trainer v1.0.0 (capstone release)"
git push origin v1.0.0
git archive --format=zip -o radiology-adaptive-trainer-v1.0.0.zip v1.0.0
```

Then create a GitHub Release from `v1.0.0` in the web UI, attach `radiology-adaptive-trainer-v1.0.0.zip`, and conduct the final offline rehearsal on the presentation laptop.
