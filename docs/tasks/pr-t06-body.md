## Task & Team

- **Task ID:** T06
- **Driver:** Operator A (solo)
- **Reviewer:** none (solo) -> AI review per `docs/SOLO-MODE.md`

## Summary

### What

- Built the complete resident training frontend in `apps/web`:
  - **Sessions API & Hooks (`src/features/sessions/`):** Implemented `keys.js`, `api.js`, and `hooks.js` (`useSessions`, `useSession`, `useSessionReport`, `useCreateSession`, `useAnswerQuestion`, `useFinishSession`) with optimistic cache updates and rollbacks.
  - **Tests Overview (`/app/tests`):** Past sessions list, active in-progress session continuation, size picker (45, 60, 90, 120), and friendly error handling for 409 `SESSION_IN_PROGRESS` and `POOL_EXHAUSTED`.
  - **Question Navigator (`QuestionNavigator.jsx`):** Two-column layout on desktop (first in DOM to naturally float right in RTL mode), collapsible strip on mobile, with accessible color and icon indicators (answered, unanswered, current).
  - **Interactive Quiz (`/app/tests/:sessionId`):** Radiograph viewer in protected `XrayImage` container, fixed 3-option diagnosis radio group, keyboard navigation keys 1/2/3, immediate autosave (`PUT /api/sessions/:id/questions/:no/answer`), elapsed time measurement (`timeMs`), next-image prefetching, and finished session auto-redirection.
  - **Finish Dialog (`FinishDialog.jsx`):** Accessible dialog with Escape key support, backdrop blur, and unanswered question warning.
  - **Diagnostic Report (`/app/reports/:sessionId`):** Performance summary, 3x3 confusion matrix (row = true class), one-vs-rest metrics table (TP, FP, FN, TN, recall, precision, F1), difficulty breakdown tables for correct and incorrect answers, server-driven mastery band labels (`mastered` -> «خوب (به هدف رسیده‌اید)», else accuracy >= 0.5 -> «متوسط», else «ضعیف»), and pedagogical plan explanation without revealing catalog shortfalls.
  - **Question Review (`/app/reports/:sessionId/review`):** Color-coded review navigator, trainee vs ground truth diagnosis comparison, question filter tabs (`all`, `incorrect`, `unanswered`), and an `extra` slot reserved for AI/LLM feedback (T07).
  - **Data Leak Prevention (`QuizLeak.test.jsx`):** Automated security regression test asserting zero occurrences of ground truth, buckets, difficulty, or source dataset names in the quiz DOM and image URLs.
  - **ADR 0011:** Documented autosave deviation from the paper, information hiding, and evaluation review decisions.

### Why

- Enables resident trainees to undergo diagnostic exams on chest X-rays, record answers with zero data loss on page refresh, view rich diagnostic feedback following the reference paper (figures 5, 6, 7), and review their mistakes.

---

## Step 0: Reconnaissance Findings (Without Guessing)

1. **API Base URL / Dev Proxy / Credentials:**
   Vite proxies `/api` to Express on `http://127.0.0.1:4000`. `apiFetch` uses `credentials: 'include'`. Errors throw structured `ApiError` instances with `{ code, status, message, details }`. `getErrorI18nKey(code)` maps error codes to `errors.<CODE>`.
2. **Query-Key & Hook Conventions:**
   Feature-based query key factory in `src/features/sessions/keys.js` with `sessionKeys.all`, `lists()`, `list(params)`, `details()`, `detail(id)`, `reports()`, `report(id)`. TanStack Query hooks in `hooks.js`.
3. **UI Components & Props:**
   Standard components in `src/components/ui`: `Button`, `Input`, `Field`, `Card`, `Alert`, `Badge`, `Spinner`, `XrayImage` (`src`, `alt`, `aspectRatio`, `className`, `fallbackText`), and `LanguageSwitcher`.
4. **i18n File Layout & Key Parity:**
   `src/i18n/locales/{fa,en}.json`. 100% key parity enforced by `src/i18n/__tests__/i18n.test.js`. Added `sessions.*`, `quiz.*`, `finishDialog.*`, `report.*`, `review.*`, and session error keys with identical parity.
5. **Number / Date / Digit Helpers:**
   `fmt.number(value, lang)`, `fmt.percent(value, lang, decimals)`, `fmt.date(value, lang)` (Jalali formatting for Persian).
6. **API Test Mocking:**
   `globalThis.fetch = vi.fn().mockResolvedValue(...)` with QueryClientProvider and MemoryRouter test harnesses.
7. **ResidentLayout Container:**
   Renders top navigation header with app branding, NavLinks (`/app`, `/app/tests`, `/app/progress`, `/app/education`), LanguageSwitcher, user profile badge, and logout; and footer with educational disclaimer.
8. **Image URL Serving & Cookies:**
   Backend serves `/api/images/:publicId/file`. Because it is relative same-origin through the Vite proxy, the browser sends session cookies automatically without requiring a `crossOrigin` attribute.

---

## Empirical Verification Output

### 1. Quality Gates
```powershell
npm run lint
# Output:
# ✔ RTL Violation Check Passed: All files in apps\web\src use logical RTL utilities.
# Exited with code 0.

npm test
# Output:
# Test Files  46 passed (46)
# Tests       274 passed (274)
# Exited with code 0.

npm run build
# Output:
# ✓ built in 327ms
# Exited with code 0.
```

### 2. Privacy & Leak Prevention
`QuizLeak.test.jsx` verified that no element or attribute contains:
- `trueClass`, `bucket`, `difficulty`, `confusedWith`, `cohen_`, `kermany_`, `figure1_`, `chestxray14_`
- Image `src` attributes are strictly opaque `/api/images/:publicId/file` without class names.

### 3. Real Catalog Baseline Plan from mongosh
Inspected `mongodb://127.0.0.1:27017/radiology`:
```json
{
  "classCounts": { "covid19": 15, "pneumonia": 15, "normal": 15 },
  "bucketCounts": {
    "covid19": { "easy": 6, "medium": 5, "hard": 4 },
    "pneumonia": { "easy": 6, "medium": 5, "hard": 4 },
    "normal": { "easy": 6, "medium": 5, "hard": 4 }
  },
  "shortfalls": [
    { "classId": "covid19", "bucket": "medium", "requested": 5, "available": 2, "shortfall": 3 },
    { "classId": "covid19", "bucket": "hard", "requested": 4, "available": 3, "shortfall": 1 }
  ],
  "deficit": 0
}
```
- For COVID-19, the catalog has only 2 medium and 3 hard images. The requested counts for a 45-question test were 5 medium and 4 hard.
- The engine recorded 3 medium and 1 hard shortfalls, and resolved them completely (deficit 0) via fallback borrowing from the easy bucket.
- These shortfalls are kept strictly hidden from residents in the UI as required by ADR 0011.

---

## Contract Changes

- **Contract changed?** [ ] Yes / [x] No

## Dependencies Added

| Package | Version | Why Needed |
| ------- | ------- | ---------- |
| None | N/A | No new dependencies added |

---

## What the Reviewer Must Understand

1. **Autosave UX:** Radio selection immediately issues an autosave mutation. Answers can still be changed at any time prior to clicking «ثبت نهایی و خروج».
2. **Information Hiding:** The quiz never exposes diagnostic labels or model difficulty.
3. **Mastery Thresholds:** Mastery labels use the engine's `perClassMastered` rather than hardcoding 80% in the frontend.
4. **RTL Placement:** In RTL (`dir="rtl"`), placing the question navigator first in the DOM naturally positions it on the right side on desktop without CSS hacks.
5. **URL State Synchronization:** Question position is tracked via `?q=`, and unfinished sessions automatically resume at the first unanswered question.

---

## Checklist

- [x] `npm run lint` passes
- [x] `npm test` passes
- [x] `npm run build` passes
- [x] `docs/PROGRESS.md` board row updated
- [x] Operator log updated in `docs/progress/operator-a.md`
- [x] No secrets (`.env`), datasets, images, or large binary files committed
- [x] Commit history follows Conventional Commits
