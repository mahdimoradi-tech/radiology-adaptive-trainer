/**
 * Computes Cohen's Kappa for inter-rater agreement.
 * Accepts either a 2D matrix (number[][]) or a confusion record { [cat1]: { [cat1]: n } }.
 *
 * @param {number[][] | Record<string, Record<string, number>>} table - Confusion matrix
 * @returns {{ kappa: number | null, po: number | null, pe: number | null }}
 */
export function cohenKappa(table) {
  if (!table) {
    return { kappa: null, po: null, pe: null };
  }

  /** @type {number[][]} */
  let matrix = [];

  if (Array.isArray(table)) {
    if (table.length === 0) {
      return { kappa: null, po: null, pe: null };
    }
    matrix = table;
  } else if (typeof table === 'object') {
    const keys = Object.keys(table);
    if (keys.length === 0) {
      return { kappa: null, po: null, pe: null };
    }
    matrix = keys.map((rKey) => keys.map((cKey) => Number(table[rKey]?.[cKey] || 0)));
  }

  const k = matrix.length;
  if (k === 0) {
    return { kappa: null, po: null, pe: null };
  }

  let n = 0;
  let diag = 0;
  const rowSums = new Array(k).fill(0);
  const colSums = new Array(k).fill(0);

  for (let i = 0; i < k; i++) {
    const row = matrix[i] || [];
    for (let j = 0; j < k; j++) {
      const val = Number(row[j] || 0);
      rowSums[i] += val;
      colSums[j] += val;
      n += val;
      if (i === j) {
        diag += val;
      }
    }
  }

  if (n <= 0) {
    return { kappa: null, po: null, pe: null };
  }

  const po = diag / n;

  let peSum = 0;
  for (let i = 0; i < k; i++) {
    peSum += (rowSums[i] * colSums[i]) / (n * n);
  }
  const pe = peSum;

  if (Math.abs(1 - pe) < 1e-9) {
    return {
      kappa: Math.abs(po - pe) < 1e-9 ? 1.0 : 0.0,
      po,
      pe,
    };
  }

  const kappa = (po - pe) / (1 - pe);
  return { kappa, po, pe };
}
