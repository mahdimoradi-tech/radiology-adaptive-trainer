/**
 * Localized formatting helpers for numbers, percentages, and dates
 */
export const fmt = {
  /**
   * Format a numeric value with locale digits
   * @param {number|string} value
   * @param {string} [lang='fa']
   * @returns {string}
   */
  number(value, lang = 'fa') {
    if (value === null || value === undefined || value === '') return '';
    const num = Number(value);
    if (!Number.isFinite(num)) return '';
    const locale = lang?.startsWith('en') ? 'en-US' : 'fa-IR';
    return new Intl.NumberFormat(locale).format(num);
  },

  /**
   * Format a decimal value (e.g. 0.85) as percentage (85%)
   * @param {number|string} value
   * @param {string} [lang='fa']
   * @param {number} [decimals=1]
   * @returns {string}
   */
  percent(value, lang = 'fa', decimals = 1) {
    if (value === null || value === undefined || value === '') return '';
    const num = Number(value);
    if (!Number.isFinite(num)) return '';
    const locale = lang?.startsWith('en') ? 'en-US' : 'fa-IR';
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  },

  /**
   * Format a date into localized calendar (Jalali for Persian)
   * @param {Date|string|number} value
   * @param {string} [lang='fa']
   * @returns {string}
   */
  date(value, lang = 'fa') {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';

    if (lang?.startsWith('en')) {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(d);
    }

    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  },
};
