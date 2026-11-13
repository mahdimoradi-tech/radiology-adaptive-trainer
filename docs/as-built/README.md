# As-Built System Documentation

> [!IMPORTANT]
> **Document Status: As-built (retrospective)**  
> Baselined on commit `9357ace` on 2026-11-13.

## Overview

This directory contains the retrospective engineering specifications, design records, traceability matrices, and testing baselines for the **Radiology Adaptive Training Platform**. 

The system was designed and developed across 21 engineering tasks (T00 through T15). Requirements were established iteratively via task acceptance criteria and Architectural Decision Records (ADRs). These documents represent an accurate, evidence-backed fact base reflecting the code, test suites, and operational boundaries of the completed system.

## Document Directory & Reading Order

The as-built documentation suite is structured according to international software engineering standards (ISO/IEC/IEEE 29148 lite for requirements; ISO/IEC/IEEE 42010 lite for design) and organized in logical reading order:

1. [**GLOSSARY.md**](GLOSSARY.md) — Domain definitions, mathematical formulations, metrics, and technical acronyms.
2. [**01-SRS.md**](01-SRS.md) — Software Requirements Specification (functional and non-functional requirements, use cases, external interfaces, and constraints).
3. [**traceability.csv**](traceability.csv) — Bidirectional traceability matrix linking every requirement to its originating task, ADR, source code implementation, automated test file, and manual verification step.
4. [**02-SDD.md**](02-SDD.md) *(T16b)* — Software Design Document (system architecture, package decomposition, data models, state machines, and API specifications).
5. [**03-TEST-REPORT.md**](03-TEST-REPORT.md) *(T16c)* — Verification and Validation Report (test suite execution logs, security audits, evaluation benchmarks, and quality gate outcomes).

## Core System Principles

1. **Retrospective Factuality:** Every statement is backed by verifiable code references (`path:line`), automated test suites, or execution logs. No hypothetical, unverified, or forward-looking statements are presented as implemented.
2. **Strict Non-Clinical Boundary:** The platform is an educational training system for radiology residents. It is explicitly not a diagnostic tool or Software as a Medical Device (SaMD).
3. **Traceability:** Requirements map directly to task acceptance criteria (T00–T15) and test files, with all gaps transparently cataloged.
