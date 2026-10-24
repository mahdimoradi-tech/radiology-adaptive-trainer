# 4. Adaptive question allocation and paper deviations

Date: 2026-10-24

## Status

Accepted

## Context

The source paper (Kianmehr & Hashemzadeh, *Journal of ICT*, 2025, pp. 102–127) introduces an adaptive training loop where chest X-ray questions are allocated per class and difficulty bucket according to the trainee's historical error rates. However, translating the paper's formulas directly into a real-world software system presents several mathematical edge cases and educational constraints:

1. **Division by Zero:** Raw formulas for False Negative Rate ($FNR = \frac{FN}{TP+FN}$) and False Positive Rate ($FPR = \frac{FP}{FP+TN}$) result in $0/0$ (`NaN`) when a resident has zero exposures to a class or has not committed any errors.
2. **Rounding Drift:** Naive floating-point rounding of class and bucket allocations causes the sum of questions to frequently diverge from the target test length $N$ (e.g. summing to 59 or 61 instead of 60).
3. **Image Memorization vs. Learning:** The paper does not restrict repeating images across consecutive sessions, allowing residents to recall prior image answers rather than diagnosing pathology.
4. **Constraint Solvability ($N \ge 45$):** With 3 disease classes and 3 difficulty tiers (9 bins), minimum class shares ($20\%$) and minimum bucket shares ($4\%$) require a mathematical lower bound on test size to prevent bin starvation.
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

3. **Strict Minimum Test Size ($N \ge 45$):**
   The engine configuration schema enforces $N \ge 45$ so that $3 \times \text{minClass} \le N$ and $3 \times \text{minBucket} \le \text{minClass}$ are mathematically satisfied without constraint violation.

4. **No-Repeat Policy & Shortage Substitution:**
   By default (`allowRepeats: false`), previously answered images are excluded from candidate pools. If a specific class-bucket bin is depleted, shortages are filled from the nearest bucket of the same class (medium first), then from other classes ordered by error weight, logging substitutions in `plan.shortfalls`.

5. **Parametrized Baseline Shares:**
   The initial test distribution defaults to $\{ \text{easy}: 0.40, \text{medium}: 0.30, \text{hard}: 0.30 \}$ per p.112 of the paper, but is explicitly validated by Zod and configurable in `EngineConfig`.

## Consequences

- The adaptive engine is fully deterministic, numerically stable, and validated through property-based tests across the full range $N \in [45, 120]$.
- Every test generated sums precisely to $N$ without integer rounding drift.
- All deviations from the paper are mathematically justified and defensible for the academic project defense.
