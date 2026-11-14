# As-Built System Documentation

> [!IMPORTANT]
> **Document Status: As-built (retrospective)**  
> **Baselined on commit:** `9357ace` through `docs/T16c-test-report-and-process`  
> **Target System:** Radiology Adaptive Training Platform (B.Sc. Capstone)

## Overview

This directory contains the retrospective engineering specifications, architectural designs, bidirectional traceability matrices, test verification reports, user and operations manuals, and development process records for the **Radiology Adaptive Training Platform**.

The system was designed and developed across 24 engineering tasks (T00 through T16c). Requirements were established iteratively via task acceptance criteria and Architectural Decision Records (ADRs). These documents represent an accurate, evidence-backed fact base reflecting the code, test suites, and operational boundaries of the completed system.

## Document Directory & Reading Order

The as-built documentation suite is structured according to international software engineering standards (ISO/IEC/IEEE 29148 lite for requirements; ISO/IEC/IEEE 42010 / IEEE 1016 lite for design; IEEE 829 / ISO/IEC/IEEE 29119 lite for testing) and organized in logical reading order:

1. [**GLOSSARY.md**](GLOSSARY.md) — Domain definitions, mathematical formulations, metrics, and technical acronyms.
2. [**01-SRS.md**](01-SRS.md) — Software Requirements Specification (functional and non-functional requirements, use cases, external interfaces, data dictionary, and system constraints).
3. [**traceability.csv**](traceability.csv) — Bidirectional traceability matrix linking all 91 requirements to originating tasks, ADRs, source code directories, automated test suites, and manual verification steps.
4. [**02-SDD.md**](02-SDD.md) — Software Design Description (monorepo decomposition, MongoDB collection schemas, REST API specifications, adaptive mathematical algorithms, session lifecycle, security controls, and ML pipeline design).
5. [**03-TEST-REPORT.md**](03-TEST-REPORT.md) — Verification & Validation Report (monorepo test suite execution logs, security audits, evaluation benchmarks, and quality gate outcomes).
6. [**04-USER-GUIDE.md**](04-USER-GUIDE.md) — System User Guide (resident and instructor workflows across all 19 screens, examination flows, report interpretation, targeted practice, and keyboard hotkeys).
7. [**05-RUN-GUIDE.md**](05-RUN-GUIDE.md) — System Run & Operations Guide (prerequisites, step-by-step clean-clone setup, environment variables, seeding, offline vs live execution, test runs, and failure troubleshooting).
8. [**06-PROCESS-REPORT.md**](06-PROCESS-REPORT.md) — Engineering Process Report (task-driven, AI-assisted development methodology, Git history timeline, human-AI role division, quality practices, risk register, and honest lessons learned).

## Core System Principles

1. **Retrospective Factuality:** Every statement is backed by verifiable code references (`path:line`), automated test suites, or execution logs. No hypothetical, unverified, or forward-looking statements are presented as implemented.
2. **Strict Non-Clinical Boundary:** The platform is an educational training system for radiology residents. It is explicitly not a diagnostic tool or Software as a Medical Device (SaMD).
3. **Traceability:** Requirements map directly to task acceptance criteria (T00–T16c) and test files, with all verification outcomes transparently cataloged.

## Document Control & Version History

| Document | Standard / Format | Primary Purpose & Scope | Baseline Commit SHA |
|---|---|---|---|
| [**GLOSSARY.md**](GLOSSARY.md) | Domain Lexicon | Codified clinical, mathematical, and architectural definitions | `e94c09f` |
| [**01-SRS.md**](01-SRS.md) | ISO/IEC/IEEE 29148 lite | 91 software requirements (65 FRs, 26 NFRs), use cases, interfaces | `e94c09f` |
| [**traceability.csv**](traceability.csv) | RFC 4180 CSV | Bidirectional traceability from requirements to code and tests | `e94c09f` |
| [**02-SDD.md**](02-SDD.md) | IEEE 1016 / ISO/IEC/IEEE 42010 lite | 14 design sections: models, 31 APIs, algorithms, security, ML, UI | `95078e3` |
| [**03-TEST-REPORT.md**](03-TEST-REPORT.md) | IEEE 829 / ISO/IEC/IEEE 29119 lite | Real test inventory (96 files, 789 tests), gates, E1–E4, bugs, risks | `a50f69b` |
| [**04-USER-GUIDE.md**](04-USER-GUIDE.md) | User Manual | Operational guidance for residents and instructors across 19 screens | `98fcbff` |
| [**05-RUN-GUIDE.md**](05-RUN-GUIDE.md) | Operations Guide | Windows setup, PowerShell commands, env variables, troubleshooting | `6d4bcb8` |
| [**06-PROCESS-REPORT.md**](06-PROCESS-REPORT.md) | Process Review | Task-driven model, Git timeline (316 commits), AI roles, risk register | `328daa9` |
