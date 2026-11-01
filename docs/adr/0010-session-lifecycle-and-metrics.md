# ADR 0010 — Training Session Lifecycle, Adaptive Flow, and Evaluation Metrics

Status: accepted (2026-11-02, Operator A)

## Context
The Radiology Adaptive Training Platform requires server-side orchestration for resident training sessions: baseline and adaptive test creation, answering questions without diagnostic leakage, session completion, comprehensive metrics calculation, performance reporting, and progress tracking. We needed architectural decisions on session lifecycle state machines, feedback timing, access control, and mathematical evaluation.

## Decisions

### 1. Server-Decided Session Kind
- **Baseline vs Adaptive:** The server decides session kind: if the resident has zero finished sessions, the engine selects a balanced baseline diagnostic test (`selectFirstTest`). If previous finished sessions exist, the engine adapts question distribution (`selectNextTest`) to the resident's historical error patterns.
- **Targeted Practice:** Reserved for future implementation in T09.

### 2. Single Active Session Constraint
- At most one `in_progress` session is permitted per resident. Creating another returns `409 Conflict` with code `SESSION_IN_PROGRESS` and the active session ID in `error.details.sessionId`.
- **Database Enforcement:** Guaranteed via a MongoDB partial unique index on `{ userId: 1, status: 1 }` with `{ partialFilterExpression: { status: 'in_progress' } }`, preventing race conditions and double-click creations.

### 3. Feedback Timing and Information Hiding
- **Zero Leakage During Test:** `PUT /api/sessions/:id/questions/:no/answer` accepts answers by question number (`1..N`), not by image identifier. The response returns `{ no, answered: true }` and strictly conceals `correct`, `trueClass`, `bucket`, `difficulty`, `source`, and internal image IDs.
- **Report Reveal:** Ground truth, correctness, confusion breakdown, and item review are revealed ONLY upon explicit session completion (`POST /api/sessions/:id/finish`) or when querying the finished report (`GET /api/sessions/:id/report`). Attempting to view the report while in progress returns `409 SESSION_NOT_FINISHED`.

### 4. Deterministic Engine Seeding and Pool Exhaustion
- **Seed Policy:** Each session configures the engine with a deterministic seed `${userId}:${index}`, guaranteeing reproducible question selection.
- **Deficit Handling:** If the catalog lacks sufficient unseen images for the requested test size, the API responds with `409 POOL_EXHAUSTED` containing `{ requested, available }`. Setting `ALLOW_REPEATS=true` allows the engine to recycle previously shown images across sessions.

### 5. Metrics Computation and Evaluation Math
- **Finished Session Scope:** Metrics and history include only answered questions from completed sessions; unanswered questions are excluded from denominator sums and error weights.
- **Raw Unsmoothed Metrics:** For finished reports, per-class metrics (`tp`, `fp`, `fn`, `tn`, `accuracy`, `precision`, `recall`, `f1`, `fpr`, `fnr`) are raw and unsmoothed (yielding 0 when denominators are 0). Per the specification, per-class `accuracy` equals class recall ($TP / (TP + FN)$).
- **Smoothed Engine Metrics:** In progress trajectories, `currentErrors` and `currentWeights` use Laplace smoothing ($\alpha = 1$) via `@radiology/engine`.

### 6. Image Ownership and Authorization
- **Non-Disclosure Principle:** Accessing another resident's session returns `404 NOT_FOUND` rather than 403, preventing resource enumeration.
- **Image Serving Guard:** Residents may only fetch image file bytes (`GET /api/images/:publicId/file`) for images included in at least one of their own sessions (`SessionModel.exists({ userId, 'questions.publicId': publicId })`). Instructors have global access to all catalog images.

## Known Limitations
- **Unanswered Question Reuse:** If a resident leaves questions unanswered upon finishing a session, those images are treated as unseen by the engine's `shownSet` and may reappear in subsequent tests under the no-repeat rule.

## Consequences
- Full compliance with the reference paper's adaptive selection algorithm.
- Trainees cannot inspect network traffic or responses to deduce image labels or diagnosis during an exam.
- Instructors have complete oversight of resident progress trajectories and session reports.
