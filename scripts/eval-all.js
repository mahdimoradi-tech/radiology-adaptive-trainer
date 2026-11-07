/**
 * eval:all — Master evaluation orchestrator running E1 (Simulation),
 * E2 (Image Analysis), E3 (Question Rubric & Pipeline), and E4 (ML Confounder).
 *
 * Updates docs/EVALUATION.md strictly between:
 *   <!-- GENERATED:START -->
 *   ...
 *   <!-- GENERATED:END -->
 *
 * Usage: node scripts/eval-all.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { evaluateSimulation, formatSimulationMarkdown } from './eval-simulation.js';
import { evaluateAnalyses, formatAnalysisMarkdown } from './eval-analysis.js';
import {
  evaluateQuestionPipeline,
  scoreRubricCsv,
  formatPipelineMarkdown,
  formatRubricMarkdown,
} from './eval-questions.js';
import { evaluateMlArtifacts, formatMlMarkdown } from './eval-ml.js';

const EVALUATION_DOC_PATH = 'docs/EVALUATION.md';
const MARKER_START = '<!-- GENERATED:START -->';
const MARKER_END = '<!-- GENERATED:END -->';

const DEFAULT_REPORT_SKELETON = `# Comprehensive Evaluation Report (T10)

This document contains empirical, reproducible evaluation results across the four analytical pillars of the Radiology Adaptive Training Platform:
1. **E1:** Adaptive Question Selection Simulation
2. **E2:** LLM Multimodal Image Analysis vs Dataset Ground Truth
3. **E3:** Question Bank Quality, Rubric Ratings & Generation Pipeline
4. **E4:** Machine Learning (DenseNet-121) Out-of-Fold Performance & Confounder Analysis

<!-- GENERATED:START -->
<!-- GENERATED:END -->

## Interpretation and Limitations (TODO for Mahdi / Claude)

> **Important:** The agent produces facts, empirical metrics, Wilson confidence intervals, and tables only. This section is reserved for human qualitative interpretation.

- [ ] **TODO: Adaptive Engine Simulation Limits** — Trainee skill growth in the simulator is modeled as an asymptotic exposure function ($S_c \\leftarrow S_c + \\eta(1-S_c)$). Real human diagnostic learning exhibits forgetting curves, fatigue, and visual cognitive plateaus that are not modeled here.
- [ ] **TODO: Dataset Source Confounder & COVID-19 Sample Size** — The COVID-19 class contains only 177 images (142 from Cohen, 35 from Figure1), whereas Kermany comprises 5,827 pediatric images (1,582 normal, 4,245 pneumonia). The CNN backbone may exploit institutional/scanner shortcuts between datasets rather than true pathology.
- [ ] **TODO: Single Non-Expert Question Rubric Reviewer** — The question bank rubric is rated by one non-expert reviewer (the system’s builder); ratings are indicative of clarity, distractor plausibility, and absence of answer leakage, not formal board-certified pedagogical certification.
- [ ] **TODO: Limited LLM Batch Sample Size** — LLM image analysis evaluation is constrained to verified batches executed under the free-tier quota (15 RPM / 16 RPD) and requires cautious statistical extrapolation.
- [ ] **TODO: Free-Tier API Rate Limits** — Gemini free-tier rate limits restrict daily throughput, requiring portable caching and offline batch processing for sustainable operation.
- [ ] **TODO: Educational Purpose Strictly Defined** — Platform is an educational prototype. Neither LLM feedback nor CNN feature extraction constitutes clinical diagnosis or medical device software.
`;

export async function runAllEvaluations({
  date = new Date().toISOString(),
  targetDocPath = EVALUATION_DOC_PATH,
} = {}) {
  const evalDir = 'docs/evaluation';
  if (!fs.existsSync(evalDir)) {
    fs.mkdirSync(evalDir, { recursive: true });
  }

  console.log('====================================================');
  console.log('       Radiology Adaptive Trainer — Evaluation      ');
  console.log('====================================================\n');

  // 1. E1 Simulation
  console.log('-> Running E1: Adaptive Engine Simulation...');
  const simReport = evaluateSimulation({ numResidents: 50, seed: 42, date });
  fs.writeFileSync(
    path.join(evalDir, 'simulation.json'),
    JSON.stringify(simReport, null, 2),
    'utf8',
  );
  const simMd = formatSimulationMarkdown(simReport);

  // 2. E2 Analysis
  console.log('-> Running E2: LLM Image Analysis vs Dataset Labels...');
  let analyses = [];
  const analysesPath = 'apps/api/seed/image-analyses.json';
  if (fs.existsSync(analysesPath)) {
    try {
      analyses = JSON.parse(fs.readFileSync(analysesPath, 'utf8'));
    } catch {
      analyses = [];
    }
  }

  let difficultyItems = [];
  const diffPath = 'ml/artifacts/difficulty.json';
  if (fs.existsSync(diffPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(diffPath, 'utf8'));
      difficultyItems = Array.isArray(parsed) ? parsed : parsed.items || [];
    } catch {
      difficultyItems = [];
    }
  }

  const analysisReport = evaluateAnalyses({ analyses, difficultyItems, date });
  fs.writeFileSync(
    path.join(evalDir, 'analysis.json'),
    JSON.stringify(analysisReport, null, 2),
    'utf8',
  );
  const analysisMd = formatAnalysisMarkdown(analysisReport);

  // 3. E3 Questions
  console.log('-> Running E3: Question Quality & Pipeline...');
  let bankItems = [];
  const bankPath = 'apps/api/seed/question-bank.approved.json';
  if (fs.existsSync(bankPath)) {
    try {
      bankItems = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
    } catch {
      bankItems = [];
    }
  }

  const pipelineReport = evaluateQuestionPipeline({ bankItems, date });
  fs.writeFileSync(
    path.join(evalDir, 'questions-pipeline.json'),
    JSON.stringify(pipelineReport, null, 2),
    'utf8',
  );
  const pipelineMd = formatPipelineMarkdown(pipelineReport);

  let rubricMd;
  const rubricCsvPath = path.join(evalDir, 'question-rubric.csv');
  if (fs.existsSync(rubricCsvPath)) {
    const csvContent = fs.readFileSync(rubricCsvPath, 'utf8');
    const rubricReport = scoreRubricCsv(csvContent, { date });
    fs.writeFileSync(
      path.join(evalDir, 'questions-rubric.json'),
      JSON.stringify(rubricReport, null, 2),
      'utf8',
    );
    rubricMd = formatRubricMarkdown(rubricReport);
  } else {
    rubricMd = formatRubricMarkdown({
      metadata: { command: 'npm run eval:questions score', date, gitSha: 'unknown' },
      status: 'pending_review',
      ratedCount: 0,
    });
  }

  // 4. E4 ML Confounder
  console.log('-> Running E4: ML Out-of-Fold & Confounder...');
  let catalogItems = [];
  const catPath = 'ml/artifacts/catalog.json';
  if (fs.existsSync(catPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(catPath, 'utf8'));
      catalogItems = Array.isArray(parsed) ? parsed : [];
    } catch {
      catalogItems = [];
    }
  }

  const mlReport = evaluateMlArtifacts({ difficultyItems, catalogItems, date });
  fs.writeFileSync(path.join(evalDir, 'ml.json'), JSON.stringify(mlReport, null, 2), 'utf8');
  const mlMd = formatMlMarkdown(mlReport);

  // Combine generated markdown
  const generatedContent = [
    simMd.trim(),
    '---',
    analysisMd.trim(),
    '---',
    rubricMd.trim(),
    pipelineMd.trim(),
    '---',
    mlMd.trim(),
  ].join('\n\n');

  // Inject into target doc
  let fullDoc = DEFAULT_REPORT_SKELETON;
  if (fs.existsSync(targetDocPath)) {
    const existing = fs.readFileSync(targetDocPath, 'utf8');
    if (existing.includes(MARKER_START) && existing.includes(MARKER_END)) {
      fullDoc = existing;
    }
  }

  const startIndex = fullDoc.indexOf(MARKER_START);
  const endIndex = fullDoc.indexOf(MARKER_END);

  if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
    const before = fullDoc.slice(0, startIndex + MARKER_START.length);
    const after = fullDoc.slice(endIndex);
    fullDoc = `${before}\n\n${generatedContent}\n\n${after}`;
  } else {
    fullDoc = `${MARKER_START}\n\n${generatedContent}\n\n${MARKER_END}`;
  }

  fs.writeFileSync(targetDocPath, fullDoc, 'utf8');
  console.log(`\n✔ Successfully generated evaluation report at ${targetDocPath}\n`);
}

if (process.argv[1]?.endsWith('eval-all.js')) {
  runAllEvaluations().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
