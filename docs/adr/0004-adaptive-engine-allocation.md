# 4. Adaptive question allocation and paper deviations

Date: 2026-10-24

## Status

Accepted

## Context

The source paper (Kianmehr & Hashemzadeh, *Journal of ICT*, 2025, pp. 102–127) introduces an adaptive training loop where chest X-ray questions are allocated per class and difficulty bucket according to the trainee's historical error rates. However, translating the paper's formulas directly into a real-world software system presents several mathematical edge cases and educational constraints:

1. **Division by Zero:** Raw formulas for False Negative Rate ($FNR = \frac{FN}{TP+FN}$) and False Positive Rate ($FPR = \frac{FP}{FP+TN}$) result in $0/0$ (`NaN`) when a resident has zero exposures to a class or has not committed any errors.
2. **Rounding Drift:** Naive floating-point rounding of class and bucket allocations causes the sum of questions to frequently diverge from the target test length $N$ (e.g. summing to 59 or 61 instead of 60).
3. **Image Memorization vs. Learning:** The paper does not restrict repeating images across consecutive sessions, allowing residents to recall prior image answers rather than diagnosing pathology.
4. **Design Floor for Adaptive Allocation ($N \ge 45$):** The paper specifies a minimum 20% question share per class and 4% per bucket. Across 3 disease classes, the reserved class floors consume at least $3 \times \lceil 0.20 \times N \rceil \approx 60\%$ of total test length $N$. If $N < 45$, the remaining free slots ($R = N - 3 \times \text{minClass}$) are fewer than 18 questions across the entire test, leaving too few adaptive slots for error-driven adaptation to have meaningful pedagogical impact. Therefore, $N \ge 45$ is established as a deliberate design floor (rather than an absolute mathematical impossibility) to ensure genuine adaptive behavior while satisfying bin constraints.
5. **Initial Test Difficulty Shares:** Page 112 of the paper references an initial difficulty distribution of 40% easy, 30% medium, and 30% hard.

## Decision

We establish the following formal adaptations and algorithmic enhancements in `@radiology/engine`:

1. **Laplace Additive Smoothing ($\alpha = 1$):**
   All error rates incorporate Laplace smoothing:
   $$\text{FNR}_c = \frac{\text{FN}_c + \alpha}{\text{TP}_c + \text{FN}_c + 2\alpha}, \quad \text{FPR}_c = \frac{\text{FP}_c + \alpha}{\text{FP}_c + \text{TN}_c + 2\alpha}$$
   This guarantees that rates are always strictly positive, continuous, and never produce `NaN` or `Infinity`, providing a graceful uniform fallback ($1/3$ per class) when history is empty.

2. **Hamilton-Hare (Largest Remainder) Allocation:**
   To guarantee integer question counts that sum strictly to $N$:
   - Each class receives a reserved floor: $\text{minClass} = \lceil \text{minClassShare} \times N \rceil$.
   - Remaining questions $R = N - 3 \times \text{minClass}$ are allocated via the Largest Remainder method based on normalized error weights $W_c$.
   - Within each class, bucket counts receive a reserved floor: $\text{minBucket} = \max(1, \text{round}(\text{minBucketShare} \times N))$, and remaining questions are distributed via Largest Remainder weighted by bucket incorrect rates $\text{IR}_{c,b}$.
   - Sums are guaranteed: $\sum_c N_c = N$ and $\sum_b N_{c,b} = N_c$.

3. **Design Floor on Test Size ($N \ge 45$):**
   The engine configuration schema enforces $N \ge 45$ as a design floor. Because class minimum floors consume $\approx 60\%$ of questions, choosing $N \ge 45$ guarantees that at least 18 questions ($40\%$) remain flexible for error-weighted adaptive reallocation, while ensuring that $3 \times \text{minBucket} \le \text{minClass}$ holds without bin starvation.

4. **No-Repeat Policy & Shortage Substitution:**
   By default (`allowRepeats: false`), previously answered images are excluded from candidate pools. If a specific class-bucket bin is depleted, shortages are filled from the nearest bucket of the same class (medium first), then from other classes ordered by error weight, logging substitutions in `plan.shortfalls` and total missing questions in `plan.deficit`.

5. **Parametrized Baseline Shares:**
   The initial test distribution defaults to $\{ \text{easy}: 0.40, \text{medium}: 0.30, \text{hard}: 0.30 \}$ per p.112 of the paper, but is explicitly validated by Zod and configurable in `EngineConfig`.

## Simulation findings and limitations

To evaluate whether adaptive allocation improves resident learning under simulated conditions, we implemented a Monte Carlo virtual resident simulator (`packages/engine/src/simulator/`) comparing three policies across 50 seeded residents (master seed = 42, 60 questions per session, mastery threshold = 0.80 per class):
- **FIXED:** Constant balanced question distribution (20 per class, 40/30/30 difficulty split).
- **RANDOM:** Uniform random sampling from available pool without repeats.
- **ADAPTIVE:** Engine error-pattern-driven allocation using Laplace-smoothed rates and Largest Remainder.

### Impartial Evaluation Methodology (Fair Probe Test)
To prevent evaluation bias (where an adaptive learner would be evaluated on questions intentionally skewed toward their weakest classes and hardest images), mastery was assessed for all policies after each training session on an identical, fixed, balanced probe test (60 items: 20 per class, balanced across difficulty buckets, generated once per resident seed). The resident answered probe items without updating their diagnostic skills (`updateSkill = false`).

### Empirical Results (50 Residents, Balanced Probe Test)

| Policy | Mastery Rate | Mean Sessions to Mastery | Final FPR (Covid) | Final FNR (Covid) | Final FPR (Pneu) | Final FNR (Pneu) |
|---|---|---|---|---|---|---|
| **FIXED** | 100.0% | 4.64 | 0.148 | 0.165 | 0.087 | 0.151 |
| **RANDOM** | 100.0% | 4.60 | 0.152 | 0.168 | 0.088 | 0.157 |
| **ADAPTIVE** | 100.0% | 4.50 | 0.148 | 0.168 | 0.088 | 0.149 |

### Observations & Educational Limitations
1. **Algorithmic Convergence:** Under the modeled learning dynamics ($S_c \leftarrow S_c + \eta(1 - S_c)$), the ADAPTIVE policy achieved the lowest mean sessions to mastery (4.50 vs 4.64 for fixed and 4.60 for random).
2. **Weak-Class Concentration vs. Balanced Mastery:** Adaptive allocation concentrates practice on the trainee's error-prone classes and harder difficulty buckets. While this rapidly suppresses false-negative and false-positive rates on challenging categories, declaring overall mastery requires simultaneous $\ge 80\%$ accuracy across all three classes on the balanced probe.
3. **Cognitive Modeling Limitations:** The simulation models learning as an asymptotic exposure function and decision noise as a uniform perturbation. It does not account for human cognitive fatigue, concept drift, or forgetting curves. Consequently, simulation findings verify mathematical convergence and stability, but do not replace empirical clinical trials with human radiology residents.

## Consequences

- The adaptive engine is fully deterministic, numerically stable, and validated through property-based tests across the full range $N \in [45, 120]$.
- Every test generated sums precisely to $N$ without integer rounding drift.
- All deviations from the paper are mathematically justified and defensible for the academic project defense.
