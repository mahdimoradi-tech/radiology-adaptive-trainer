import { describe, it, expect } from 'vitest';
import fa from '../locales/fa.json';
import en from '../locales/en.json';

/**
 * Collect all dot-separated key paths in a nested JSON object
 * @param {Record<string, unknown>} obj
 * @param {string} prefix
 * @returns {string[]}
 */
function getDeepKeys(obj, prefix = '') {
  let keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys = keys.concat(getDeepKeys(value, fullPath));
    } else {
      keys.push(fullPath);
    }
  }
  return keys.sort();
}

describe('i18n Localization Key Parity', () => {
  it('guarantees identical key parity between fa.json and en.json', () => {
    const faKeys = getDeepKeys(fa);
    const enKeys = getDeepKeys(en);

    const missingInEn = faKeys.filter((k) => !enKeys.includes(k));
    const missingInFa = enKeys.filter((k) => !faKeys.includes(k));

    expect(missingInEn, 'Keys present in fa.json but missing in en.json').toEqual([]);
    expect(missingInFa, 'Keys present in en.json but missing in fa.json').toEqual([]);
    expect(faKeys.length).toBeGreaterThan(30);
    expect(faKeys).toEqual(enKeys);
  });
});
