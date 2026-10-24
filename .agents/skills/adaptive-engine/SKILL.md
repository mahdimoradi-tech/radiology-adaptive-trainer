---
name: adaptive-engine
description: Exact specification, formulas, edge cases, targeted-practice selection and test list for the adaptive question-selection engine and virtual-resident simulator in packages/engine (plain JavaScript, ES modules). Use this skill whenever you touch packages/engine, compute FPR/FNR/error/weights, allocate question counts per class or difficulty bucket, select questions, select targeted practice questions from the question bank, write the simulator, or when anyone mentions adaptive test, error pattern, weights, confusion pair, or question selection.
---

# Adaptive engine spec (packages/engine, JavaScript ESM)

Pure functions. No Express, no Mongo, no `fs`, no `Date.now()`/`Math.random()` in logic (inject a seeded RNG). Deterministic given inputs + `seed`. Export types as JSDoc `@typedef` from `packages/contracts` (do not redefine them). Validate config with Zod (`EngineConfigSchema` in contracts).

## Shapes (defined in packages/contracts; shown here for reference)
- `ClassId`: 'covid19' | 'pneumonia' | 'normal'; `Bucket`: 'easy' | 'medium' | 'hard'.
- `ImageMeta`: `{ id, trueClass, difficulty /*0..1*/, bucket, confusedWith /*ClassId, most likely wrong class from OOF probs*/ }`.
- `Response`: `{ sessionId, imageId, trueClass, answer, bucket }`.
- `EngineConfig`: `totalQuestions` (default 60, must be >= 45), `minClassShare` 0.20, `minBucketShare` 0.04, `firstTestBucketShares` {easy .40, medium .30, hard .30} (verify against paper p.112; keep configurable), `alpha` 1, `allowRepeats` false, `difficultyThresholds` {easyMax .34, mediumMax .68}, `masteryThreshold` 0.80, `seed`.
Config check: reject if `3*ceil(minClassShare*N) > N` or `3*minBucketCount > minClassCount`.

## Formulas (one-vs-rest per class c over ALL previous responses of the user)
- TP: true=c & answer=c; FN: true=c & answer≠c; FP: true≠c & answer=c; TN: true≠c & answer≠c.
- `FNR_c = (FN+alpha)/(TP+FN+2*alpha)`, `FPR_c = (FP+alpha)/(FP+TN+2*alpha)` (Laplace smoothing; never NaN).
- `Error_c = FPR_c + FNR_c`; `Weight_c = Error_c / ΣError` (uniform 1/3 if ΣError is 0).
- `IR_{c,b} = (Incorrect_{c,b}+alpha)/(Total_{c,b}+2*alpha)`.

## Allocation (paper deviation, document in an ADR)
1. `minClass = ceil(minClassShare*N)`; `R = N - 3*minClass`; `N_c = minClass + largestRemainder(R, W)`; sum is exactly N.
2. Per class: `minBucket = max(1, round(minBucketShare*N))`; `N_{c,b} = minBucket + largestRemainder(N_c - 3*minBucket, IR_{c,*} normalized)` (uniform if all equal).
3. `largestRemainder(total, weights)`: exact_i = total*w_i, floor, give leftover units to the largest fractional parts, ties by lowest index; integers summing to `total`.
First test (no history): classes equal via largestRemainder; buckets by `firstTestBucketShares`.

## Selection
- Pool for (c,b): images of class c in bucket b not yet shown to the user (unless `allowRepeats`). Pick with seeded RNG (mulberry32); shuffle the final list with the same RNG.
- Shortage: fill from the nearest bucket of the same class (medium first), then other classes by weight; record in `plan.shortfalls`.
- Return `{ imageIds, plan: { classCounts, bucketCounts, weights, errors, shortfalls } }` (the UI and the LLM report explain WHY with this plan).

## Targeted practice (question bank)
`selectTargetedQuestions(bank, history, config, n)`: bank items are `{ id, imageId, type, pair: { trueClass, confusedWith }, bucket, status }`; only `status === 'approved'` and not yet answered by this user.
1. Confusion pairs from the user's confusion matrix off-diagonals: `count[true][answer]` for true≠answer; pair weight = `(count+alpha)` normalized.
2. `n_pair = largestRemainder(n, pairWeights)`; pick items whose `pair` matches (seeded); if short, use items whose `pair.trueClass` matches, then any approved item; record `shortfalls`.
3. Return `{ questionIds, plan: { pairs, counts, shortfalls } }`.

## Mastery
`isMastered(latestSessionResponses, threshold)`: per-class accuracy (correct/total of that class in the latest session) >= threshold for ALL three classes (classes with 0 questions -> not mastered).

## Exports (names fixed)
`bucketOf`, `confusionMatrix`, `perClassCounts`, `rates`, `classWeights`, `largestRemainder`, `allocateClassCounts`, `allocateBucketCounts`, `selectFirstTest`, `selectNextTest`, `selectTargetedQuestions`, `isMastered`, `createRng`, and `simulator/`.

## Simulator (`src/simulator/`)
Virtual resident: skill per class in [0,1]; P(correct)=clamp(skill_c - penalty*d + noise); wrong answers go to a configured confusable class; after each exposure `skill_c += learnRate*(1-skill_c)`; optional forgetting. Policies: `fixed`, `random`, `adaptive`. Output per policy: sessions to mastery, final FPR/FNR per class, accuracy curve. Seeded, reproducible; document assumptions (simulation validity is a limitation).

## Tests (write FIRST, `src/__tests__/*.test.js`, Vitest)
1 largestRemainder (sum, ties, zero weights, total 0) · 2 rates (hand-computed example, alpha, never NaN) · 3 classWeights (sum 1, uniform on equal, monotonic) · 4 allocateClassCounts (sum N, mins, extreme weights) · 5 allocateBucketCounts (sum N_c, mins) · 6 selectFirstTest (counts, determinism per seed) · 7 selectNextTest (no repeats, counts, shortage recorded, empty history) · 8 selectTargetedQuestions (pair matching, shortage, approved-only, no repeats) · 9 isMastered boundaries · 10 property tests with fast-check (verify via dependency protocol) for N in [45..120] · 11 simulator determinism; report (do not hard-assert) that adaptive reaches mastery no later than random.
