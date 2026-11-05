import crypto from 'node:crypto';
import { PATTERN_VALUES, DISTRIBUTION_VALUES } from '@radiology/contracts';

/**
 * Validation reason codes for generated questions and question edits
 * @typedef {'SCHEMA_INVALID' | 'STEM_EMPTY' | 'HAS_PERCENT' | 'HAS_DIGIT' |
 *   'NOT_PERSIAN' | 'CLASS_NAME_IN_STEM' | 'DUPLICATE_OPTIONS' |
 *   'TIED_KEY_INVALID' | 'RATIONALE_TOO_LONG'} QuestionValidationReason
 */
export const QUESTION_VALIDATION_REASONS = /** @type {const} */ ([
  'SCHEMA_INVALID',
  'STEM_EMPTY',
  'HAS_PERCENT',
  'HAS_DIGIT',
  'NOT_PERSIAN',
  'CLASS_NAME_IN_STEM',
  'DUPLICATE_OPTIONS',
  'TIED_KEY_INVALID',
  'RATIONALE_TOO_LONG',
]);

/**
 * Normalize Persian/Arabic text for duplicate option detection
 * @param {string} text
 * @returns {string}
 */
export function normalizeTextForComparison(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove Arabic diacritics / vowels
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200C\s]+/g, ' ') // normalize zero-width non-joiner and spaces
    .trim()
    .toLowerCase();
}

/**
 * Count ratio of Persian/Arabic letters to total letters
 * @param {string} text
 * @returns {number} Ratio between 0 and 1
 */
export function calculatePersianLetterRatio(text) {
  if (typeof text !== 'string' || text.length === 0) return 0;
  const persianMatches = text.match(/[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/g);
  const totalLetterMatches = text.match(/[a-zA-Z\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/g);

  if (!totalLetterMatches || totalLetterMatches.length === 0) return 0;
  const persianCount = persianMatches ? persianMatches.length : 0;
  return persianCount / totalLetterMatches.length;
}

/**
 * Check if text contains ASCII or Persian/Arabic digits
 * @param {string} text
 * @returns {boolean}
 */
export function hasDigit(text) {
  if (typeof text !== 'string') return false;
  return /[0-9\u0660-\u0669\u06F0-\u06F9]/.test(text);
}

/**
 * Check if text contains percent symbols
 * @param {string} text
 * @returns {boolean}
 */
export function hasPercent(text) {
  if (typeof text !== 'string') return false;
  return /[%٪\u066A]/.test(text);
}

/**
 * Check if stem reveals disease class names (for finding and distribution questions)
 * @param {string} stem
 * @returns {boolean}
 */
export function hasClassNameInStem(stem) {
  if (typeof stem !== 'string') return false;
  return /\b(covid(?:-?19)?|pneumonia|normal)\b|کووید|ذات[\s‌]*الریه|پنومونی|نرمال/i.test(stem);
}

/**
 * Compute deterministic stable ID for a generated question
 * @param {Object} params
 * @param {string} params.imageId
 * @param {string} params.type
 * @param {string} params.promptVersion
 * @param {number} [params.slot=0]
 * @returns {string} SHA1 hex hash
 */
export function computeStableId({ imageId, type, promptVersion, slot = 0 }) {
  if (!imageId || !type || !promptVersion) {
    throw new Error('imageId, type, and promptVersion are required to compute stableId');
  }
  return crypto
    .createHash('sha1')
    .update(`${imageId}:${type}:${promptVersion}:${slot}`)
    .digest('hex');
}

/**
 * Validate a generated or edited question candidate against all clinical and pedagogical rules
 * @param {Object} candidate
 * @param {Object} [context]
 * @param {Object} [context.image]
 * @param {Object} [context.consensus]
 * @param {string[]} [context.kbSlugs]
 * @returns {{ valid: boolean, reasons: QuestionValidationReason[] }}
 */
export function validateQuestionCandidate(candidate, context = {}) {
  const reasons = [];

  // 1. Basic schema check
  if (
    !candidate ||
    typeof candidate !== 'object' ||
    !['finding', 'distribution', 'differential'].includes(candidate.type) ||
    typeof candidate.stem !== 'string' ||
    !Array.isArray(candidate.options) ||
    candidate.options.length !== 4 ||
    typeof candidate.correctIndex !== 'number' ||
    !Number.isInteger(candidate.correctIndex) ||
    candidate.correctIndex < 0 ||
    candidate.correctIndex > 3 ||
    typeof candidate.rationale !== 'string'
  ) {
    return {
      valid: false,
      reasons: ['SCHEMA_INVALID'],
    };
  }

  // 2. Stem emptiness
  if (candidate.stem.trim().length === 0) {
    reasons.push('STEM_EMPTY');
  }

  // 3. Rationale length
  if (candidate.rationale.length > 300) {
    reasons.push('RATIONALE_TOO_LONG');
  }

  // 4. Percentage check
  const allTexts = [
    candidate.stem,
    candidate.rationale,
    ...candidate.options.map((o) => (o && typeof o.text === 'string' ? o.text : '')),
  ];

  if (allTexts.some((txt) => hasPercent(txt))) {
    reasons.push('HAS_PERCENT');
  }

  // 5. Digit check
  if (allTexts.some((txt) => hasDigit(txt))) {
    reasons.push('HAS_DIGIT');
  }

  // 6. Persian script ratio check (letters >= 60% Persian)
  const stemRatio = calculatePersianLetterRatio(candidate.stem);
  const optionsRatios = candidate.options.map((o) =>
    o && typeof o.text === 'string' ? calculatePersianLetterRatio(o.text) : 0,
  );

  if (stemRatio < 0.6 || optionsRatios.some((r) => r < 0.6)) {
    reasons.push('NOT_PERSIAN');
  }

  // 7. Class names in finding/distribution stem
  if (candidate.type === 'finding' || candidate.type === 'distribution') {
    if (hasClassNameInStem(candidate.stem)) {
      reasons.push('CLASS_NAME_IN_STEM');
    }
  }

  // 8. Duplicate options
  const normalizedOptions = candidate.options.map((o) =>
    o && typeof o.text === 'string' ? normalizeTextForComparison(o.text) : '',
  );
  if (new Set(normalizedOptions).size < 4) {
    reasons.push('DUPLICATE_OPTIONS');
  }

  // 9. Tied-keys rule
  const consensus = context.consensus || {};
  const consensusPatterns = Array.isArray(consensus.patterns) ? consensus.patterns : [];
  const consensusDistribution = consensus.distribution || null;
  const kbSlugs = Array.isArray(context.kbSlugs) ? context.kbSlugs : [];

  if (candidate.type === 'finding') {
    const keys = candidate.options.map((o) => o?.key);
    const allValidPatternKeys = keys.every(
      (k) => typeof k === 'string' && PATTERN_VALUES.includes(k),
    );
    const uniqueKeys = new Set(keys).size === 4;

    if (!allValidPatternKeys || !uniqueKeys) {
      reasons.push('TIED_KEY_INVALID');
    } else {
      const presentInConsensus = keys.filter((k) => consensusPatterns.includes(k));
      if (presentInConsensus.length !== 1) {
        reasons.push('TIED_KEY_INVALID');
      } else {
        const correctOptionKey = candidate.options[candidate.correctIndex]?.key;
        if (!consensusPatterns.includes(correctOptionKey)) {
          reasons.push('TIED_KEY_INVALID');
        }
      }
    }
  } else if (candidate.type === 'distribution') {
    const keys = candidate.options.map((o) => o?.key);
    const allValidDistKeys = keys.every(
      (k) => typeof k === 'string' && DISTRIBUTION_VALUES.includes(k),
    );
    const uniqueKeys = new Set(keys).size === 4;

    if (
      !consensusDistribution ||
      consensusDistribution === 'none' ||
      !allValidDistKeys ||
      !uniqueKeys
    ) {
      reasons.push('TIED_KEY_INVALID');
    } else {
      const matchingKeys = keys.filter((k) => k === consensusDistribution);
      if (matchingKeys.length !== 1) {
        reasons.push('TIED_KEY_INVALID');
      } else {
        const correctOptionKey = candidate.options[candidate.correctIndex]?.key;
        if (correctOptionKey !== consensusDistribution) {
          reasons.push('TIED_KEY_INVALID');
        }
      }
    }
  } else if (candidate.type === 'differential') {
    const allKeysNull = candidate.options.every((o) => o?.key === null || o?.key === undefined);
    const hasKbRef = typeof candidate.kbRef === 'string' && candidate.kbRef.trim().length > 0;
    const kbRefAllowed = kbSlugs.length === 0 || kbSlugs.includes(candidate.kbRef);

    if (!allKeysNull || !hasKbRef || !kbRefAllowed) {
      reasons.push('TIED_KEY_INVALID');
    }
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}
