# T02 — Adaptive engine and simulator (test-driven)

Developer: Mahdi · Branch: `feat/T02-adaptive-engine` · Skills: `adaptive-engine`, `review-workflow`, `git-workflow` · Estimate: 7 h · Folders: `packages/engine`, `packages/contracts` (engine shapes only), `docs/adr/`.

## Goal
A pure JavaScript library implementing question allocation and selection exactly as in the `adaptive-engine` skill, plus a seeded virtual-resident simulator that compares `fixed`, `random` and `adaptive` policies. No Express, no database, no files.

## Prerequisites
T00 merged. Read the skill completely and `docs/DOMAIN.md` sections 3-4 and 8. T01 is NOT needed: tests use synthetic image pools.

## Steps (tests first; one commit per bullet; push often)
1. `feat(contracts): add engine shapes and config schema` - Zod schemas + JSDoc typedefs: `ClassId`, `Bucket`, `ImageMeta`, `Response`, `EngineConfig` (+ config validation rules: N >= 45, minimums fit). Contract change: the PR must say so.
2. `test(engine): write specs for largestRemainder, rates, classWeights` then `feat(engine): implement them` (the tests fail first - show the failing run, then the passing run).
3. `test(engine)` + `feat(engine)`: `allocateClassCounts`, `allocateBucketCounts`.
4. `test(engine)` + `feat(engine)`: seeded RNG (`createRng`, mulberry32) and `selectFirstTest`.
5. `test(engine)` + `feat(engine)`: `selectNextTest` with no-repeat rule and shortage substitution recorded in `plan.shortfalls`.
6. `test(engine)` + `feat(engine)`: `selectTargetedQuestions` and `isMastered`.
7. `test(engine)`: property tests with fast-check (install via the dependency protocol) for N in [45..120] - sums, minimums, determinism.
8. `feat(engine): add virtual resident simulator` - skill per class, difficulty penalty, confusion target, learning per exposure; policies `fixed | random | adaptive`; `npm run sim -w @radiology/engine` prints a table (sessions to mastery, final FPR/FNR per class) for 50 seeded residents.
9. `docs(adr): record deviations from the paper` - ADR 0004 (smoothing, normalized allocation, N >= 45, no repeats, thresholds, first-test shares with a note to verify p.112 of the PDF).

## Verification (show real outputs)
`npm test -w @radiology/engine` all green; `npm run lint`; run the simulator twice with the same seed and show identical output; show one hand-computed `rates` example in the test file with comments of the arithmetic.

## Acceptance criteria
- [ ] Every function in the skill's export list exists, has JSDoc, and has tests (>= the 11 test groups in the skill).
- [ ] All allocation invariants hold in property tests; no NaN/Infinity anywhere.
- [ ] The simulator is deterministic per seed and its assumptions are written in `packages/engine/README.md`.
- [ ] No imports of Node I/O, Express, Mongoose or randomness outside `createRng`.
- [ ] PR opened; review checklist completed. Can explain: why we smooth with alpha, how largest-remainder guarantees the sum, what the simulator can and cannot prove.

## Out of scope
HTTP endpoints, database, UI, LLM, the real catalog.
