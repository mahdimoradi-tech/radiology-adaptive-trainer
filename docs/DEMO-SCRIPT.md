# Live Demo Script & Defense Q&A

**Session Duration:** ~12–15 Minutes  
**Topology:** Local presentation laptop, Windows 11, Local MongoDB 8, `LLM_MODE=cache-only` (100% offline, zero network risk).

---

## 1. Quick Presentation Runbook (Timeline)

| Time | Phase | Target Screen & Action | Key Message / Narrative |
|---|---|---|---|
| **00:00 - 01:30** | **Introduction** | Terminal & Architecture diagram in README | Project scope: Adaptive chest X-ray training for residents across COVID-19, Pneumonia, and Normal. Single developer capstone. |
| **01:30 - 04:00** | **Resident: Baseline & Report** | Login as Resident -> Resident Home -> View Finished Session 4 Report | Display 3x3 confusion matrix, FPR/FNR trends, and personalized Gemini narrative feedback + per-error radiological explanations. |
| **04:00 - 06:00** | **Resident: Progress & Trajectory** | Navigate to `/app/progress` | Show diagnostic accuracy improvement from Session 1 (46.7%) to Session 4 (77.8%). Explain mastery criteria (80% threshold). |
| **06:00 - 08:30** | **Resident: Targeted Practice** | Navigate to `/app/practice` -> Create Set -> Answer 1 Question | Demonstrate targeted practice on the resident's weakest confusion pair (COVID-19 vs Pneumonia). Immediate rationale reveal and zero label leakage. |
| **08:30 - 09:30** | **Resident: Education Guide** | Navigate to `/app/education` | Show grounded radiological hallmarks (ground-glass opacities, consolidations) from knowledge base and educational disclaimer. |
| **09:30 - 11:30** | **Instructor: Question Review Queue** | Second browser profile: Login as Instructor -> `/instructor/questions` | Show AI-generated question bank. Filter by pending status, review distractor plausibility and stem, approve 1 question live. |
| **11:30 - 13:00** | **Instructor: Trainee Roster & Catalog** | `/instructor/residents` & `/instructor/catalog` | Inspect resident cohort metrics. Review catalog 3x3 distribution matrix and demographic/source confounder disclosure (ADR 0005). |
| **13:00 - 15:00** | **Conclusion & Defense Q&A** | Terminal / Evaluation Report (`docs/EVALUATION.md`) | Transition to committee questions with empirical evaluation numbers. |

---

## 2. Step-by-Step Live Walkthrough & Recovery Procedures

### Step 1: Resident Login & Session Review
- **Action:** Open browser profile 1 at `http://127.0.0.1:5173/login`. Enter `demo.resident@example.com` / `DemoResident123!`. Click "ورود" (Login).
- **Expected Screen:** Resident dashboard displays recent session stats and an alert indicating Session 4 completed.
- **Action:** Click "مشاهده کارنامه آخرین آزمون" (View Last Session Report).
- **Expected Screen:**
  - 3x3 interactive confusion matrix with color-coded true vs predicted classes.
  - Per-class metrics table (COVID-19 accuracy, False Positive Rate, False Negative Rate).
  - AI Pedagogical Narrative card containing overview, strengths, and 3 actionable recommendations.
  - Question review accordion showing trainee answer vs true class with radiological finding explanation.
- *If it fails / screen blank:*
  - Recovery: Refresh the page (`Ctrl + F5`). Ensure local API is active on port 4000. If session data is missing, run `npm run demo:seed -w @radiology/api` in PowerShell.

### Step 2: Learning Progress Trajectory
- **Action:** Click on "روند یادگیری" (Learning Progress) in the top navigation bar (`/app/progress`).
- **Expected Screen:**
  - Sequential accuracy chart displaying steady improvement across Sessions 1 through 4 (46.7% -> 62.2% -> 68.9% -> 77.8%).
  - Per-class breakdown showing targeted remediation on previously confused classes.
- *If it fails:*
  - Recovery: Check browser console. Ensure `demo.resident@example.com` has finished sessions in MongoDB.

### Step 3: Targeted Confusion-Pair Practice
- **Action:** Click on "تمرین هدفمند" (Targeted Practice) in navigation (`/app/practice`).
- **Expected Screen:**
  - Targeted practice overview page displaying diagnosed confusion pair: `covid19` vs `pneumonia`.
- **Action:** Click "شروع تمرین جدید" (Start New Practice Set) with 5 questions.
- **Expected Screen:**
  - Question 1 loads with un-mirrored chest X-ray radiograph, Persian stem, and 4 shuffled multiple-choice options.
- **Action:** Select option (A or B) and click "ثبت پاسخ" (Submit Answer).
- **Expected Screen:**
  - Immediate feedback banner turns green (Correct) or amber (Incorrect) and reveals instructor-approved educational rationale.
  - Next question button appears.
- *If it fails (e.g. 409 POOL_EXHAUSTED):*
  - Recovery: Run `npm run bank:import -w @radiology/api` to reload the approved question bank seed.

### Step 4: Medical Knowledge Reference Guide
- **Action:** Click on "راهنمای آموزشی" (Education Guide) in navigation (`/app/education`).
- **Expected Screen:**
  - Medical disclaimer banner clearly stating educational non-clinical purpose.
  - 4-step explanation of the adaptive training loop.
  - Radiological findings table for COVID-19 (bilateral peripheral ground-glass opacities), Pneumonia (consolidation and air bronchograms), and Normal (clear lung fields, sharp costophrenic angles) grounded in vetted Markdown files.

### Step 5: Instructor Panel — Question Bank Moderation
- **Action:** Switch to browser profile 2 (or Incognito window) at `http://127.0.0.1:5173/login`. Enter `instructor@hospital.test` / `InstructorPassword123!`. Click "ورود".
- **Expected Screen:** Instructor dashboard displays 3 management cards: Review Queue, Trainee Roster, Catalog Monitor.
- **Action:** Click "بررسی سوالات تولید شده" (Review Generated Questions) -> `/instructor/questions`.
- **Expected Screen:**
  - Filter bar: Status (`در انتظار بررسی` / Pending), Type, Pair.
  - Question cards displaying stem, radiograph thumbnail, correct answer, and distractors.
- **Action:** Click "تایید سوال" (Approve Question) on a pending question card.
- **Expected Screen:** Toast notification confirms approval; question status badge changes to green "تایید شده" (Approved).

### Step 6: Instructor Panel — Trainee Roster & Catalog Monitor
- **Action:** Navigate to "فهرست دستیاران" (Resident Roster) -> `/instructor/residents`.
- **Expected Screen:** Table listing `Demo Resident (synthetic)` with 4 sessions, current accuracy (77.8%), and status. Click to inspect full trainee report.
- **Action:** Navigate to "کاتالوگ تصاویر" (Catalog Monitor) -> `/instructor/catalog`.
- **Expected Screen:**
  - Technical notice (ADR 0005) disclosing dataset sources and adult vs pediatric demographic confounders.
  - Class x Difficulty Bucket distribution matrix (1,177 images).
  - Source distribution breakdown: Kermany (1,000), Cohen (142), Figure1 (35).

---

## 3. Defense Questions & Honest Scientific Answers

Be prepared to answer committee and professor questions directly and honestly based on the project documentation:

### Q1: "Why wasn't the adaptive policy significantly faster to reach mastery in the virtual resident simulation?"
> **Answer:**  
> In our 50-seed empirical simulation (E1 in `docs/EVALUATION.md`), the adaptive policy achieved mastery in a comparable number of sessions to the random policy (~8.3 vs ~7.9 sessions). This occurs because our adaptive engine deliberately penalizes confusion by allocating harder radiographs from the trainee's specific error bins (FPR and FNR). As a result, subsequent adaptive tests are fundamentally *more rigorous* and challenging than random tests, preventing premature false mastery rather than artificially speeding up pass rates.

### Q2: "Does the calculated image difficulty purely measure human radiological subtlety?"
> **Answer:**  
> Not exclusively. As documented in ADR 0005 and evaluation E4, our difficulty metric $d = 1 - p(\text{trueClass})$ is derived from out-of-fold DenseNet-121 predictions. Because COVID-19 images originate from adult datasets (Cohen, Figure1) while Normal and Pneumonia images originate from pediatric cohorts (Kermany), the neural network learns subtle acquisition artifacts and patient age features. Therefore, difficulty partially reflects dataset domain divergence alongside true clinical presentation. We explicitly disclose this confounder in the instructor panel and thesis.

### Q3: "Why is the number of COVID-19 images much smaller than Pneumonia and Normal?"
> **Answer:**  
> Public de-identified COVID-19 radiograph archives are inherently limited in volume compared to historical pneumonia archives. After deduplicating and filtering for coronal chest X-rays, Cohen and Figure1 yielded 177 quality images, whereas Kermany contains over 5,800. To preserve test balance without causing excessive image repetition, we capped the catalog subset at 1,177 images (ADR 0005).

### Q4: "Who reviewed the question bank and validated the medical accuracy?"
> **Answer:**  
> The questions were synthesized using Google Gemini with structured JSON schemas grounded in clinical knowledge bases (`apps/api/src/modules/llm/kb/`), followed by automated consistency checks (verifying the correct class key and distractor plausibility). In our current prototype, approval in the instructor queue was performed by the system developer. In a hospital deployment, board-certified radiologists would serve as the authorized instructors.

### Q5: "How does the platform handle Google Gemini free-tier rate limits and internet outages?"
> **Answer:**  
> The free Gemini API allows only 20 requests per calendar day and 5 requests per minute. We architected a 3-tier defense (ADR 0012):
> 1. **Atomic Pacific-Day Budgeting:** Enforces a strict 16-call daily cap in MongoDB.
> 2. **Process Throttling:** Enforces a 13-second minimum delay between calls with exponential retry backoff.
> 3. **Cache-Only Offline Mode:** Pre-generates and caches canonical confusion-pair explanations (`apps/api/seed/llm-cache.portable.json`), allowing full live demonstrations without internet access or API quota consumption.

### Q6: "Can this system be deployed for hospital diagnostic use?"
> **Answer:**  
> Absolutely not. The platform is strictly an educational workstation simulator. As emphasized across our UI, code guardrails, and ADR 0006, machine learning and LLM outputs must never guide clinical patient triage or patient care.
