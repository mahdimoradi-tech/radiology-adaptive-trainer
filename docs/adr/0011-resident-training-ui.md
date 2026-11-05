# ADR 0011 — Resident Training UI: Autosave, Information Hiding, and Evaluation Review

Status: accepted (2026-11-05, Operator A)

## Context
In T06, we implemented the frontend user experience in `apps/web` for resident trainees to undergo diagnostic exams on chest radiographs according to the reference paper (figures 5, 6, and 7). Key requirements involved designing the quiz interaction, answer persistence, exam completion dialogs, comprehensive diagnostic reporting, and question-by-question review while strictly enforcing educational privacy and RTL layout standards.

## Decisions

### 1. Autosave Selection (Deviation from Reference Paper)
- **Paper Design:** The paper's interface contained an explicit "Submit Answer" button for every question.
- **Our Decision:** Selecting a radio option (or pressing keyboard shortcut `1`, `2`, or `3`) immediately triggers an optimistic update and calls `PUT /api/sessions/:id/questions/:no/answer`.
- **Rationale:** Web browser trainees frequently reload, navigate back/forward, or encounter accidental disconnects. Immediate autosave guarantees zero loss of trainee answers. Changing an answer remains permissible at any time prior to clicking «ثبت نهایی و خروج».

### 2. Strict Information Hiding During Examination
- **Zero Feedback During Quiz:** While a session is `in_progress`, the quiz view renders only the medical image, question index, and the three diagnosis options.
- **No Diagnostic Leakage:** Ground truth labels, difficulty buckets, numeric difficulty, error models, and source dataset names are completely excluded from network traffic and DOM nodes.
- **Automated Guard:** Verified via `QuizLeak.test.jsx`, which scans the rendered DOM and all attributes to ensure zero occurrences of forbidden diagnostic tokens.

### 3. Mastery Band Labels Derived from Server Contract
- **No Hardcoded Thresholds:** The UI never hardcodes the 80% mastery cutoff.
- **Band Mapping:**
  - If `report.perClassMastered[classId] === true`: «خوب (به هدف رسیده‌اید)»
  - Else if `metrics.accuracy >= 0.5`: «متوسط»
  - Else: «ضعیف»
- **Rationale:** Ensures future calibration of mastery thresholds on the backend engine propagates automatically without requiring frontend updates.

### 4. Educational Plan Transparency Without Catalog Shortfalls
- **Resident Visibility:** The «چرا این آزمون؟» (Why This Test?) card provides clear pedagogical feedback:
  - For `baseline`: Explains that the session is a balanced diagnostic benchmark.
  - For `adaptive`: Explains adaptive question allocation and displays allocated question counts and error weights per disease class.
- **Deficit Concealment:** Catalog shortfalls (`plan.shortfalls`) and aggregate deficits (`plan.deficit`) are strictly hidden from resident views to maintain trust and prevent confusion regarding underlying dataset limitations.

### 5. URL-Synchronized State and Deterministic Resume
- **Query Parameter:** The active question is synchronized with the URL search query (`?q=N`, 1-based index).
- **Resume Protocol:** When opening an in-progress session without `?q=`, the view automatically resumes at the first unanswered question (or question 1 if all are answered).
- **History Preservation:** Native browser back/forward buttons seamlessly step through questions without disrupting answered states.

### 6. Paper-Aligned Layouts with Logical RTL Support
- **Two-Column Quiz (Paper Figure 5):** On desktop, the question navigator is the first DOM child, naturally placing it on the right side in RTL mode (`dir="rtl"`). On mobile devices, it becomes a collapsible strip.
- **Report Analytics (Paper Figure 6):** Renders the 3x3 confusion matrix with row-as-true-class orientation, per-class one-vs-rest metrics table, and difficulty breakdown tables for correct and incorrect answers.
- **Review with Filters (Paper Figure 7):** Provides color-coded status badges, dual answer comparison (trainee vs ground truth), question filters (`all`, `incorrect`, `unanswered`), and an `extra` slot reserved for LLM feedback in T07.

## Consequences
- Trainees experience a resilient, responsive exam interface that preserves work automatically.
- Security and pedagogical validity are preserved by eliminating answer leakage during testing.
- UI components strictly conform to Tailwind CSS 4 logical utility rules and maintain 100% Persian/English localization parity.
