# Radiology Adaptive Training Platform

An adaptive educational platform designed to train radiology residents on chest X-ray diagnosis (`covid19`, `pneumonia`, `normal`). The platform continuously models individual error patterns (false-positive and false-negative trends), generates tailored quizzes adaptively, and leverages LLM-assisted analysis and instructor-approved question banks to provide targeted learning.

## Quick Start

### 1. Prerequisites

- **Node.js**: v24 LTS (`node -v`)
- **MongoDB**: Community Server 8.x running locally on `127.0.0.1:27017`
- **Python**: 3.12 + `uv` (for offline ML pipeline)
- **Environment**: Copy `.env.example` to `.env`

### 2. Install Dependencies

```powershell
npm install
```

### 3. Database Seed & Setup

```powershell
npm run seed:catalog -w @radiology/api
npm run create-instructor -w @radiology/api
```

### 4. Development Runner (API + Web)

Start both Express backend (`http://127.0.0.1:4000`) and Vite React frontend (`http://127.0.0.1:5173`) concurrently:

```powershell
npm run dev
```

### 5. Verification Commands

```powershell
npm run lint         # ESLint + RTL Logical Utility Scanner
npm test             # Vitest monorepo test suite
npm run build        # Production builds
```

### 6. Evaluation Suite (Reproducible Metrics)

Run the empirical evaluation pipelines for report metrics, Wilson confidence intervals, and tables:

```powershell
npm run eval:simulation   # E1: Adaptive vs Random vs Fixed simulation (50 seeds)
npm run eval:analysis     # E2: LLM analysis vs dataset ground truth & DenseNet baseline
npm run eval:questions    # E3: Question bank pipeline stats & rubric scoring
npm run eval:ml           # E4: DenseNet-121 out-of-fold accuracy & confounders
npm run eval:all          # Run all evaluations and update docs/EVALUATION.md
```

## Workspaces

- `apps/web`: React 19 + Vite 8 + Tailwind CSS 4 RTL application:
  - **Resident Panel**: Baseline & adaptive diagnostic testing, accessible radiograph quiz runner, performance analytics reports with confusion matrices and LLM narrative feedback, targeted practice on confusion pairs, learning progress tracking, and resident educational guide (`/app/education`).
  - **Instructor Panel**: AI-generated question bank review queue, resident trainee roster and individual diagnostic progress inspector, and radiograph catalog distribution and difficulty monitoring (`/instructor/catalog`).
- `apps/api`: Express 5 + Mongoose REST API with JWT cookie session auth and role-based access control
- `packages/contracts`: Shared Zod 4 runtime schemas and contracts across all modules
- `packages/engine`: Pure JS adaptive question selection engine and virtual resident simulator
- `ml/`: Offline DenseNet-121 feature extraction and difficulty estimation pipeline
