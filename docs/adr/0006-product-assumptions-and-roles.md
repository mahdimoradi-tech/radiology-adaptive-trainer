# ADR 0006 — Product assumptions, roles and review process

Status: accepted (2026-10-27, Mahdi Moradi) · Revisit after the professor meeting.

## Context
The professor has not stated precise expectations. The developer decided to proceed on explicit assumptions and to record them, so that any later correction is cheap.

## Decisions
1. **Goal:** a usable web product that reproduces the paper's adaptive training loop and adds LLM features (image analysis, question generation, feedback). The paper itself is the scientific reference; where we deviate we write an ADR (0004, 0005, ...).
2. **Roles (exactly two):** `resident` (takes tests, sees reports/progress) and `instructor` (reviews LLM-generated questions and knowledge-base drafts, sees all residents' progress and catalog statistics). Registration always creates `resident`. Instructor accounts are created only by a local script (`create-instructor`). There is no separate "admin" role.
3. **Who is an instructor:** The developer (Mahdi), plus optionally a medical student who can check scientific correctness. Nothing LLM-generated is shown to residents before an instructor approves it (`pending_review` -> `approved`).
4. **Knowledge base (KB):** every KB file starts with `reviewed: false` and the UI shows a "draft content" badge until a clinician/medical student sets `reviewed: true`.
5. **Educational use only:** the product never claims to diagnose; every LLM-written text shows the educational disclaimer.
6. **Data honesty:** the catalog is built from public datasets whose classes are confounded with their sources (all COVID-19 images come from two adult-patient sources; pneumonia and normal come mostly from a pediatric source). The out-of-fold "difficulty" therefore partly measures source differences, not only pathology. This limitation is stated in the ML report, the thesis and the demo, and is checked in T10 (per-source accuracy, LLM image-analysis agreement).
7. **No label leakage to residents:** residents receive only opaque public image ids and image bytes while a test is running. Internal ids, sources, true classes, buckets and difficulty are revealed only after a question is finished/reviewed.
8. **Demo independence:** LLM content is pre-generated and cached; `LLM_MODE=cache-only` runs the demo without internet/VPN.
9. **Scope control:** Must/Should/Could as in `docs/ROADMAP.md`. If time runs out the cut order is: Could -> pilot -> English UI -> study-plan text.

## Consequences
- Changes in the professor's expectations are handled as new ADRs, not silent edits.
- Reviewer availability (instructor accounts) is a schedule risk for T08; plan the review sessions early.
