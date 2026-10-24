# 2. Technology stack and execution model

Date: 2026-10-22

## Status

Accepted

## Context

The system trains radiology residents on chest X-rays across three classes (`covid19`, `pneumonia`, `normal`). Both operators (A and B) are frontend React/JavaScript developers with limited ML/backend experience. Each student is evaluated separately and must be capable of defending and explaining every line of code. The execution environment consists of two individual Windows machines without virtualization or Docker support. Furthermore, internet access to external APIs like Gemini may be subject to network constraints/VPN requirements in Iran.

## Decision

We select the following core stack and execution constraints:
1. **Language:** JavaScript only (ECMAScript modules), without TypeScript. Types are documented using JSDoc `@typedef` annotations in `@radiology/contracts`, and runtime validation is performed at all system boundaries using Zod 4. This avoids TypeScript compilation overhead while ensuring full code readability and defensibility for both developers.
2. **Architecture:** Modular monorepo with npm workspaces (`apps/api`, `apps/web`, `packages/contracts`, `packages/engine`, `ml/`).
3. **Database:** MongoDB Community Server 8.x installed directly as a local Windows service (connected via `127.0.0.1:27017`), with no Docker dependency.
4. **Offline ML Difficulty Pipeline:** Model training and difficulty scoring run offline using Python 3.12, PyTorch, and `uv`, producing a static artifact (`ml/artifacts/difficulty.json`). The web and API runtimes have zero Python runtime dependencies.
5. **LLM Strategy & Demo Reliability:** Gemini (`@google/genai`, model `gemini-3.8-flash`) is used for image analysis, feedback, and question generation with instructor review. To ensure reliable live demos regardless of VPN status, questions and explanations are pre-generated, reviewed, and cached into `apps/api/seed/question-bank.approved.json`, with a fake provider mode (`LLM_MODE=fake`) available for deterministic offline tests.

## Consequences

- Low development overhead with zero container management.
- Complete clarity and defensibility of all committed code.
- Deterministic offline demonstrations and reliable CI execution without cloud API dependency.
