/**
 * Digit normalization and hallucination guard for LLM outputs
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * Normalizes Persian and Arabic-Indic digits in a string to standard ASCII digits 0-9.
 * @param {string} str
 * @returns {string}
 */
export function normalizeDigits(str) {
  if (typeof str !== 'string') return '';
  let result = str;
  for (let i = 0; i <= 9; i++) {
    result = result
      .replaceAll(PERSIAN_DIGITS[i], String(i))
      .replaceAll(ARABIC_DIGITS[i], String(i));
  }
  return result;
}

/**
 * Recursively extracts all integer digit sequences present in an object, array, or primitive.
 * @param {unknown} value
 * @param {Set<string>} [acc]
 * @returns {Set<string>}
 */
export function extractNumbers(value, acc = new Set()) {
  if (value === null || value === undefined) {
    return acc;
  }

  if (typeof value === 'number') {
    if (Number.isFinite(value)) {
      const rounded = Math.round(value);
      acc.add(String(rounded));
    }
    return acc;
  }

  if (typeof value === 'string') {
    const normalized = normalizeDigits(value);
    const matches = normalized.match(/\d+/g);
    if (matches) {
      for (const m of matches) {
        acc.add(m);
      }
    }
    return acc;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      extractNumbers(item, acc);
    }
    return acc;
  }

  if (typeof value === 'object') {
    for (const val of Object.values(value)) {
      extractNumbers(val, acc);
    }
    return acc;
  }

  return acc;
}

/**
 * Validates that an LLM output contains no percent signs (% or ٪)
 * and no digit sequences that are absent from the allowed numbers set.
 *
 * @param {unknown} output - The parsed JSON data from the LLM
 * @param {Set<string> | Iterable<string | number>} allowedNumbers - Set or array of allowed number strings
 * @returns {boolean} True if the output passes all guard rules
 */
export function passesGuard(output, allowedNumbers) {
  const allowedSet = new Set(
    Array.from(allowedNumbers || []).map((n) => normalizeDigits(String(n))),
  );

  /**
   * Helper to check strings recursively
   * @param {unknown} val
   * @returns {boolean}
   */
  function check(val) {
    if (val === null || val === undefined) {
      return true;
    }

    if (typeof val === 'string') {
      // Disallow literal percent characters
      if (val.includes('%') || val.includes('٪')) {
        return false;
      }

      // Check all digit sequences in the normalized string
      const normalized = normalizeDigits(val);
      const matches = normalized.match(/\d+/g);
      if (matches) {
        for (const match of matches) {
          if (!allowedSet.has(match)) {
            return false;
          }
        }
      }
      return true;
    }

    if (typeof val === 'number') {
      const str = String(Math.round(val));
      return allowedSet.has(str);
    }

    if (Array.isArray(val)) {
      return val.every((item) => check(item));
    }

    if (typeof val === 'object') {
      return Object.values(val).every((item) => check(item));
    }

    return true;
  }

  return check(output);
}
