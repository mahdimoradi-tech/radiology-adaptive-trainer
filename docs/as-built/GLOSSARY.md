# As-Built Glossary and Terminology

This glossary defines the domain concepts, statistical formulations, machine learning metrics, and technical terms used across the platform and its engineering documentation.

---

## 1. Clinical & Radiological Domain Terms

### Chest Radiograph (CXR)
A projection radiograph of the chest used to diagnose conditions affecting the chest, its contents, and nearby structures. In this platform, all radiographs are posteroanterior (PA) or anteroposterior (AP) chest X-rays formatted as web-optimized JPEG images.

### Diagnostic Target Classes
The platform evaluates trainee performance across three mutually exclusive clinical classifications:
1. **`covid19`**: Radiographs exhibiting signs of coronavirus disease 2019, typically characterized by bilateral, peripheral ground-glass opacities and lower-zone consolidation.
2. **`pneumonia`**: Radiographs displaying non-COVID infectious pulmonary consolidation (bacterial lobar consolidation or viral interstitial opacities).
3. **`normal`**: Radiographs showing clear lung parenchymal fields, sharp costophrenic angles, and normal cardiothoracic ratio.

### Radiological Findings (Closed Vocabulary)
Standardized radiological descriptors used by the multimodal LLM to analyze radiographs:
- **Consolidation**: Dense alveolar filling where fluid replaces air in pulmonary acini, often displaying air bronchograms.
- **Ground-Glass Opacity (GGO)**: Hazy increased lung attenuation without obscuration of underlying bronchial walls or pulmonary vessels.
- **Pleural Thickening**: Fibrotic or inflammatory widening of pleural membranes.
- **Laterality**: Spatial occurrence categorized as `unilateral_left`, `unilateral_right`, or `bilateral`.
- **Distribution**: Anatomical distribution pattern across lung zones (`peripheral`, `central`, `bronchovascular`, `diffuse`).

---

## 2. Statistical & Adaptive Learning Metrics

### Diagnostic Confusion Matrix
A $3 \times 3$ contingency table representing true pathology classes versus resident-predicted classes:
- **True Positive ($TP_c$)**: Instances where class $c$ was correctly identified as $c$.
- **False Positive ($FP_c$)**: Instances where a non-$c$ pathology was incorrectly identified as $c$.
- **False Negative ($FN_c$)**: Instances where true class $c$ was misclassified as another class.
- **True Negative ($TN_c$)**: Instances where non-$c$ pathology was correctly classified as non-$c$.

### False Positive Rate ($FPR_c$)
The proportion of non-$c$ cases incorrectly identified as $c$:
$$FPR_c = \frac{FP_c}{FP_c + TN_c}$$

### False Negative Rate ($FNR_c$)
The proportion of true $c$ cases missed by the resident:
$$FNR_c = \frac{FN_c}{TP_c + FN_c}$$

### Diagnostic Error Rate ($Error_c$)
The unweighted diagnostic error burden for class $c$, combining both false-alarm and miss tendencies:
$$Error_c = FPR_c + FNR_c$$
In the implementation (`packages/engine/src/formulas.js`), Laplace smoothing ($\alpha = 1$) is applied to avoid division by zero when denominators are zero.

### Class Error Weight ($Weight_c$)
The normalized proportion of diagnostic errors attributed to class $c$:
$$Weight_c = \frac{Error_c}{\sum_{k \in C} Error_k}$$
Error weights govern the allocation of questions in subsequent adaptive training sessions.

### Diagnostic Confusion Pair
An ordered pair $(c_{\text{true}}, c_{\text{pred}})$ where $c_{\text{true}} \neq c_{\text{pred}}$, indicating a specific diagnostic error mode (e.g., misdiagnosing COVID-19 as bacterial pneumonia). The platform tracks 6 distinct off-diagonal pairs.

### Class Mastery Threshold
The benchmark criterion defined by the reference paper (Kianmehr & Hashemzadeh 2025): a trainee achieves mastery in class $c$ when their cumulative accuracy for class $c$ reaches or exceeds **80%** ($\ge 0.80$).

---

## 3. Machine Learning & Difficulty Pipeline

### DenseNet-121 Feature Extractor
A 121-layer densely connected convolutional neural network pre-trained on ImageNet and fine-tuned on the merged chest radiograph dataset with a 3-class classification head.

### Out-of-Fold Difficulty Score ($d_i$)
The intrinsic diagnostic difficulty of image $i$ computed via 5-fold cross-validation:
$$d_i = 1 - P(y_i \mid x_i)$$
where $P(y_i \mid x_i)$ is the out-of-fold predicted probability of the true label $y_i$. An image predicted with 95% confidence has $d = 0.05$ (very easy); an image with 20% true-class confidence has $d = 0.80$ (hard).

### Difficulty Buckets
Tri-partite categorization of the difficulty continuum $[0, 1]$:
- **`easy`**: $d_i < 0.34$
- **`medium`**: $0.34 \le d_i \le 0.68$
- **`hard`**: $d_i > 0.68$

### Secondary Confused Class (`confusedWith`)
The non-true class that received the highest predicted probability from the neural network:
$$\text{confusedWith} = \arg\max_{c \neq y_i} P(c \mid x_i)$$

---

## 4. Software Architecture & Platform Terms

### As-Built Specification
A retrospective engineering document that codifies the actual, verified behavior, APIs, data contracts, and operational boundaries of an already-implemented system.

### Baseline Test
The diagnostic entry exam administered to new residents. It contains 60 questions by default (configurable, min 45) with an equal class distribution (20 each of `covid19`, `pneumonia`, `normal` at $N=60$; 15 each at $N=45$) and a 40% Easy / 30% Medium / 30% Hard difficulty distribution.

### Adaptive Session
A personalized diagnostic training session (default 60 questions, configurable with floor $N \ge 45$) wherein question counts per class are dynamically weighted based on the resident's historical error profile, with guaranteed floors (minimum 20% of $N$, i.e. $\ge 12$ per class at $N=60$ or $\ge 9$ at $N=45$; minimum 4% of $N$, i.e. $\ge 2$ per difficulty bucket).

### Targeted Practice
A focused pedagogical micro-session consisting of 5 multiple-choice questions addressing a single diagnosed confusion pair (e.g., `covid19_pneumonia`), drawing questions from the approved question bank.

### Question Bank
A repository of structured multiple-choice questions generated from multimodal LLM image analyses, categorized by question type (`finding`, `distribution`, `differential`), held in `pending_review` until explicitly approved or rejected by an instructor.

### Virtual Resident Simulator
A deterministic simulation framework (`packages/engine/src/simulator.js`) that models resident learning trajectories over sequential adaptive or random training tests under controlled learning rates ($\eta$) and asymptotic updates.

### Label Leakage
The accidental exposure of diagnostic ground truth (`trueClass`), model confidences, difficulty metrics, source dataset provenance, or internal IDs in client-facing API responses before an answer or test is finalized.

### Opaque Public ID
An HMAC-SHA256 hex string derived from image catalog IDs using a server-side secret (`HMAC_SECRET`). Residents interact solely with opaque IDs, preventing sequential guessing or dataset identification.

### LLM Execution Modes
- **`live`**: Live API communication with Google AI Studio Gemini endpoints.
- **`cache-only`**: Fully offline operation; serves pedagogical feedback exclusively from seeded MongoDB cache collections (`llm-cache.portable.json`), with network requests strictly prohibited.
- **`fake`**: Deterministic in-memory stub used for automated unit testing without MongoDB or external APIs.

### Software as a Medical Device (SaMD)
Regulatory term denoting medical software intended for clinical diagnostic or therapeutic purposes. The platform explicitly disclaims SaMD status and is restricted to non-clinical educational simulation.
