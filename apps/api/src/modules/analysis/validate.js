/**
 * @fileoverview Pure validation logic for image analysis results (T08a).
 *
 * validateAnalysis({ runA, runB, datasetLabel }) → { status, reasons, consensus }
 *
 * Reason codes (all 9):
 *   RUN_MISSING         — runA or runB is null/undefined
 *   SCHEMA_INVALID      — output fails Zod validation
 *   QUALITY_NOT_OK      — either run has imageQuality !== 'ok'
 *   RUNS_DISAGREE       — predictedClass differs between A and B
 *   LABEL_MISMATCH      — predictedClass != datasetLabel
 *   RULE_CLEAR_EXCLUSIVE — 'clear_lungs' appears with another pattern
 *   RULE_NORMAL_PATTERNS — datasetLabel='normal' but patterns != ['clear_lungs']
 *   RULE_DISEASE_NEEDS_PATTERN — pneumonia/covid19 with no non-clear pattern
 *   NO_CONSENSUS_PATTERN — disease class and intersection of patterns A∩B is empty
 *
 * auto_passed only when reasons array is empty.
 *
 * This module is a pure function: no I/O, no DB, no network.
 */

import { ImageAnalysisResultSchema } from '@radiology/contracts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set intersection for arrays.
 * @template T
 * @param {T[]} a
 * @param {T[]} b
 * @returns {T[]}
 */
function intersect(a, b) {
  const setB = new Set(b);
  return a.filter((x) => setB.has(x));
}

/**
 * Validate one run's output object against the Zod schema.
 * Returns the parsed object or null if invalid.
 * @param {unknown} output
 * @returns {{ valid: true, data: import('@radiology/contracts').ImageAnalysisResult } | { valid: false }}
 */
function parseOutput(output) {
  const result = ImageAnalysisResultSchema.safeParse(output);
  if (result.success) return { valid: true, data: result.data };
  return { valid: false };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ValidationInput
 * @property {unknown | null | undefined} runA - Stored output object from run A
 * @property {unknown | null | undefined} runB - Stored output object from run B
 * @property {string} datasetLabel - Ground-truth class ('covid19'|'pneumonia'|'normal')
 */

/**
 * @typedef {Object} ValidationResult
 * @property {'auto_passed' | 'auto_rejected'} status
 * @property {string[]} reasons - Array of VALIDATION_REASON codes
 * @property {Object} consensus
 * @property {string[]} consensus.patterns - Intersection of A and B patterns
 * @property {string | null} consensus.distribution - Value if A==B, else null
 * @property {string | null} consensus.laterality - Value if A==B, else null
 * @property {string[]} consensus.zones - Intersection of A and B zones
 */

/**
 * Validate both analysis runs for a single image.
 *
 * @param {ValidationInput} input
 * @returns {ValidationResult}
 */
export function validateAnalysis({ runA, runB, datasetLabel }) {
  /** @type {string[]} */
  const reasons = [];

  // -------------------------------------------------------------------------
  // 1. RUN_MISSING — either run is absent
  // -------------------------------------------------------------------------
  if (runA == null || runB == null) {
    reasons.push('RUN_MISSING');
    return {
      status: 'auto_rejected',
      reasons,
      consensus: { patterns: [], distribution: null, laterality: null, zones: [] },
    };
  }

  // -------------------------------------------------------------------------
  // 2. SCHEMA_INVALID — parse both against the Zod schema
  // -------------------------------------------------------------------------
  const parsedA = parseOutput(runA);
  const parsedB = parseOutput(runB);

  if (!parsedA.valid || !parsedB.valid) {
    reasons.push('SCHEMA_INVALID');
    return {
      status: 'auto_rejected',
      reasons,
      consensus: { patterns: [], distribution: null, laterality: null, zones: [] },
    };
  }

  const a = parsedA.data;
  const b = parsedB.data;

  // -------------------------------------------------------------------------
  // 3. QUALITY_NOT_OK — either run has imageQuality !== 'ok'
  // -------------------------------------------------------------------------
  if (a.imageQuality !== 'ok' || b.imageQuality !== 'ok') {
    reasons.push('QUALITY_NOT_OK');
  }

  // -------------------------------------------------------------------------
  // 4. RUNS_DISAGREE — predictedClass differs between A and B
  // -------------------------------------------------------------------------
  if (a.predictedClass !== b.predictedClass) {
    reasons.push('RUNS_DISAGREE');
  }

  // -------------------------------------------------------------------------
  // 5. LABEL_MISMATCH — predictedClass != dataset label
  //    (use run A's class; if runs disagree, both may mismatch — still one code)
  // -------------------------------------------------------------------------
  if (a.predictedClass !== datasetLabel) {
    reasons.push('LABEL_MISMATCH');
  }

  // -------------------------------------------------------------------------
  // 6. RULE_CLEAR_EXCLUSIVE — 'clear_lungs' together with another pattern
  //    Check both runs independently.
  // -------------------------------------------------------------------------
  const clearViolation = (patterns) => patterns.includes('clear_lungs') && patterns.length > 1;

  if (clearViolation(a.patterns) || clearViolation(b.patterns)) {
    reasons.push('RULE_CLEAR_EXCLUSIVE');
  }

  // -------------------------------------------------------------------------
  // 7. RULE_NORMAL_PATTERNS — datasetLabel='normal' but patterns ≠ ['clear_lungs']
  //    Both runs must have exactly ['clear_lungs'] when the true label is normal.
  // -------------------------------------------------------------------------
  if (datasetLabel === 'normal') {
    const normalPatternsOk = (patterns) => patterns.length === 1 && patterns[0] === 'clear_lungs';
    if (!normalPatternsOk(a.patterns) || !normalPatternsOk(b.patterns)) {
      reasons.push('RULE_NORMAL_PATTERNS');
    }
  }

  // -------------------------------------------------------------------------
  // 8. RULE_DISEASE_NEEDS_PATTERN — pneumonia/covid19 with no non-clear pattern
  //    At least one pattern other than 'clear_lungs' required.
  // -------------------------------------------------------------------------
  if (datasetLabel === 'pneumonia' || datasetLabel === 'covid19') {
    const hasDisease = (patterns) => patterns.some((p) => p !== 'clear_lungs');
    if (!hasDisease(a.patterns) || !hasDisease(b.patterns)) {
      reasons.push('RULE_DISEASE_NEEDS_PATTERN');
    }
  }

  // -------------------------------------------------------------------------
  // 9. NO_CONSENSUS_PATTERN — disease class and intersection of A∩B is empty
  //    Only checked when datasetLabel is a disease (not 'normal').
  // -------------------------------------------------------------------------
  const patternIntersection = intersect(a.patterns, b.patterns);

  if (datasetLabel !== 'normal' && patternIntersection.length === 0) {
    reasons.push('NO_CONSENSUS_PATTERN');
  }

  // -------------------------------------------------------------------------
  // Build consensus
  // -------------------------------------------------------------------------
  const consensusPatterns = datasetLabel === 'normal' ? ['clear_lungs'] : patternIntersection;

  const consensus = {
    patterns: consensusPatterns,
    distribution: a.distribution === b.distribution ? a.distribution : null,
    laterality: a.laterality === b.laterality ? a.laterality : null,
    zones: intersect(a.zones, b.zones),
  };

  return {
    status: reasons.length === 0 ? 'auto_passed' : 'auto_rejected',
    reasons,
    consensus,
  };
}
