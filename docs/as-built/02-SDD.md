# Software Design Description (SDD) — As-Built Architecture

> [!IMPORTANT]
> **Document Status: As-Built (Retrospective)**  
> **System Baseline Commit:** `9357ace` (Date: 2026-11-13)  
> **Standard Alignment:** IEEE 1016-2009 (*Standard for Information Technology — Systems Design — Software Design Descriptions*, tailored lite).  
> 
> This document is an evidence-backed Software Design Description for the **Radiology Adaptive Training Platform**. It specifies the actual software architecture, monorepo decomposition, database models, REST APIs, adaptive mathematical algorithms, security controls, LLM integration, offline ML pipeline, and frontend design as implemented across tasks T00 through T15. All structural diagrams, algorithms, configuration keys, and schemas reflect existing, verified source code.

---

## 1. Introduction and Design Goals

### 1.1 Purpose and System Scope
The Radiology Adaptive Training Platform is a web-based educational simulation system engineered to train radiology residents in diagnosing frontal chest radiographs across three disease classifications: COVID-19 (`covid19`), non-COVID pneumonia (`pneumonia`), and normal lungs (`normal`).

The system dynamically models resident diagnostic error patterns—specifically individual False Positive Rates ($FPR$) and False Negative Rates ($FNR$) per pathology class—to iteratively calibrate the diagnostic composition and difficulty distribution of subsequent training sessions (`packages/engine/src/rates.js:1-125`).

This design document covers the complete software architecture, linking directly to the requirements defined in the [Software Requirements Specification (SRS)](01-SRS.md):
- **Functional Requirements:** `FR-AUTH-01..05`, `FR-TEST-01..07`, `FR-ADAPT-01..08`, `FR-REP-01..08`, `FR-PRAC-01..07`, `FR-PROG-01..06`, `FR-EDU-01..04`, `FR-INS-01..08`, `FR-LLM-01..08`, `FR-DATA-01..04`.
- **Non-Functional Requirements:** `NFR-SEC-01..05`, `NFR-PRIV-01..04`, `NFR-USAB-01..05`, `NFR-PORT-01..03`, `NFR-REL-01..03`, `NFR-MAINT-01..03`, `NFR-PERF-01..03`.

### 1.2 Five Core Architectural Quality Attributes

| # | Quality Attribute | Target Metric / Standard | Architectural Realization and Code Location |
|---|---|---|---|
| **QA-1** | **Label-Leak Safety** | Zero transmission of ground truth, difficulty, or source datasets to trainee browser prior to session completion (`NFR-PRIV-01..04`). | Enforced by strict Zod schema projection at the API boundary (`SessionPublicSchema`, `PracticeQuestionResident`), opaque HMAC-SHA256 image public IDs (`catalog/service.js:1-45`), deep response sanitization, and automated recursive security scanners (`apps/api/src/__tests__/global-leak.test.js`, `apps/web/src/pages/resident/__tests__/QuizLeak.test.jsx`). |
| **QA-2** | **Offline Demo & Independence** | 100% functionality without internet connection or external cloud API access during demonstration (`NFR-REL-01`, `NFR-PORT-02`). | Architected with `LLM_MODE=cache-only`, local MongoDB Community Server 8 instance, portable JSON seeds (`apps/api/seed/llm-cache.portable.json`, `question-bank.approved.json`, `image-analyses.json`), and static image serving (`data/catalog/images`). Fresh clone setup reproducible in <25 seconds without network calls (`apps/api/scripts/demo-seed.js`). |
| **QA-3** | **RTL Persian Educational UI** | Native Right-to-Left layout, Vazirmatn typography, Jalali dates, WCAG AA accessibility, zero image inversion (`NFR-USAB-01..05`). | Implemented using Tailwind CSS 4 logical layout utilities (`ms-*`, `pe-*`, `text-start`), dynamic `<html lang dir>` injection, isolated `dir="ltr"` container on `XrayImage.jsx` prohibiting anatomical image mirroring, Jalali date formatting via `Intl.DateTimeFormat('fa-IR-u-ca-persian')`, and automated contrast linters (`scripts/check-rtl-classes.js`, `scripts/check-low-contrast.js`). |
| **QA-4** | **Testable Pure Engine** | Zero I/O, 100% deterministic mathematical execution, zero floating-point allocation drift (`NFR-MAINT-01..03`). | The `@radiology/engine` package contains strictly no network, database, filesystem, or DOM dependencies. All allocations utilize largest-remainder integer math. Randomized components accept seeded PRNG generators (`seedrandom`). Validated by 100% branch test coverage and property-based invariant testing (`fast-check`). |
| **QA-5** | **Reproducible ML Pipeline** | Deterministic feature extraction, out-of-fold scoring, and stratified image catalog curation (`NFR-REL-02`, `FR-DATA-01..04`). | Python 3.12 + `uv` offline pipeline (`ml/`) running on CPU with fixed seeds (`seed=42`). Pre-trained DenseNet-121 feature cache, 5-fold cross-validation, difficulty score computation $d = 1 - p(\text{true})$, and export to versioned artifacts (`ml/artifacts/difficulty.json`, `catalog.json`). |

---

## 2. Architecture Overview

### 2.1 Monorepo Structure
The repository is structured as an npm workspaces monorepo managed under Node.js 24 LTS, complemented by an isolated Python virtual environment for offline ML processing.

```
radiology-adaptive-trainer/
├── apps/
│   ├── api/                   # Express 5 REST API + Mongoose 9 persistence
│   └── web/                   # React 19 SPA + Vite 8 + Tailwind CSS 4 RTL
├── packages/
│   ├── contracts/             # Shared Zod 4 schemas and domain constants
│   └── engine/                # Pure mathematical adaptive engine and simulator
├── ml/                        # Offline Python 3.12 + PyTorch ML pipeline
├── data/                      # Web-optimized radiograph image assets
├── docs/                      # Architectural specifications, ADRs, QA logs, as-built docs
└── scripts/                   # Evaluation scripts, verification linters, git hooks
```

### 2.2 Monorepo Package Matrix

| Workspace / Directory | Architectural Purpose | Primary Runtime Dependencies | Monorepo Dependencies |
|---|---|---|---|
| `packages/contracts` | Canonical contract leaf package. Exposes runtime Zod schemas, domain enums, error codes, and JSDoc typedefs. | `zod (^4.6.7)` | *None (Leaf package)* |
| `packages/engine` | Pure mathematical adaptive algorithm, question selector, resident simulator, and statistical helpers. Zero I/O. | *None* (dev: `fast-check ^4.10.2`) | `@radiology/contracts` |
| `apps/api` | Backend HTTP REST server, JWT cookie auth, session lifecycle, catalog streaming, Mongoose models, and LLM orchestration. | `express (^5.3.0)`, `mongoose (^9.11.4)`, `jsonwebtoken (^9.0.3)`, `bcryptjs (^3.0.3)`, `helmet (^8.3.0)`, `cookie-parser (^1.4.7)`, `express-rate-limit (^8.7.2)`, `@google/genai (^2.32.0)`, `pino (^10.4.0)` | `@radiology/contracts`, `@radiology/engine` |
| `apps/web` | Frontend Single Page Application. Dual resident and instructor portals, responsive Persian RTL UI, interactive quiz, and charts. | `react (19.3.1)`, `react-dom (19.3.1)`, `react-router (^7.18.5)`, `@tanstack/react-query (^5.105.1)`, `tailwindcss (^4.3.3)`, `i18next (^26.6.0)`, `@fontsource-variable/vazirmatn (^5.3.0)` | `@radiology/contracts` *(HTTP client to `apps/api`)* |
| `ml/` | Standalone offline Python pipeline for feature extraction, 5-fold cross-validation, and difficulty scoring. | `torch (2.14.1+cpu)`, `torchvision (0.29.1+cpu)`, `numpy (2.5.4)`, `pandas (3.1.0)`, `scikit-learn (1.9.1)`, `pillow (13.0.0)` | *None (Outputs file artifacts ingested by `apps/api`)* |

### 2.3 Component and Tier Diagram

```mermaid
flowchart TD
    subgraph ClientTier ["Client Tier (Browser)"]
        UI["apps/web (React 19 + TanStack Query 5)"]
    end

    subgraph ServiceTier ["Service Tier (Node.js 24)"]
        API["apps/api (Express 5 REST Service)"]
        ENG["packages/engine (Adaptive Engine & Simulator)"]
        CTR["packages/contracts (Zod Schemas & Domain Enums)"]
    end

    subgraph PersistenceTier ["Persistence Tier (Local Workstation)"]
        MDB[("MongoDB 8.3 Community Service\n(mongodb://127.0.0.1:27017)")]
        IMG[("Local Radiograph Storage\n(data/catalog/images/*.png)")]
        SEED[("Portable Seeds & Artifacts\n(apps/api/seed/*.json)")]
    end

    subgraph ExternalServices ["External Services (Optional / Offline Guarded)"]
        GEMINI["Google Gemini API (@google/genai)\n[Interactions API - live mode only]"]
    end

    subgraph MLTier ["Offline ML Tier (Python 3.12)"]
        MLP["ml/ Pipeline (DenseNet-121 + PyTorch)"]
        ART["ml/artifacts/ (catalog.json, difficulty.json)"]
    end

    UI -- "HTTP JSON / Cookies (/api/*)" --> API
    API -- "Imports Contracts" --> CTR
    API -- "Executes Engine" --> ENG
    ENG -- "Imports Schemas & Enums" --> CTR
    UI -- "Imports Contracts & Schemas" --> CTR

    API -- "Mongoose ODM" --> MDB
    API -- "Streams Radiographs via HMAC token" --> IMG
    API -- "Seeds DB from portable JSON" --> SEED
    API -. "Live Analysis/Feedback (Guarded)" .-> GEMINI

    MLP -- "Generates ML Artifacts" --> ART
    ART -- "Ingested by API Seed" --> API
```

### 2.4 Monorepo Dependency Rule Verification
The architecture strictly enforces unidirectional coupling:
- `packages/contracts` is the root contract leaf and depends on no internal workspace.
- `packages/engine` depends strictly on `packages/contracts` and has no network, filesystem, or database imports.
- `apps/api` depends on `packages/contracts` and `packages/engine`.
- `apps/web` depends on `packages/contracts` and interacts with `apps/api` strictly through HTTP REST.

Execution of the dependency check command confirms zero unauthorized cross-package imports:
```powershell
git grep -n "from '@radiology" packages
```
**Empirical Output:**
```
packages/engine/src/__tests__/targeted-and-mastery.test.js:2:import { MASTERY_THRESHOLD } from '@radiology/contracts';
packages/engine/src/allocation.js:1:import { CLASS_IDS, BUCKETS } from '@radiology/contracts';
packages/engine/src/index.js:1:import { CONTRACTS_VERSION } from '@radiology/contracts';
packages/engine/src/rates.js:1:import { CLASS_IDS, BUCKETS } from '@radiology/contracts';
packages/engine/src/selection.js:1:import { CLASS_IDS, BUCKETS, EngineConfigSchema } from '@radiology/contracts';
packages/engine/src/simulator/runner.js:1:import { CLASS_IDS, BUCKETS } from '@radiology/contracts';
packages/engine/src/targeted.js:1:import { CLASS_IDS, MASTERY_THRESHOLD } from '@radiology/contracts';
```
No package imports from `apps/api` or `apps/web`.

---

## 3. Technology Stack

Every component and library version in the table below is verified against the repository's `package.json` files and `ml/uv.lock` lockfile.

### 3.1 Core Runtimes and Frameworks

| Layer / Role | Technology | Version | Location / Source | Purpose |
|---|---|---|---|---|
| **Runtime Environment** | Node.js | `>=24.0.0` (LTS v24.11.0) | `package.json:engines` | Cross-platform JavaScript runtime running on Windows 11. |
| **Package Manager** | npm | `11.21.1` | Local environment | npm workspaces managing monorepo packages. |
| **Language Standards** | ECMAScript 2024 | ES Modules (`"type": "module"`) | All `package.json` | Modern JavaScript with native ES module imports across all packages. |
| **Backend Framework** | Express | `^5.3.0` | `apps/api/package.json` | REST API framework with native async route handling and promise rejection catchers. |
| **Database & ODM** | MongoDB / Mongoose | MongoDB `8.3.0` / Mongoose `^9.11.4` | `apps/api/package.json` | Document database running as Windows service; Mongoose schemas, types, and indexes. |
| **Schema Validation** | Zod | `^4.6.7` | `packages/contracts/package.json` | Universal runtime validation schema defining API contracts and domain shapes. |
| **Frontend Framework** | React / React DOM | `19.3.1` | `apps/web/package.json` | Component-based UI library utilizing modern React 19 architecture. |
| **Frontend Build Tool** | Vite | `^8.3.5` | `apps/web/package.json` | Next-generation frontend bundler with Hot Module Replacement (HMR). |
| **Client Routing** | React Router | `^7.18.5` | `apps/web/package.json` | Declarative client-side routing with role-based navigation guards. |
| **Server State & Cache** | TanStack React Query | `^5.105.1` | `apps/web/package.json` | Asynchronous data fetching, optimistic UI caching, and request deduplication. |
| **Styling & Design** | Tailwind CSS | `^4.3.3` | `apps/web/package.json` | Utility-first CSS engine with `@tailwindcss/vite` plugin and logical RTL utilities. |
| **Typography** | Vazirmatn | `^5.3.0` | `apps/web/package.json` | Variable Persian font package (`@fontsource-variable/vazirmatn`). |
| **Internationalization** | i18next / react-i18next | `^26.6.0` / `^17.1.10` | `apps/web/package.json` | Client-side localization with 100% key parity across Persian (`fa`) and English (`en`). |
| **AI / Multimodal SDK** | `@google/genai` | `^2.32.0` | `apps/api/package.json` | Official Google GenAI SDK for Gemini Interactions API. |
| **Offline ML Pipeline** | Python / uv | Python `>=3.12,<3.13` (3.12.0) | `ml/pyproject.toml` | Python virtual environment managed via `uv` packaging tool. |
| **Deep Learning Framework** | PyTorch / torchvision | `2.14.1+cpu` / `0.29.1+cpu` | `ml/uv.lock` | CPU-optimized PyTorch and Torchvision pre-trained DenseNet-121 model. |
| **ML Data Science Stack** | scikit-learn / NumPy / pandas | `1.9.1` / `2.5.4` / `3.1.0` | `ml/uv.lock` | Out-of-fold cross-validation, feature manipulation, and metrics. |
| **Image Processing (Python)**| Pillow | `13.0.0` | `ml/uv.lock` | Resizing, normalization, and aspect-ratio preservation of chest X-rays. |

### 3.2 Testing, Security, and Code Quality Tooling

| Category | Tool | Version | Configuration / Scope |
|---|---|---|---|
| **Unit & Integration Test** | Vitest | `^4.1.12` | Monorepo test runner (`vitest.config.js`). Covers contracts, engine, API, and web. |
| **Property-Based Testing** | fast-check | `^4.10.2` | Invariant testing for engine rate math and allocation boundaries. |
| **HTTP API Testing** | supertest | `^7.3.1` | Integration test harness for Express routes and middleware. |
| **DOM Testing** | JSDOM / Testing Library | `^26.1.0` / `^16.3.3` | Browser environment simulation for React component assertions. |
| **Authentication & Tokens**| jsonwebtoken / bcryptjs | `^9.0.3` / `^3.0.3` | HS256 JWT cookie signing and salted password hashing (work factor 12). |
| **HTTP Security Headers** | helmet / cookie-parser | `^8.3.0` / `^1.4.7` | Content Security Policy, strict headers, and cookie parsing. |
| **API Rate Limiting** | express-rate-limit | `^8.7.2` | Global, authentication, and LLM endpoint brute-force and quota protection. |
| **Structured Logging** | pino / pino-http | `^10.4.0` / `^11.0.0` | High-performance JSON logging with diagnostic privacy sanitization. |
| **Linters & Formatters** | ESLint / Prettier | `^10.13.0` / `^3.9.10` | Static analysis, code formatting, and automated RTL class checks. |
| **Git Hooks & Commits** | Husky / Commitlint | `^9.1.7` / `^21.2.4` | Pre-commit linting (`lint-staged 17.6.0`) and Conventional Commit enforcement. |
| **Python Testing & Lint** | pytest / ruff | `>=8.3.0` / `>=0.6.0` | Test runner and fast linter for `ml/` codebase. |

---

## 4. Data Design

### 4.1 Entity-Relationship Overview
The data persistence tier is implemented using MongoDB Community Server 8.3 and Mongoose 9.11. The schema encompasses twelve specialized collections governing authentication, image catalog assets, adaptive session lifecycle, error response histories, targeted practice, LLM quota management, offline multimodal VLM analyses, and instructor question review.

```mermaid
erDiagram
    USER ||--o{ SESSION : "initiates"
    USER ||--o{ RESPONSE : "submits"
    USER ||--o{ PRACTICE_SET : "undertakes"
    SESSION ||--o{ RESPONSE : "contains"
    SESSION }o--o{ IMAGE : "references (publicId)"
    PRACTICE_SET }o--o{ QUESTION_BANK : "includes (questionIds)"
    IMAGE ||--o{ IMAGE_ANALYSIS : "subject of"
    ANALYSIS_BATCH ||--o{ IMAGE_ANALYSIS : "executes"
    IMAGE ||--o| ANALYSIS_VALIDATION : "evaluated by"
    IMAGE ||--o{ QUESTION_BANK : "grounds"
    IMAGE ||--o{ QUESTION_GEN_ATTEMPT : "attempted on"

    USER {
        ObjectId _id PK
        string email UK
        string passwordHash
        string displayName
        string role
        string language
    }

    IMAGE {
        string _id PK
        string publicId UK
        string filename
        string trueClass
        string source
        float difficulty
        string bucket
        string confusedWith
    }

    SESSION {
        ObjectId _id PK
        ObjectId userId FK
        int index
        string kind
        string status
        int size
        date startedAt
        date finishedAt
    }

    RESPONSE {
        ObjectId _id PK
        ObjectId sessionId FK
        ObjectId userId FK
        int questionNo
        string imageId
        string trueClass
        string answer
        bool correct
        int timeMs
    }

    PRACTICE_SET {
        ObjectId _id PK
        ObjectId userId FK
        string status
        int size
        date completedAt
    }

    QUESTION_BANK {
        ObjectId _id PK
        string stableId UK
        string imageId FK
        string type
        string status
        int correctIndex
        bool edited
    }

    ANALYSIS_BATCH {
        string _id PK
        string batchId UK
        int group
        string run
        string status
        int attempts
    }

    IMAGE_ANALYSIS {
        ObjectId _id PK
        string imageId FK
        string run
        string promptVersion
        string batchId FK
    }

    ANALYSIS_VALIDATION {
        ObjectId _id PK
        string imageId FK
        string promptVersion
        string status
        string datasetLabel
    }

    QUESTION_GEN_ATTEMPT {
        ObjectId _id PK
        string imageId FK
        string promptVersion
        string type
    }

    LLM_USAGE {
        ObjectId _id PK
        string day UK
        int count
        date lastCallAt
        bool exhausted
    }

    LLM_CACHE {
        ObjectId _id PK
        string key UK
        string promptId
        string version
        string lang
        bool portable
    }
```

### 4.2 Collection Specifications

#### 4.2.1 `users` Collection (`UserModel`, `apps/api/src/modules/auth/model.js:3-42`)
- **Purpose:** Stores accounts and credentials for resident trainees and instructors.
- **Key Fields:**
  - `_id`: MongoDB ObjectId primary key.
  - `email`: String, required, unique, lowercase, trimmed, maximum 254 characters.
  - `passwordHash`: String, required. Salted bcrypt hash with work factor 12.
  - `displayName`: String, required, 2 to 60 characters.
  - `role`: String enum (`'resident' | 'instructor'`), default `'resident'`.
  - `language`: String enum (`'fa' | 'en'`), default `'fa'`.
  - `createdAt`, `updatedAt`: Timestamps automatically managed by Mongoose.
- **Indexes:**
  - `{ email: 1 }` (unique).
- **Relationships:** Referenced as foreign key by `sessions.userId`, `responses.userId`, and `practice_sets.userId`.

#### 4.2.2 `images` Collection (`ImageModel`, `apps/api/src/modules/catalog/model.js:3-52`)
- **Purpose:** Primary metadata catalog for the 1,177 web-optimized frontal chest radiographs.
- **Key Fields:**
  - `_id`: String primary key representing the deterministic catalog identifier (e.g. `kermany_f9ddce356c7b`).
  - `publicId`: String, required, unique. Opaque HMAC-SHA256 token used in client-facing APIs.
  - `filename`: String, required. Web-optimized PNG filename under `data/catalog/images/`.
  - `trueClass`: String enum (`'covid19' | 'pneumonia' | 'normal'`), ground truth diagnosis.
  - `source`: String, dataset provenance (`'cohen' | 'figure1' | 'kermany'`).
  - `difficulty`: Number in $[0.0, 1.0]$, computed as $d = 1 - p(\text{trueClass})$.
  - `bucket`: String enum (`'easy' | 'medium' | 'hard'`).
  - `confusedWith`: String enum (`'covid19' | 'pneumonia' | 'normal'`), primary out-of-fold confusion candidate.
- **Indexes:**
  - `{ publicId: 1 }` (unique, index for HMAC radiograph file streaming).
  - `{ trueClass: 1, bucket: 1 }` (compound index for fast stratified sampling).
- **Relationships:** Referenced by `sessions.questions.imageId`, `responses.imageId`, `image_analyses.imageId`, `analysis_validations.imageId`, and `question_bank.imageId`.

#### 4.2.3 `sessions` Collection (`SessionModel`, `apps/api/src/modules/sessions/model.js:42-108`)
- **Purpose:** Manages the full lifecycle, question ordering, and evaluation metrics for diagnostic tests.
- **Key Fields:**
  - `_id`: MongoDB ObjectId primary key.
  - `userId`: ObjectId referencing `users._id`.
  - `index`: Integer $\ge 1$, sequential session counter for the resident.
  - `kind`: String enum (`'baseline' | 'adaptive'`).
  - `status`: String enum (`'in_progress' | 'finished'`), default `'in_progress'`.
  - `size`: Integer $\ge 45$, total questions (default 60).
  - `configSnapshot`: Mixed document storing algorithm parameters used during generation.
  - `plan`: Mixed document recording planned class and bucket quotas.
  - `questions`: Array of embedded question subdocuments (`no`, `imageId`, `publicId`, `trueClass`, `bucket`, `difficulty`, `confusedWith`).
  - `startedAt`: Date, default `Date.now`.
  - `finishedAt`: Date, default `null`. Set upon finalization.
  - `metrics`: Mixed document containing finalized session evaluation metrics ($FPR$, $FNR$, precision, recall, confusion matrix).
- **Indexes:**
  - `{ userId: 1, index: 1 }` (unique, enforces strict session sequencing).
  - `{ userId: 1, status: 1 }` (unique partial index where `status: 'in_progress'`, enforces single-active-session rule).
  - `{ userId: 1, 'questions.publicId': 1 }` (verifies resident authorization for image bytes).
- **Relationships:** Belongs to `users`; parents multiple `responses`.

#### 4.2.4 `responses` Collection (`ResponseModel`, `apps/api/src/modules/sessions/model.js:109-172`)
- **Purpose:** Logs atomic question submission events during an active training session.
- **Key Fields:**
  - `_id`: MongoDB ObjectId primary key.
  - `sessionId`: ObjectId referencing `sessions._id`.
  - `userId`: ObjectId referencing `users._id`.
  - `questionNo`: Integer $\ge 1$, question ordinal in the session.
  - `imageId`: String catalog identifier.
  - `trueClass`: String enum (`'covid19' | 'pneumonia' | 'normal'`).
  - `answer`: String enum (`'covid19' | 'pneumonia' | 'normal'`), trainee's diagnosis.
  - `bucket`: String enum (`'easy' | 'medium' | 'hard'`).
  - `correct`: Boolean indicating whether `answer === trueClass`.
  - `answeredAt`: Date, timestamp of submission.
  - `timeMs`: Number, resident response latency in milliseconds.
- **Indexes:**
  - `{ sessionId: 1, questionNo: 1 }` (unique, guarantees idempotent single response per question).
  - `{ userId: 1 }` (aggregates trainee performance trajectories).
  - `{ sessionId: 1 }` (fetches session answer histories).
- **Relationships:** Belongs to `sessions` and `users`.

#### 4.2.5 `practice_sets` Collection (`PracticeSetModel`, `apps/api/src/modules/practice/model.js:44-101`)
- **Purpose:** Represents targeted remediation micro-sessions focused on specific diagnostic confusion pairs.
- **Key Fields:**
  - `_id`: MongoDB ObjectId primary key.
  - `userId`: ObjectId referencing `users._id`.
  - `status`: String enum (`'in_progress' | 'completed'`), default `'in_progress'`.
  - `size`: Integer between 1 and 20 (standard 5 questions).
  - `questionIds`: Array of ObjectIds referencing approved `question_bank` entries.
  - `publicIds`: Array of opaque HMAC tokens for associated radiographs.
  - `optionOrder`: 2D Array of integers recording deterministic option permutations.
  - `plan`: Mixed object recording targeted pair and pedagogical focus.
  - `answers`: Array of embedded subdocuments (`questionId`, `selectedIndex`, `shuffledIndex`, `correct`, `timeMs`, `answeredAt`).
  - `completedAt`: Date, default `null`. Set when all questions are answered.
- **Indexes:**
  - `{ userId: 1, createdAt: -1 }` (paginated resident practice history).
  - `{ userId: 1 }`, `{ status: 1 }`, `{ publicIds: 1 }` (image streaming authorization).
- **Relationships:** Belongs to `users`; references multiple `question_bank` items.

#### 4.2.6 `llm_usage` Collection (`LlmUsage`, `apps/api/src/modules/llm/budget.js:17-46`)
- **Purpose:** Enforces the 16 requests per calendar day external Gemini budget guard via atomic increments.
- **Key Fields:**
  - `_id`: MongoDB ObjectId primary key.
  - `day`: String, unique format `YYYY-MM-DD` in `America/Los_Angeles` timezone.
  - `count`: Integer $\ge 0$, daily request counter.
  - `lastCallAt`: Date, timestamp of the most recent live API request.
  - `exhausted`: Boolean, set to `true` when budget limit is reached or repeated 429s trip the breaker.
- **Indexes:**
  - `{ day: 1 }` (unique).
- **Relationships:** Independent operational collection.

#### 4.2.7 `llm_cache` Collection (`LlmCache`, `apps/api/src/modules/llm/cache.js:35-77`)
- **Purpose:** Stores deterministic prompt inputs and structured outputs for error explanations and report narratives.
- **Key Fields:**
  - `_id`: MongoDB ObjectId primary key.
  - `key`: String, unique SHA-256 hash computed over `${promptId}:${version}:${canonicalJson(input)}`.
  - `promptId`: String, prompt identifier (e.g. `explanation-pair`, `report-narrative`).
  - `version`: String, prompt template version (e.g. `v1`).
  - `lang`: String enum (`'fa' | 'en'`), default `'fa'`.
  - `portable`: Boolean flag indicating seedable entries checked into Git (`llm-cache.portable.json`).
  - `input`: Mixed document, exact normalized prompt input parameters.
  - `response`: Mixed document, cached structured JSON response.
- **Indexes:**
  - `{ key: 1 }` (unique, primary cache lookup key).
  - `{ promptId: 1 }`, `{ portable: 1 }`.
- **Relationships:** Queried by the LLM caching middleware before invoking external providers.

#### 4.2.8 `analysis_batches` Collection (`AnalysisBatchModel`, `apps/api/src/modules/analysis/model.js:7-44`)
- **Purpose:** Tracks planned multimodal Gemini API batch operations (6 images per call, Run A or Run B).
- **Key Fields:**
  - `_id` / `batchId`: String primary key (format `v1-g07-A`).
  - `group`: Integer $\ge 0$, image grouping index.
  - `run`: String enum (`'A' | 'B'`).
  - `imageIds`: Array of 6 string catalog identifiers.
  - `status`: String enum (`'pending' | 'done' | 'failed'`), default `'pending'`.
  - `attempts`: Integer $\ge 0$, execution retry counter.
  - `lastError`: String, error trace of most recent failure.
  - `requestedAt`, `finishedAt`: Execution timestamps.
  - `model`, `promptVersion`: Model identifier and prompt version.
- **Indexes:**
  - `{ batchId: 1 }` (unique).
  - `{ status: 1 }`, `{ group: 1, run: 1 }`.
- **Relationships:** Groups multiple `image_analyses`.

#### 4.2.9 `image_analyses` Collection (`ImageAnalysisModel`, `apps/api/src/modules/analysis/model.js:50-68`)
- **Purpose:** Stores parsed, Zod-validated multimodal finding extractions for an image under a specific run.
- **Key Fields:**
  - `_id`: MongoDB ObjectId primary key.
  - `imageId`: String catalog identifier.
  - `run`: String enum (`'A' | 'B'`).
  - `promptVersion`: String, prompt template version (default `'v1'`).
  - `model`: String, Gemini model name used for inference.
  - `batchId`: String referencing `analysis_batches.batchId`.
  - `output`: Mixed document containing structured findings: `laterality`, `zones`, `patterns`, `distribution`, `predictedClass`, `certainty`, `imageQuality`.
- **Indexes:**
  - `{ imageId: 1, run: 1, promptVersion: 1 }` (unique compound index preventing duplicate analysis runs).
  - `{ batchId: 1 }`.
- **Relationships:** References `images` and `analysis_batches`.

#### 4.2.10 `analysis_validations` Collection (`AnalysisValidationModel`, `apps/api/src/modules/analysis/model.js:74-106`)
- **Purpose:** Records cross-run consistency evaluations and consensus finding intersections ($A \cap B$).
- **Key Fields:**
  - `_id`: MongoDB ObjectId primary key.
  - `imageId`: String catalog identifier.
  - `promptVersion`: String (default `'v1'`).
  - `status`: String enum (`'auto_passed' | 'auto_rejected'`).
  - `reasons`: Array of rejection codes if auto-validation failed (from 9-rule validation engine).
  - `consensus`: Object storing consensus findings: `patterns` (intersection array), `distribution`, `laterality`, `zones`.
  - `datasetLabel`: String enum (`'covid19' | 'pneumonia' | 'normal'`).
  - `validatedAt`: Date, timestamp of evaluation.
- **Indexes:**
  - `{ imageId: 1, promptVersion: 1 }` (unique, exactly one validation per image).
  - `{ status: 1 }`.
- **Relationships:** References `images`.

#### 4.2.11 `question_bank` Collection (`QuestionBankModel`, `apps/api/src/modules/bank/model.js:37-216`)
- **Purpose:** Manages multiple-choice pedagogical questions for instructor triage and resident practice.
- **Key Fields:**
  - `_id`: MongoDB ObjectId primary key.
  - `stableId`: String, unique SHA-1 hash guaranteeing generation idempotency.
  - `imageId`: String catalog identifier.
  - `type`: String enum (`'finding' | 'distribution' | 'differential'`).
  - `pair`: Object defining `{ trueClass, confusedWith }`.
  - `bucket`: String enum (`'easy' | 'medium' | 'hard'`).
  - `stem`: String, Persian question prompt.
  - `options`: Array of exactly 4 subdocuments: `{ text: string, key: string | null }`.
  - `correctIndex`: Integer $0..3$, zero-based index of the correct answer.
  - `rationale`: String, Persian explanation ($\le 300$ characters).
  - `kbRef`: String, reference tag to grounded medical knowledge base file.
  - `tags`: Array of domain strings.
  - `status`: String enum (`'pending_review' | 'approved' | 'rejected'`), default `'pending_review'`.
  - `edited`: Boolean, flag indicating instructor text modification.
  - `source`: Object recording generation provenance (`model`, `promptVersion`, `analysisIds`).
  - `reviewedBy`: String, instructor identifier.
  - `reviewedAt`: Date of approval or rejection.
  - `note`: String, instructor feedback or review note.
  - `history`: Array of audit events (`action`, `by`, `at`, `fromStatus`, `toStatus`, `changes`, `note`).
  - `analysisSummary`: Snapshot of consensus findings and VLM certainty.
- **Indexes:**
  - `{ stableId: 1 }` (unique).
  - `{ imageId: 1 }`.
  - `{ status: 1, type: 1 }` (fast instructor triage filtering).
  - `{ 'pair.trueClass': 1, 'pair.confusedWith': 1 }` (targeted practice selection).
  - `{ createdAt: -1 }`.
- **Relationships:** References `images`; referenced by `practice_sets.questionIds`.

#### 4.2.12 `question_gen_attempts` Collection (`QuestionGenAttemptModel`, `apps/api/src/modules/bank/model.js:220-236`)
- **Purpose:** Logs candidate questions rejected by automated pre-validation rules for evaluation tracking.
- **Key Fields:**
  - `_id`: MongoDB ObjectId primary key.
  - `imageId`: String catalog identifier.
  - `promptVersion`: String.
  - `type`: String question type.
  - `candidate`: Mixed document recording rejected question content.
  - `reasons`: Array of validation failure codes.
  - `createdAt`: Date, timestamp of attempt.
- **Indexes:**
  - `{ imageId: 1, promptVersion: 1 }`.
- **Relationships:** References `images`.

---

## 5. API Design

### 5.1 Endpoint Inventory (31 Routes)
All thirty-one registered routes in `apps/api` are detailed below in full alignment with `docs/qa/ROUTE-INVENTORY.md` and `packages/contracts`.

| # | HTTP Method | Route Path | Access / Role | Request Schema (Body / Query) | Response Schema | Mapped SRS Requirements |
|---|---|---|---|---|---|---|
| **1** | `GET` | `/api/health` | Public | None | `{ status: 'ok', time, uptime, db, contractsVersion }` | `FR-AUTH-05`, `NFR-REL-01` |
| **2** | `POST` | `/api/auth/register` | Public (`authLimiter`) | `RegisterBodySchema` | `AuthResponseSchema` (Sets `rt_session` cookie) | `FR-AUTH-01`, `NFR-SEC-01` |
| **3** | `POST` | `/api/auth/login` | Public (`authLimiter`) | `LoginBodySchema` | `AuthResponseSchema` (Sets `rt_session` cookie) | `FR-AUTH-02`, `NFR-SEC-01` |
| **4** | `POST` | `/api/auth/logout` | Public | None | `{ message: string }` (Clears `rt_session` cookie) | `FR-AUTH-03` |
| **5** | `GET` | `/api/me` | Authenticated (`resident`, `instructor`) | None | `AuthResponseSchema` | `FR-AUTH-04` |
| **6** | `GET` | `/api/images/:publicId/file` | Authenticated + `canViewImage` | Param: `publicId` (HMAC string) | Binary stream (`image/png`) | `FR-TEST-02`, `FR-DATA-02`, `NFR-PRIV-01` |
| **7** | `POST` | `/api/sessions` | `resident` | `CreateSessionBodySchema` (`size?`) | `SessionPublicSchema` | `FR-TEST-01`, `FR-ADAPT-01` |
| **8** | `GET` | `/api/sessions` | `resident` | Query: `PaginationQuerySchema` | `PaginatedSessionsSchema` | `FR-TEST-04` |
| **9** | `GET` | `/api/sessions/:id` | `resident` | Param: `id` (ObjectId) | `SessionPublicSchema` | `FR-TEST-01`, `FR-TEST-02`, `NFR-PRIV-02` |
| **10** | `PUT` | `/api/sessions/:id/questions/:no/answer` | `resident` | `AnswerBodySchema` (`answer`, `timeMs?`) | `AnswerPublicSchema` | `FR-TEST-02` |
| **11** | `POST` | `/api/sessions/:id/finish` | `resident` | Param: `id` (ObjectId) | `SessionReportSchema` | `FR-TEST-03`, `FR-REP-01` |
| **12** | `GET` | `/api/sessions/:id/report` | `resident` | Param: `id` (ObjectId) | `SessionReportSchema` | `FR-REP-01..08` |
| **13** | `GET` | `/api/progress` | `resident` | None | `ProgressSchema` | `FR-PROG-01..06` |
| **14** | `POST` | `/api/sessions/:id/explanations` | `resident` | `ExplanationsBodySchema` (`pairs?`, `lang?`) | `ExplanationsResponseSchema` | `FR-LLM-05` |
| **15** | `POST` | `/api/sessions/:id/report-narrative` | `resident` (`narrativeLimiter`) | `NarrativeBodySchema` (`lang?`, `detail?`) | `NarrativeResponseSchema` | `FR-LLM-06`, `NFR-PERF-03` |
| **16** | `POST` | `/api/practice` | `resident` | `PracticeCreateRequestSchema` (`pair`, `size?`) | `PracticeSetResidentSchema` | `FR-PRAC-01`, `FR-PRAC-02` |
| **17** | `GET` | `/api/practice` | `resident` | Query: `PaginationQuerySchema` | `{ items: PracticeSummarySchema[], total, page, pageSize }` | `FR-PRAC-06` |
| **18** | `GET` | `/api/practice/:id` | `resident` | Param: `id` (ObjectId) | `PracticeSetResidentSchema` | `FR-PRAC-03`, `NFR-PRIV-02` |
| **19** | `PUT` | `/api/practice/:id/questions/:no/answer` | `resident` | `PracticeAnswerRequestSchema` (`selectedIndex`, `timeMs?`) | `PracticeAnswerResponseSchema` | `FR-PRAC-04`, `FR-PRAC-05` |
| **20** | `GET` | `/api/catalog/stats` | `instructor` | None | `CatalogStatsSchema` | `FR-INS-04`, `FR-DATA-03` |
| **21** | `GET` | `/api/catalog/images` | `instructor` | Query: `CatalogImagesQuerySchema` | `CatalogImagesResponseSchema` | `FR-INS-04`, `FR-DATA-04` |
| **22** | `GET` | `/api/admin/users` | `instructor` | Query: `PaginationQuerySchema` | `{ items: AdminResidentSummarySchema[], total, page, pageSize }` | `FR-INS-01` |
| **23** | `GET` | `/api/admin/users/:userId/progress` | `instructor` | Param: `userId` (ObjectId) | `ProgressSchema` | `FR-INS-02` |
| **24** | `GET` | `/api/admin/sessions/:id/report` | `instructor` | Param: `id` (ObjectId) | `SessionReportSchema` | `FR-INS-03` |
| **25** | `GET` | `/api/admin/questions` | `instructor` | Query: `QuestionBankQuerySchema` | `QuestionBankListResponseSchema` | `FR-INS-05` |
| **26** | `GET` | `/api/admin/questions/stats` | `instructor` | None | `QuestionBankStatsSchema` | `FR-INS-05` |
| **27** | `GET` | `/api/admin/questions/:id` | `instructor` | Param: `id` (ObjectId) | `QuestionBankItemSchema` | `FR-INS-06` |
| **28** | `POST` | `/api/admin/questions/:id/approve` | `instructor` | `ApproveQuestionBodySchema` (`note?`) | `QuestionBankItemSchema` | `FR-INS-07` |
| **29** | `POST` | `/api/admin/questions/:id/reject` | `instructor` | `RejectQuestionBodySchema` (`note?`) | `QuestionBankItemSchema` | `FR-INS-07` |
| **30** | `PUT` | `/api/admin/questions/:id` | `instructor` | `EditQuestionBodySchema` (`stem`, `options`, `correctIndex`, `rationale`, `note?`) | `QuestionBankItemSchema` | `FR-INS-08` |
| **31** | `GET` | `/api/admin/llm/status` | `instructor` | None | `AdminLlmStatusSchema` | `FR-LLM-08` |

### 5.2 Error Response Format and Status Codes
The Express 5 centralized error middleware (`apps/api/src/middleware/errorHandler.js:7-50`) ensures all failed HTTP requests emit a standardized, predictable JSON payload compliant with `ApiErrorSchema` (`packages/contracts/src/common.js:32-38`):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation error",
    "details": [
      {
        "code": "invalid_type",
        "expected": "string",
        "received": "undefined",
        "path": ["email"],
        "message": "Required"
      }
    ]
  }
}
```

#### HTTP Status Codes Utilized by the API
- **`200 OK`:** Successful data retrieval or idempotent update.
- **`201 Created`:** Successful entity creation (`POST /api/auth/register`, `POST /api/sessions`, `POST /api/practice`).
- **`204 No Content`:** Preflight CORS `OPTIONS` completion.
- **`400 Bad Request`:**
  - `VALIDATION_ERROR`: Zod schema validation failed on request body, query parameters, or URL route params.
  - `VALIDATION_ERROR`: Malformed JSON in request payload.
- **`401 Unauthorized`:**
  - `UNAUTHENTICATED`: Missing, invalid, expired, or tampered `rt_session` JWT cookie.
  - `INVALID_CREDENTIALS`: Incorrect email or password during login.
- **`403 Forbidden`:**
  - `FORBIDDEN`: Role mismatch (resident attempting instructor routes, or instructor attempting resident training routes).
  - `FORBIDDEN`: Resident attempting to access a radiograph image not present in their active session or practice set.
- **`404 Not Found`:**
  - `NOT_FOUND`: Resource with given ID does not exist, or unhandled endpoint path.
  - `NOT_FOUND`: Malformed Mongoose ObjectId returning 404 CastError (`BUG-001` fix).
  - `QUESTION_NOT_FOUND`: Referenced question number does not exist within the session.
- **`409 Conflict`:**
  - `SESSION_IN_PROGRESS`: Resident already has an active session (`status: 'in_progress'`).
  - `SESSION_NOT_IN_PROGRESS`: Resident submitting answer to an inactive or finished session.
  - `SESSION_NOT_FINISHED`: Requesting report for a session that has not been completed.
  - `SESSION_ALREADY_FINISHED`: Attempting to finalize an already completed session.
  - `EMAIL_TAKEN`: Attempting to register an email address that is already registered.
  - `POOL_EXHAUSTED`: Insufficient eligible radiographs in the catalog to build a non-repeating test.
  - `NO_HISTORY`: Resident has zero completed sessions and cannot generate targeted practice.
  - `PRACTICE_POOL_EXHAUSTED`: All approved question bank items for the confusion pair have already been practiced.
- **`413 Payload Too Large`:** Request body exceeds the 100kb threshold configured on `express.json()`.
- **`415 Unsupported Media Type`:**
  - `UNSUPPORTED_MEDIA_TYPE`: State-changing request (`POST`, `PUT`, `PATCH`) with payload lacks `Content-Type: application/json`.
- **`429 Too Many Requests`:**
  - `RATE_LIMITED`: Endpoint brute-force limit exceeded on authentication, LLM narrative generation, or daily Gemini budget.
- **`500 Internal Server Error`:**
  - `INTERNAL_ERROR`: Unhandled exception. Detailed error stack traces are logged via Pino and suppressed from client responses in production.

### 5.3 Postman API Collection
The complete REST interface is documented, parameterized, and executable via Postman. The collection file is maintained in the repository at [docs/postman/radiology-api.postman_collection.json](../postman/radiology-api.postman_collection.json). It provides pre-configured requests, environment variables (`baseUrl`, `residentEmail`, `instructorEmail`), authentication scripts, and response assertions covering the entire testing lifecycle.

---

## 12. Deployment and Runtime View

### 12.1 Local Workstation Operating Model
In accordance with `ADR 0002`, the entire application runs natively on a single Windows 11 development workstation without containerization (no Docker, no WSL). This design eliminates virtualization overhead and guarantees that academic reviewers can audit and run the software using standard developer tools.

```mermaid
flowchart LR
    subgraph Host ["Windows 11 Workstation (Host OS)"]
        subgraph Services ["Background Services"]
            MService["MongoDB Community Server\n(mongod.exe : 27017)"]
        end

        subgraph DevProcesses ["Application Processes (npm run dev)"]
            NodeAPI["Node.js Process (Port 4000)\napps/api/src/server.js"]
            NodeWeb["Vite Dev Server (Port 5173)\napps/web (HMR + Proxy)"]
        end

        subgraph LocalFS ["Local Filesystem Assets"]
            DataDir["data/catalog/images/*.png"]
            ArtifactsDir["ml/artifacts/"]
            SeedDir["apps/api/seed/"]
        end

        subgraph ClientApp ["Client Browser"]
            Browser["Chrome / Edge Browser\n(http://127.0.0.1:5173)"]
        end
    end

    Browser -- "UI Interactions" --> NodeWeb
    NodeWeb -- "Vite Proxy (/api/*)" --> NodeAPI
    NodeAPI -- "TCP Loopback (127.0.0.1:27017)" --> MService
    NodeAPI -- "Direct Read Stream" --> DataDir
    NodeAPI -- "Seed Initialization" --> SeedDir
    NodeAPI -- "Catalog Metadata" --> ArtifactsDir
```

### 12.2 Runtime Process Topology
1. **Database Service (`mongod.exe`):** Runs as a local Windows service listening on `127.0.0.1:27017`. Database name: `radiology` (production/dev) or dynamic temporary database for Vitest runs.
2. **Backend API Process:** Launched via `node --watch --env-file-if-exists=../../.env src/server.js` from `apps/api`. Binds to `127.0.0.1:4000`. Serves REST endpoints, validates schemas, verifies JWT cookies, and streams image binaries.
3. **Frontend Development Process:** Launched via `vite` from `apps/web`. Binds to `127.0.0.1:5173`. Proxies `/api` requests to `http://127.0.0.1:4000`, enabling seamless same-origin cookie exchange (`SameSite=Lax`) without cross-origin configuration.
4. **Unified Process Orchestrator:** The root command `npm run dev` executes `concurrently` (`^10.0.6`) with color-coded prefix tags to manage both the backend API and frontend Vite servers concurrently.

### 12.3 Filesystem Storage Layout
- `data/catalog/images/`: Holds 1,177 web-optimized PNG chest X-ray images (max dimension 800px width/height, 8-bit grayscale converted to PNG).
- `ml/artifacts/catalog.json`: 1,177 image catalog manifest including true class, difficulty score, difficulty bucket, predicted class, and source dataset.
- `ml/artifacts/difficulty.json`: Comprehensive out-of-fold prediction array across all 6,004 merged training images.
- `apps/api/seed/`:
  - `image-analyses.json`: 69 approved multimodal consensus analyses.
  - `question-bank.approved.json`: 83 instructor-approved pedagogical multiple-choice questions.
  - `llm-cache.portable.json`: 12 pre-generated bilingual feedback entries covering all confusion pairs.
- `apps/api/src/modules/llm/kb/`: 6 markdown files containing clinically grounded domain knowledge (`covid19.md`, `pneumonia.md`, `normal.md`, etc.).

### 12.4 Environment Variables Reference
All environment configuration is strictly validated at application startup using Zod (`apps/api/src/config/env.js:4-86`). In compliance with repository security rules, secret values are never committed; only variable names, data types, defaults, and operational meanings are specified below.

| Variable Name | Type / Allowed Values | Default Value | Validation Constraint / Requirement | Architectural Purpose |
|---|---|---|---|---|
| `NODE_ENV` | `development` \| `production` \| `test` | `development` | Zod enum | Controls error stack traces, logging verbosity, and test optimizations. |
| `PORT` | Integer `1`..`65535` | `4000` | Port number | TCP port on which the Express REST API listens. |
| `MONGODB_URI` | String (URI) | `mongodb://127.0.0.1:27017/radiology` | Valid MongoDB connection string | Primary connection string for Mongoose database connection. |
| `MONGODB_URI_TEST` | String (URI) | `mongodb://127.0.0.1:27017` | Valid MongoDB connection string | Base URI used by Vitest integration tests for ephemeral database creation. |
| `JWT_SECRET` | String | *None (Required)* | Length $\ge 32$ chars; cannot be `'change-me'` in `production` | Secret key used to sign and verify HS256 JSON Web Tokens. |
| `JWT_TTL_HOURS` | Positive Number | `12` | Positive number | Time-to-live for authentication session tokens in hours. |
| `PUBLIC_ID_SALT` | String | *None (Required)* | Length $\ge 16$ chars | Salt used to compute deterministic HMAC-SHA256 image public tokens. |
| `BCRYPT_COST` | Integer `4`..`16` | `12` (4 in test mode) | Integer bounds | Computational work factor for bcrypt password hashing. |
| `COOKIE_SECURE` | Boolean | `false` (enforced `true` in production) | Boolean flag | Requires `Secure` flag on `auth_token` HTTP cookie. |
| `CORS_ORIGIN` | String | `""` | Cannot be wildcard `'*'` | Allowed client origin for CORS headers when credentials are exchanged. |
| `RATE_LIMIT_ENABLED` | Boolean | `true` | Boolean flag | Toggles API rate limiting middleware globally. |
| `ALLOW_REPEATS` | Boolean | `false` | Boolean flag | Controls whether the adaptive engine can reuse images already answered by the resident. |
| `CATALOG_FILE` | String (Path) | `ml/artifacts/catalog.json` | Valid relative/absolute path | Path to the image catalog metadata JSON file. |
| `CATALOG_IMAGE_DIR`| String (Path) | `data/catalog/images` | Valid relative/absolute path | Directory containing physical PNG chest radiograph image files. |
| `LLM_MODE` | `live` \| `cache-only` \| `fake` | `cache-only` | Zod enum | Governs LLM provider behavior: cache-only (offline), fake (testing), or live (Gemini API). |
| `LLM_ENABLED` | Boolean | `true` | Boolean flag | Master switch for LLM feedback and report generation features. |
| `GEMINI_API_KEY` | String | `""` | Mandatory if `LLM_MODE='live'` and `LLM_ENABLED=true` | API key for authenticating with Google Gemini Interactions API. |
| `GEMINI_MODEL` | String | `gemini-3.8-flash` | Valid Gemini model identifier | Model identifier targeted by `@google/genai` interactions client. |
| `LLM_DAILY_REQUEST_BUDGET` | Integer $\ge 1$ | `16` | Positive integer | Maximum external Gemini API calls permitted per Pacific calendar day. |
| `LLM_MIN_INTERVAL_MS` | Integer $\ge 0$ | `13000` (13 sec) | Non-negative integer | Enforces spacing between external LLM calls to comply with the 5 RPM rate limit. |
| `LLM_TIMEOUT_MS` | Integer $\ge 1000$ | `60000` (60 sec) | Milliseconds | Abort timeout for outgoing Gemini API requests. |
| `LLM_RATE_LIMIT_PER_USER_PER_HOUR` | Integer $\ge 1$ | `30` | Positive integer | Endpoint rate limit protecting LLM feedback requests from resident flooding. |
