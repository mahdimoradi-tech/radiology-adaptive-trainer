# Security checklist (verification by the agent, report in docs/qa/SECURITY-REPORT.md)

Result values: PASS (with evidence), FAIL (with severity and reproduction), PARTIAL, N/A (with reason), NOT-TESTED (with reason). Evidence = test name, command and a short output summary. Never claim PASS without evidence you ran yourself.
Check `apps/api/src/__tests__` first (T11 already has the access-matrix and global-leak tests) and mark which items they already cover.

| ID | Area | What to verify | How (hint) |
|---|---|---|---|
| S01 | Cookies | Auth cookie has HttpOnly, SameSite=Lax, Path, and Secure when NODE_ENV=production | supertest on the app, read `Set-Cookie` in both modes |
| S02 | JWT | `alg:none` token, wrong-secret token, expired token, token of a deleted user are all rejected (HS256 is pinned in requireAuth.js) | craft tokens in a test |
| S03 | JWT | Is the role read from the token or from the database on each request? What happens after a role change? | read requireAuth.js, test |
| S04 | Passwords | Hashing algorithm and cost; minimum length enforced by Zod; password never in a response or log | read service.js, grep logs |
| S05 | User enumeration | Login with unknown email vs wrong password gives the same message and status | test |
| S06 | Rate limit | Limiters active outside tests on login AND register and LLM routes; 429 after the limit | test with the limiter enabled; check which routes lack one |
| S07 | CSRF | No state-changing GET routes; form-encoded or text/plain cross-site POST is not accepted as JSON | list routes by method; test content-types |
| S08 | Logout | Logout clears the cookie; note that a stateless JWT stays valid until expiry (document as accepted or recommend a fix) | test |
| S09 | Route coverage | Every Express route appears in the access-matrix test (enumerate `app._router`/route stack and compare with the test list) | script |
| S10 | IDOR | Resident A cannot read, answer, finish or list resident B's sessions, reports, practice sets, explanations | two accounts in a test |
| S11 | Images | `canViewImage`: resident only gets images of his own active session/practice; path traversal (`..%2f`, encoded dots, absolute paths), non-image names, directory paths | test |
| S12 | Lifecycle | Answer after finish -> 4xx; same question twice -> idempotent or 409; question not in session -> 4xx; adaptive before baseline -> 4xx | test |
| S13 | Label leak | Resident-facing responses (including errors, headers, image headers/file names, practice and explanation endpoints) never contain trueClass, bucket, difficulty, confusedWith, source, cohen/kermany/figure1 | extend or re-run global-leak test |
| S14 | Question bank | Residents only receive `approved` questions; edited question keeps its state rules; explanations only after answering | test |
| S15 | NoSQL injection | Login/register/body fields and query params as objects (`{"$ne":null}`, `?x[$ne]=1`) are rejected by Zod; no route passes raw `req.body`/`req.query` into a Mongoose filter | tests + grep |
| S16 | Validation | Every route validates params/query/body (list routes without Zod); malformed JSON -> 400; oversized body -> 413; invalid ObjectId/publicId -> 400/404 not 500 | script + tests |
| S17 | Mass assignment | Registration cannot set `role`; update routes whitelist fields | test |
| S18 | Headers/CORS | Helmet headers present, `x-powered-by` off; CORS is not `*` with credentials | supertest on headers |
| S19 | Errors/logs | In production a 500 returns a generic message (no stack, no path, no Mongo error text); logs contain no passwords, cookies, tokens or API keys | test + read logger.js |
| S20 | Env | Production refuses weak/missing JWT_SECRET (min 32 chars exists); `.env.example` contains no real values | read env.js |
| S21 | Secrets | `git grep -I -E "AIza|sk-|-----BEGIN|mongodb(\+srv)?://[^ ]*:[^ ]*@"` on the tree and on history (`git log --all -p -S...` with binary files excluded); `git log --all -- .env` is empty | commands |
| S22 | Dependencies | `npm audit` (full, including dev) and `npm audit --omit=dev`; list moderate or higher with a decision each | commands |
| S23 | XSS | No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` in apps/web; LLM and question text is rendered as text (or sanitized if markdown) | grep |
| S24 | LLM | Model output validated by Zod before storing/serving; prompts contain no resident name/email/IDs; no user free text goes into prompts (or it is bounded); `cache-only` makes no outbound request (test with fetch stubbed to throw); budget guard cannot be bypassed from API routes | read prompt builders, test |
| S25 | Frontend storage | No token or sensitive data in localStorage/sessionStorage; React Query cache is cleared on logout and user switch | grep + test |
| S26 | Demo data | Seeded demo accounts have local-only passwords documented as such; README says never to deploy with them | read seed + README |
