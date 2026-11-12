# Comprehensive Evaluation Report (T10)

This document contains empirical, reproducible evaluation results across the four analytical pillars of the Radiology Adaptive Training Platform:
1. **E1:** Adaptive Question Selection Simulation
2. **E2:** LLM Multimodal Image Analysis vs Dataset Ground Truth
3. **E3:** Question Bank Quality, Rubric Ratings & Generation Pipeline
4. **E4:** Machine Learning (DenseNet-121) Out-of-Fold Performance & Confounder Analysis

<!-- GENERATED:START -->

### E1 - Adaptive Engine Simulation Evaluation

> **Note:** simulated residents, not human data; known limitations in packages/engine README
> Command: `npm run eval:simulation` | Seeds: master=42, n=50 | SHA: `68da0d2c10d55b1210f6483131d1c6ba6e89d176`

| Policy | N | Mastery Rate (Wilson 95% CI) | Sessions to Mastery (Mean +/- SD) | Sessions (Median [Min-Max]) | Avg FPR (Covid / Pneu / Norm) | Avg FNR (Covid / Pneu / Norm) |
|---|---|---|---|---|---|---|
| **ADAPTIVE** | 50 | 100.0% [92.9%-100.0%] | 4.50 +/- 1.40 | 4.5 [2-8] | 0.148 / 0.088 / 0.024 | 0.168 / 0.149 / 0.179 |
| **RANDOM** | 50 | 100.0% [92.9%-100.0%] | 4.60 +/- 1.44 | 5.0 [2-9] | 0.152 / 0.088 / 0.024 | 0.168 / 0.157 / 0.179 |
| **FIXED** | 50 | 100.0% [92.9%-100.0%] | 4.64 +/- 1.55 | 5.0 [2-9] | 0.148 / 0.087 / 0.024 | 0.165 / 0.151 / 0.177 |

---

### E2 - LLM Image Analysis vs Dataset Ground Truth

> Command: `npm run eval:analysis` | Images: 120 | SHA: `68da0d2c10d55b1210f6483131d1c6ba6e89d176`

#### Summary Quality & Reliability
- **Schema-valid rate:** 100.0% [98.4%-100.0%] (240/240)
- **Auto-validation pass rate:** 57.5% [48.6%-66.0%] (69/120)
- **Run A vs Run B Raw Agreement:** 81.7%
- **Run A vs Run B Cohen's Kappa:** 0.709

#### Diagnostic Accuracy vs Dataset Labels
| Evaluation Target | N | Accuracy (Wilson 95% CI) | Covid-19 Recall / Prec | Pneumonia Recall / Prec | Normal Recall / Prec |
|---|---|---|---|---|---|
| **LLM Run A** | 120 | 67.5% [58.7%-75.2%] | 45.0% / 90.0% | 77.5% / 62.0% | 80.0% / 64.0% |
| **LLM Run B** | 120 | 65.0% [56.1%-72.9%] | 47.5% / 86.4% | 75.0% / 56.6% | 72.5% / 64.4% |
| **LLM Consensus (Agreed)** | 98 | 70.4% [60.7%-78.5%] | 45.7% / 100.0% | 89.3% / 59.5% | 80.0% / 70.0% |
| **DenseNet-121 Baseline (Same Images)** | 120 | 61.7% [52.7%-69.9%] | 92.5% / 88.1% | 47.5% / 47.5% | 45.0% / 47.4% |

#### Breakdown by Image Source & Bucket
| Category | Key | N | Run A Accuracy (95% CI) | Run B Accuracy (95% CI) |
|---|---|---|---|---|
| Source | `cohen` | 31 | 38.7% [23.7%-56.2%] | 41.9% [26.4%-59.2%] |
| Source | `figure1` | 9 | 66.7% [35.4%-87.9%] | 66.7% [35.4%-87.9%] |
| Source | `kermany` | 80 | 78.8% [68.6%-86.3%] | 73.8% [63.2%-82.1%] |
| Bucket | `hard` | 31 | 64.5% [46.9%-78.9%] | 51.6% [34.8%-68.0%] |
| Bucket | `easy` | 61 | 65.6% [53.0%-76.3%] | 70.5% [58.1%-80.4%] |
| Bucket | `medium` | 28 | 75.0% [56.6%-87.3%] | 67.9% [49.3%-82.1%] |

---

### E3 - Question Bank Quality & Rubric Evaluation

> **Note:** Rated by one non-expert reviewer (the system's builder); results are indicative only.
> Command: `npm run eval:questions score` | Rated: 24 | SHA: `68da0d2c10d55b1210f6483131d1c6ba6e89d176`

| Question Type | N | Scientific OK (Wilson 95% CI) | Clarity (1-5) | Distractor Plausibility (1-5) | Leak-Free (Wilson 95% CI) |
|---|---|---|---|---|---|
| `finding` | 8 | 100.0% [67.6%-100.0%] | 4.63 +/- 0.52 | 4.00 +/- 0.00 | 100.0% [67.6%-100.0%] |
| `distribution` | 8 | 100.0% [67.6%-100.0%] | 4.38 +/- 0.52 | 3.88 +/- 0.35 | 100.0% [67.6%-100.0%] |
| `differential` | 8 | 100.0% [67.6%-100.0%] | 4.50 +/- 0.53 | 4.13 +/- 0.35 | 100.0% [67.6%-100.0%] |
| **OVERALL** | **24** | **100.0% [86.2%-100.0%]** | **4.50 +/- 0.51** | **4.00 +/- 0.29** | **100.0% [86.2%-100.0%]** |

#### Question Generation Pipeline Statistics
- **Total questions in bank:** 83
- **Approved:** 83 (100.0%)
- **Pending review:** 0
- **Rejected by instructor:** 0
- **Edited by instructor:** 0 (0.0%)

##### Approved Questions by Type
| Finding | Distribution | Differential |
|---|---|---|
| 48 | 25 | 10 |

##### Approved Questions by Confusion Pair
| Confusion Pair | Count |
|---|---|
| `normal -> pneumonia` | 23 |
| `normal -> covid19` | 4 |
| `covid19 -> pneumonia` | 14 |
| `pneumonia -> normal` | 26 |
| `covid19 -> normal` | 10 |
| `pneumonia -> covid19` | 6 |

##### Generation Attempts & Automatic Rejections
- **Total logged rejected attempts:** 0

---

### E4 - ML (DenseNet-121) Out-of-Fold Performance & Confounder Analysis

> Command: `npm run eval:ml` | Total Images: 6004 | Catalog Subset: 1177 | SHA: `68da0d2c10d55b1210f6483131d1c6ba6e89d176`

#### 1. Out-of-Fold (OOF) Classification Accuracy
| Dataset Scope | N | Accuracy (Wilson 95% CI) | Covid-19 Recall / Prec | Pneumonia Recall / Prec | Normal Recall / Prec |
|---|---|---|---|---|---|
| **Full Dataset (OOF)** | 6004 | 95.2% [94.7%-95.7%] | 98.3% / 84.1% | 94.7% / 98.7% | 96.2% / 88.4% |
| **App Catalog (500 Cap)** | 1177 | 75.7% [73.2%-78.1%] | 98.3% / 84.1% | 55.4% / 83.9% | 88.0% / 68.8% |

#### 2. Accuracy by Image Source
| Source | N | Correct | Accuracy (Wilson 95% CI) |
|---|---|---|---|
| `kermany` | 5827 | 5544 | 95.1% [94.6%-95.7%] |
| `cohen` | 142 | 140 | 98.6% [95.0%-99.6%] |
| `figure1` | 35 | 34 | 97.1% [85.5%-99.5%] |

#### 3. Accuracy by Class x Source
| Class x Source | N | Correct | Accuracy (Wilson 95% CI) |
|---|---|---|---|
| **normal x kermany** | 1582 | 1522 | 96.2% [95.1%-97.0%] |
| **pneumonia x kermany** | 4245 | 4022 | 94.7% [94.0%-95.4%] |
| **covid19 x cohen** | 142 | 140 | 98.6% [95.0%-99.6%] |
| **covid19 x figure1** | 35 | 34 | 97.1% [85.5%-99.5%] |

#### 4. Class Distribution by Source (Confounder Disclosure)
| Disease Class | Total N | Sources Breakdown (Count & Class Share) |
|---|---|---|
| **covid19** | 177 | `cohen`: 142 (80.2%), `figure1`: 35 (19.8%) |
| **pneumonia** | 4245 | `kermany`: 4245 (100.0%) |
| **normal** | 1582 | `kermany`: 1582 (100.0%) |

#### 5. Difficulty Bucket Distribution per Source
| Source | Easy (%) | Medium (%) | Hard (%) | Total |
|---|---|---|---|---|
| `kermany` | 5440 (93.4%) | 180 (3.1%) | 207 (3.6%) | 5827 |
| `cohen` | 139 (97.9%) | 1 (0.7%) | 2 (1.4%) | 142 |
| `figure1` | 33 (94.3%) | 1 (2.9%) | 1 (2.9%) | 35 |

<!-- GENERATED:END -->

## Interpretation and Limitations (TODO for Mahdi / Claude)

> **Important:** The agent produces facts, empirical metrics, Wilson confidence intervals, and tables only. This section is reserved for human qualitative interpretation.

- [ ] **TODO: Adaptive Engine Simulation Limits** - Trainee skill growth in the simulator is modeled as an asymptotic exposure function ($S_c \leftarrow S_c + \eta(1-S_c)$). Real human diagnostic learning exhibits forgetting curves, fatigue, and visual cognitive plateaus that are not modeled here.
- [ ] **TODO: Dataset Source Confounder & COVID-19 Sample Size** - The COVID-19 class contains only 177 images (142 from Cohen, 35 from Figure1), whereas Kermany comprises 5,827 pediatric images (1,582 normal, 4,245 pneumonia). The CNN backbone may exploit institutional/scanner shortcuts between datasets rather than true pathology.
- [ ] **TODO: Single Non-Expert Question Rubric Reviewer** - The question bank rubric is rated by one non-expert reviewer (the system's builder); ratings are indicative of clarity, distractor plausibility, and absence of answer leakage, not formal board-certified pedagogical certification.
- [ ] **TODO: Limited LLM Batch Sample Size** - LLM image analysis evaluation is constrained to verified batches executed under the free-tier quota (5 RPM and 20 RPD, with an internal guard of 16 per Pacific day) and requires cautious statistical extrapolation.
- [ ] **TODO: Free-Tier API Rate Limits** - Gemini free-tier rate limits restrict daily throughput, requiring portable caching and offline batch processing for sustainable operation.
- [ ] **TODO: Educational Purpose Strictly Defined** - Platform is an educational prototype. Neither LLM feedback nor CNN feature extraction constitutes clinical diagnosis or medical device software.
