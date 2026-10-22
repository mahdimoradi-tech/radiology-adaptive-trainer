# DOMAIN — what the paper describes and what we build

Paper: Kianmehr & Hashemzadeh, "Personalization of the Radiology Residency Training Process Using Deep Learning and Interactive Extraction of Diagnostic Error Patterns", Journal of ICT (Iran), vol. 17, issues 66-67, 2025, pp. 102-127. PDF: `docs/reference/paper.pdf` (git-ignored; copyright).

## 1. Classes and data
Three chest X-ray classes: `covid19`, `pneumonia` (bacterial + viral), `normal`. Paper dataset ~6432 images: 4273 pneumonia, 1583 normal, 576 covid19, merged from Kermany (Mendeley), Cohen et al. (GitHub ieee8023), Chung et al. (Actualmed + Figure1, GitHub agchung). The web app uses a catalog subset (~500 per class, see `ml-difficulty-pipeline`).

## 2. Image difficulty
DenseNet-121 transfer learning + a 3-class head gives class probabilities. For image i with true class y: `p = P(y|i)`, `difficulty d = 1 - p`. Buckets: easy `d < ~0.34`, medium `~0.34..~0.68`, hard `> ~0.68` (thirds of [0,1]; configurable). Deviation: p is computed OUT-OF-FOLD. Also store `confusedWith` = the most probable WRONG class.

## 3. Training cycle (4 steps per test)
1. Take a test (first test: equal classes; inside each class easy/medium/hard = 40/30/30 per the paper, p.112 - verify).
2. Process: per-class TP/FP/FN/TN, accuracy, recall, precision, F-score.
3. Report strengths/weaknesses; review every question.
4. Design the next test adaptively from ALL previous results; stop when accuracy in all three classes passes the mastery threshold (paper: 80%).

## 4. Metrics and adaptive formulas
One-vs-rest per class. `FNR = FN/(TP+FN)`, `FPR = FP/(FP+TN)`, `Error_c = FPR_c + FNR_c`, `Weight_c = Error_c / ΣError`. Minimum 20% of N per class and 4% of N per bucket. The exact, smoothed, normalized version: skill `adaptive-engine`.

## 5. What we add (professor's emphasis: LLM for image analysis and question generation)
- **Image analysis** with a multimodal model (Gemini) using a CLOSED vocabulary (laterality, zones, patterns, distribution), run twice with different prompts, validated automatically against the dataset label and against itself.
- **Question generation**: Persian multiple-choice questions (`finding`, `distribution`, `differential`) from validated analyses + knowledge base. Every question starts as `pending_review`; only instructor-approved questions are served.
- **Targeted practice**: the engine finds the user's confusion pairs (e.g. covid19 -> pneumonia) and serves approved questions for that pair.
- **Feedback**: per-error explanations and a narrative report written from engine-computed statistics. The LLM never computes numbers or decides labels.
- **Two panels:** resident (tests, reports, progress, targeted practice) and instructor (review queue for generated questions, user progress, catalog statistics).
- All LLM content is pre-generated and cached; `LLM_MODE=cache-only` makes demos independent of the internet/VPN. Skills: `llm-feedback`, `question-generation`.

## 6. Screens in the paper (UI reference, Figs. 4-8; our UI is Persian RTL)
Dashboard (start test, review previous tests, education, user info, activity feed) · test setup (topic, number of questions) · quiz (large image, three options, side list of question numbers with state colors, save & next / save & exit) · report (totals, per-class accuracy, per-difficulty %, tables: confusion matrix, per-class metrics, correct by class x difficulty, wrong by class x difficulty) · review (per question: right/wrong, user answer vs correct, difficulty) · education page (text on opacity, consolidation, ground-glass, pleural thickening; sample images per class).

## 7. Educational knowledge-base seed (for LLM grounding) - DRAFT, needs instructor/clinician review
- Opacity: region whiter than normal lung (air replaced by fluid, cells or tissue). Consolidation: dense opacity where airspaces are filled; may show air bronchograms. Ground-glass opacity: hazy increased density that does not hide vessels. Pleural thickening: band-like whitening along the pleura.
- COVID-19: often bilateral, peripheral, lower-zone predominant ground-glass opacity, with or without consolidation; may be subtle early.
- Bacterial pneumonia: often focal/lobar or segmental consolidation, frequently unilateral, possible air bronchograms.
- Viral pneumonia: often bilateral perihilar/interstitial changes; overlaps with COVID-19 and can be hard to separate on plain films.
- Normal: clear lung fields, sharp costophrenic angles, normal cardiac silhouette.
- Caveat to repeat in the KB: a chest X-ray alone cannot confirm a specific infection; this is a teaching summary, not clinical guidance.
Write as small Markdown files in `apps/api/src/modules/llm/kb/` with front-matter `reviewed: false`, `tags`, `classes`.

## 8. Decisions that differ from the paper (each gets an ADR)
D1 out-of-fold difficulty · D2 Laplace smoothing · D3 normalized allocation that sums to N · D4 minimum N = 45 · D5 no image repeats until the pool is exhausted · D6 "similar images" weighting is a Could · D7 LLM layer added (not in the paper) · D8 closed-vocabulary image analysis + auto-validation + instructor approval · D9 pre-generated, cached LLM content and `cache-only` mode · D10 two panels · D11 catalog subset instead of all ~6.4k images.

## 9. Out of scope
Clinical diagnosis, real patient data, other modalities, mobile app, local LLMs, online deployment (Could), Docker.
