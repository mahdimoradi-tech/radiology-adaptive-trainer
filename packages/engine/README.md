# @radiology/engine

Pure JavaScript (ES modules) adaptive question allocation and selection engine for chest X-ray resident training, alongside a seeded virtual-resident simulator.

## Architecture

- **No I/O or Side Effects:** Pure functional core without filesystem, database, or network calls.
- **Deterministic:** All randomness is injected via a seeded PRNG (`createRng` - Mulberry32 algorithm).
- **Type-safe:** Enforces data shapes and contracts from `@radiology/contracts`.

## Core Mathematical Algorithms

1. **Error Rates with Laplace Smoothing:**
   $$\text{FNR}_c = \frac{\text{FN}_c + \alpha}{\text{TP}_c + \text{FN}_c + 2\alpha}$$
   $$\text{FPR}_c = \frac{\text{FP}_c + \alpha}{\text{FP}_c + \text{TN}_c + 2\alpha}$$
   $$\text{Error}_c = \text{FPR}_c + \text{FNR}_c$$
   $$\text{Weight}_c = \frac{\text{Error}_c}{\sum \text{Error}}$$

2. **Guaranteed Integer Allocation (Hamilton-Hare / Largest Remainder):**
   - Each disease class receives at least $\lceil \text{minClassShare} \times N \rceil$ (minimum 20%).
   - Remaining units are distributed according to class weights using largest-remainder rounding, guaranteeing an exact sum of $N$.
   - Each difficulty bucket receives at least $\max(1, \text{round}(\text{minBucketShare} \times N))$ (minimum 4%).
   - Remaining units within a class are distributed according to historical bucket error rates $\text{IR}_{c,b}$.

3. **No-Repeat Selection & Graceful Shortage Fallback:**
   - Fresh images are always preferred (`allowRepeats: false`).
   - If an image bucket runs out of fresh images, the engine falls back to the nearest bucket of the same class (medium first), then to other classes ordered by error weight, logging shortages in `plan.shortfalls`.

4. **Targeted Practice:**
   - Evaluates off-diagonal cells of the confusion matrix $(\text{trueClass} \to \text{confusedWith})$.
   - Allocates practice items proportionally from approved question bank items.

5. **Mastery Gate:**
   - Declares mastery when per-class accuracy $\ge \text{threshold}$ (default 80%) across all three classes simultaneously in the latest session.

---

## Virtual Resident Simulator (`src/simulator/`)

The package includes a Monte Carlo virtual trainee simulator to empirically compare training policies (`adaptive`, `random`, `fixed`).

### Trainee Model & Assumptions

1. **Diagnostic Skill:** Each resident has a latent per-class diagnostic skill $S_c \in [0, 1]$.
2. **Probability of Correct Diagnosis:**
   $$P(\text{correct} \mid \text{image } i) = \text{clamp}\Big(S_c - \lambda \cdot d_i + \epsilon, 0.05, 0.98\Big)$$
   where $d_i \in [0, 1]$ is continuous image difficulty, $\lambda$ is difficulty penalty ($\approx 0.25$), and $\epsilon \sim \text{Uniform}(-\sigma, \sigma)$ is decision noise ($\sigma = 0.08$).
3. **Diagnostic Errors:** When an error occurs, the resident misclassifies the image into the most confusable class (`confusedWith`).
4. **Learning Dynamics:** Exposure to questions updates diagnostic skill asymptotically:
   $$S_c \leftarrow S_c + \eta \cdot (1 - S_c)$$
   where $\eta$ is the learning rate ($\approx 0.03$).
5. **Limitations:** The simulation models skill growth as an asymptotic exposure function. Real human diagnostic retention exhibits forgetting curves and visual cognitive plateaus that are not modeled here. Simulation results serve to verify that the adaptive allocation algorithm converges without bias under controlled assumptions.

### Running the Simulator

```bash
npm run sim -w @radiology/engine
```
