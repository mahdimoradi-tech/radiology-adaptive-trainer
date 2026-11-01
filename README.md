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

## Workspaces

- `apps/web`: React 19 + Vite 8 + Tailwind CSS 4 RTL application (resident & instructor panels)
- `apps/api`: Express 5 + Mongoose 9 REST API with JWT cookie session auth
- `packages/contracts`: Shared Zod 4 runtime schemas and contracts
- `packages/engine`: Pure JS adaptive question selection engine and virtual simulator
- `ml/`: Offline DenseNet-121 feature extraction and difficulty estimation pipeline
