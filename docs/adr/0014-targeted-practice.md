# ADR 0014: Targeted Practice Architecture and Label Leakage Guard

- **Status:** Accepted
- **Date:** 2026-11-07
- **Developer:** Mahdi Moradi
- **Review:** AI Review per `docs/WORKFLOW.md`
- **Context Task:** T09b (Targeted Practice API + UI)

---

## 1. Context and Problem Statement

Following finished adaptive diagnostic tests, radiology residents exhibit asymmetric diagnostic errors (e.g., misclassifying COVID-19 as pneumonia or normal). To remediate these deficiencies, residents need targeted pedagogical practice focused on their specific confusion pairs.

However, targeted practice poses critical architectural and security constraints:
1. **Zero Label Leakage (ADR 0008):** In training and practice modes, ground truth classes, difficulty tiers, confusion pairs, and dataset origin must never be exposed to residents over the network or in DOM attributes.
2. **Pedagogical Integrity:** Residents must not see correct answers or educational rationales before committing an answer.
3. **Question Quality:** Questions must come exclusively from instructor-approved question bank items (T08b).
4. **Deterministic and Unbiased Delivery:** Position bias in LLM question generation (e.g., tendency to place correct answers in a preferred position) must be neutralized.
5. **Separation of Metrics:** Practice responses must never contaminate the formal adaptive test progression metrics.
6. **No Live Gemini Calls:** Practice question selection and delivery must operate entirely offline without consuming Gemini API quotas.

---

## 2. Decision Summary

### 2.1 Approved Questions Only
Only questions with lifecycle status `approved` in `QuestionBank` are eligible for practice sets. Unapproved questions (`pending_review`, `rejected`) are filtered out at the query level.

### 2.2 PracticeSet Server-Side Document
Practice sessions are stored as dedicated `PracticeSet` documents in MongoDB:
`{ userId, status ('in_progress' | 'completed'), size, questionIds[], publicIds[], optionOrder[][], plan, answers[], createdAt, completedAt }`.
Practice sets and answers are completely decoupled from `Session` and `Response` records; they do not alter resident test trajectories or formal mastery metrics.

### 2.3 Engine History and Adaptive Selection
The adaptive selection engine requires resident historical performance. The pure adapter `buildEngineHistory(finishedSessions)` extracts contract-compliant `Response[]` records strictly from finished sessions.
- If the resident has no finished sessions, creation aborts with HTTP 409 code `NO_HISTORY`.
- `answeredQuestionIds` aggregates all question IDs answered by the resident across past practice sets to prevent repetitions.
- If no unanswered approved questions remain, creation aborts with HTTP 409 code `PRACTICE_POOL_EXHAUSTED`.
- If fewer eligible questions remain than requested `size`, a smaller set matching the available pool size is generated.
- Question selection is performed via the pure engine function `selectTargetedQuestions(bank, history, config, n, answeredIds)` weighted by the resident's off-diagonal confusion pairs.

### 2.4 Option Shuffling and Index Mapping
For every question in a practice set, option order is shuffled using deterministic PRNG `createRng` seeded from the set ID and question index.
- The permutation array `optionOrder[qIdx]` is persisted in the database.
- Residents see only the shuffled option order and submit `selectedIndex` corresponding to this shuffled view.
- The backend maps `selectedIndex` back to the original index: `originalIndex = optionOrder[qIdx][selectedIndex]`.
- Correctness is evaluated server-side: `isCorrect = (originalIndex === questionDoc.correctIndex)`.
- The shuffled correct index returned to the client is `optionOrder[qIdx].indexOf(questionDoc.correctIndex)`.

### 2.5 Single Attempt and Lifecycle
- Each question in a practice set may be answered exactly once. Re-answering returns HTTP 409 `ALREADY_ANSWERED`.
- The set transitions to `completed` automatically when the last question is answered; there is no separate finish endpoint.

### 2.6 Role Separation and Ownership Security
- Targeted practice is reserved for residents (`requireRole('resident')`). Instructors receive HTTP 403 `FORBIDDEN`.
- Ownership is strictly enforced: querying or answering another resident's practice set returns HTTP 404 `NOT_FOUND`, preventing resource enumeration.

### 2.7 Zero Label Leakage Guard
Resident-facing payloads (`PracticeSetResident`, `PracticeQuestionResident`, `PracticeAnswerResponse`) use `.strict()` Zod schemas. The following keys are strictly disallowed at any depth:
`trueClass`, `confusedWith`, `bucket`, `difficulty`, `source`, `status`, `note`, `consensus`, `analysis`, `catalogId`, `imageId`, `filename`, `generatedBy`, review metadata.
- Images are referenced exclusively by opaque URLs: `/api/images/:publicId/file`.
- `canViewImage(user, image)` is extended to authorize residents for images belonging to their own practice sets via indexed `publicIds`.
- `correctIndex` and `rationale` are withheld until the question is answered.

### 2.8 No Live LLM Calls
No live calls to Google Gemini occur during practice set creation, serving, or grading. All content originates from previously approved questions in the database.

---

## 3. Consequences

### Positive
- Residents receive tailored remediation on their exact error patterns.
- Shuffled options completely eliminate answer position bias.
- Absolute privacy and label leakage prevention are validated by automated leak scanning in backend and frontend tests.
- Offline execution preserves zero API consumption against Gemini daily quotas.

### Negative / Trade-offs
- Practice availability is bounded by the volume of instructor-approved questions in the question bank. If an instructor has not approved enough questions for specific pairs, shortfall backfills or `PRACTICE_POOL_EXHAUSTED` occur as designed.
