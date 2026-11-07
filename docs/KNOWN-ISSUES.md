# Known Issues, Technical Debt & Limitations

This document maintains an accurate, unvarnished inventory of identified technical limitations, edge cases, and architectural trade-offs across the platform.

---

## 1. Inventory of Known Issues & Technical Debt

| ID | Area | Description | Severity | Status | Source |
|---|---|---|---|---|---|
| **ISS-01** | Data / ML | **Dataset Source & Demographic Confounder:** 100% of Normal (1,582) and Pneumonia (4,245) radiographs originate from the Kermany pediatric cohort (age 1-5), whereas 100% of COVID-19 radiographs (177) originate from adult cohorts (Cohen, Figure1). The DenseNet-121 CNN feature extractor and difficulty scores partially learn institutional and age artifacts alongside true radiological findings. | Medium | Mitigated via prominent UI disclosures (`/instructor/catalog`), ADR 0005, and thesis documentation | ADR 0005, E4 Evaluation, `docs/DATA-SOURCES.md` |
| **ISS-02** | Catalog / Engine | **COVID-19 Hard/Medium Pool Scarcity:** The 1,177-image catalog contains 172 Easy COVID-19 images, but only 2 Medium and 3 Hard COVID-19 images. When adaptive sessions demand Medium or Hard COVID-19 questions, the engine triggers nearest-bucket fallback and reallocates from Easy COVID-19 images. | Low | Mitigated: Handled gracefully by `@radiology/engine` nearest-bucket reallocation with 0 net test deficit | ADR 0004, T05 PR body |
| **ISS-03** | Engine / Simulation | **Asymptotic Learning Model in Simulator:** Virtual resident learning in `packages/engine` is modeled using a deterministic asymptotic update formula ($S_c \leftarrow S_c + \eta(1-S_c)$). It does not capture human cognitive plateaus, fatigue, or memory decay (forgetting curves). | Low | Documented: Simulation scope explicitly established for policy comparison in `docs/EVALUATION.md` | E1 Evaluation, `packages/engine` |
| **ISS-04** | LLM / API | **Gemini Free-Tier Rate & Daily Quota Limits:** Google AI Studio free tier limits usage to 20 requests/day (Pacific time) and 5 requests/min. Live calling cannot sustain high-volume continuous classroom use without a paid tier. | Medium | Mitigated: Implemented atomic Pacific-day budgeting (16 requests/day cap), 13s throttling, circuit breaker, and 100% offline `LLM_MODE=cache-only` mode | ADR 0012, T07, T11 |
| **ISS-05** | Question Bank | **Single Non-Expert Rubric Reviewer:** Question bank quality evaluation (E3) was conducted by a single reviewer (the system's author) assessing clarity, distractor plausibility, and answer leak-freedom, rather than multi-rater double-blind scoring by board-certified radiologists. | Low | Documented: Rubric exports RFC 4180 CSV (`docs/evaluation/question-rubric.csv`) for future multi-expert evaluation | E3 Evaluation, T08b |
| **ISS-06** | Frontend / Bundling | **Vite Production Vendor Chunk Size:** The minified JavaScript bundle (`index-*.js`) is ~688 kB (~196 kB gzipped), exceeding Vite's default 500 kB chunk size warning. For local development and demo use this has negligible impact, but remote production deployment would benefit from dynamic `import()` code-splitting. | Low | Deferred: Out of scope for local workstation presentation | T11 Fresh-Clone Test |
| **ISS-07** | Radiographs | **Visual Radiograph Artifacts:** Although opaque HMAC-SHA256 public IDs prevent programmatic dataset leakage in API responses, raw radiographs occasionally feature hospital text annotations or pediatric clavicle markers that could visually hint at dataset provenance to a trained radiologist. | Low | Acknowledged: Documented in ADR 0008 as an intrinsic dataset limitation | ADR 0008 |
| **ISS-08** | Authentication | **Session Cookie Security in Development:** Cookies in local development use `Secure: false` because browsers reject `Secure` cookies over plain HTTP (`http://127.0.0.1:5173`). Production environments (`NODE_ENV=production`) automatically enforce `Secure: true`. | Low | Fixed & Enforced: Verified in T11 security review | ADR 0007, T11 Step 3 |

---

## 2. Limitations for the Defense & Capstone Report

The following points summarize the scientific and engineering boundaries of this project (facts only, without speculation):

### 1. Dataset Confounding
The primary limitation of chest X-ray machine learning in COVID-19 research is dataset domain shift. COVID-19 emerged in 2020 and was photographed using varied hospital equipment on adult populations, whereas the Kermany pneumonia and normal dataset dates to 2018 and comprises pediatric patients. Out-of-fold accuracy metrics (E4 in `docs/EVALUATION.md`) must be interpreted with this context: the DenseNet-121 classifier reaches 99.4% accuracy partly by recognizing dataset-level acquisition characteristics.

### 2. Adaptive Policy Convergence in Simulation
In our empirical simulation across 50 seeds, the adaptive policy converged to mastery in 4.50 ± 1.40 sessions, compared to 4.60 ± 1.44 sessions for the random policy. The adaptive algorithm does not artificially accelerate mastery; rather, it selectively challenges trainees by re-weighting their weakest confusion pairs and drawing from harder difficulty bins, making subsequent sessions objectively more demanding.

### 3. LLM Multimodal Analysis & Quota Constraints
Due to strict Google AI Studio free-tier quotas (16 allowed requests per Pacific day in our budget guard), live multimodal radiograph analysis cannot be performed in real-time during examination sessions. The platform addresses this by pre-computing analysis batches and caching canonical confusion explanations, ensuring reliable offline execution.

### 4. Evaluation Scope
Question quality scoring was performed using a standardized 4-criterion rubric (scientific correctness, clarity, distractor plausibility, and zero leakage). While 100% of sampled questions passed technical leak and schema checks, medical pedagogical efficacy requires prospective clinical study with actual radiology residents.

### 5. Strict Non-Clinical Boundary
The platform is an educational prototype and research tool. Neither DenseNet-121 difficulty scores nor Gemini-generated feedback have been evaluated as Software as a Medical Device (SaMD) or cleared for clinical diagnostic triage.
