/**
 * 32-bit FNV-1a string hash to convert string seeds to positive integers.
 *
 * @param {string} str - String seed
 * @returns {number} 32-bit unsigned integer
 */
function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Seeded pseudo-random number generator (Mulberry32).
 *
 * @param {number|string} [seed=123456789] - Initial seed
 * @returns {{ next: () => number, shuffle: <T>(array: T[]) => T[] }}
 */
export function createRng(seed = 123456789) {
  let s = typeof seed === 'string' ? hashString(seed) : Number(seed) >>> 0 || 123456789;

  return {
    /**
     * Generate next pseudo-random floating point number in [0, 1).
     * @returns {number}
     */
    next() {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },

    /**
     * In-place Fisher-Yates array shuffle.
     * @template T
     * @param {T[]} array - Array to shuffle
     * @returns {T[]} Shuffled array
     */
    shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        const temp = array[i];
        array[i] = array[j];
        array[j] = temp;
      }
      return array;
    },
  };
}
