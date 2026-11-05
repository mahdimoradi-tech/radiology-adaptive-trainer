/**
 * @fileoverview Seeded stratified sampler for the T08a analysis set.
 *
 * Rules (from task file):
 *   - Total: 120 images, 40 per class.
 *   - covid19:  all 5 medium+hard + 35 easy (split cohen/figure1 by largest remainder).
 *   - pneumonia: 14 hard + 13 medium + 13 easy.
 *   - normal:    14 hard + 13 medium + 13 easy.
 *   - Sampling seed: "analysis-v1".
 *   - Fails loudly if any stratum has too few images.
 *
 * This module is a PURE function over a list of image metadata objects.
 * It does NOT import the engine, does NOT do any I/O.
 */

// ---------------------------------------------------------------------------
// Tiny seeded PRNG — Mulberry32 (same family as the engine uses, no shared import)
// ---------------------------------------------------------------------------

/**
 * Create a seeded pseudo-random number generator (Mulberry32).
 * @param {number} seed - 32-bit integer seed
 * @returns {() => number} Function returning a float in [0, 1)
 */
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Convert a string seed to a 32-bit integer via a simple hash.
 * @param {string} str
 * @returns {number}
 */
function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Shuffle an array IN-PLACE using the provided PRNG (Fisher-Yates).
 * @template T
 * @param {T[]} arr
 * @param {() => number} rng
 * @returns {T[]}
 */
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Largest-remainder allocation (Hamilton-Hare)
// Splits a total N among groups by proportion, guarantees integer sum = N.
// ---------------------------------------------------------------------------

/**
 * @param {{ weight: number }[]} groups
 * @param {number} total
 * @returns {number[]}
 */
function largestRemainder(groups, total) {
  const totalWeight = groups.reduce((s, g) => s + g.weight, 0);
  const floats = groups.map((g) => (g.weight / totalWeight) * total);
  const floors = floats.map(Math.floor);
  const remainders = floats.map((f, i) => f - floors[i]);
  let rem = total - floors.reduce((s, f) => s + f, 0);

  // Sort indices by descending remainder to distribute leftover seats
  const order = remainders
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r - a.r)
    .map((x) => x.i);

  for (let k = 0; k < rem; k++) floors[order[k]]++;
  return floors;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Metadata shape expected from the caller (subset of the Image Mongoose doc).
 * @typedef {Object} ImageMeta
 * @property {string} _id - Catalog image id
 * @property {'covid19' | 'pneumonia' | 'normal'} trueClass
 * @property {'easy' | 'medium' | 'hard'} bucket
 * @property {string} source - e.g. "cohen", "figure1", "kermany"
 */

/**
 * One entry in the analysis set seed file.
 * @typedef {Object} AnalysisSetEntry
 * @property {string} imageId
 * @property {'covid19' | 'pneumonia' | 'normal'} trueClass
 * @property {'easy' | 'medium' | 'hard'} bucket
 * @property {string} source
 * @property {string} stratum - e.g. "covid19:easy:cohen"
 */

/**
 * Select 120 images for the T08a analysis set using a fixed seeded strategy.
 *
 * @param {ImageMeta[]} allImages - Full catalog from MongoDB (or test fixture)
 * @param {object} [opts]
 * @param {string} [opts.seed='analysis-v1'] - PRNG seed
 * @param {number} [opts.perClass=40] - Images per class (default 40)
 * @returns {AnalysisSetEntry[]} Deterministic selection of images
 * @throws {Error} If any required stratum has too few images
 */
export function selectAnalysisSet(allImages, opts = {}) {
  const seed = opts.seed ?? 'analysis-v1';
  const perClass = opts.perClass ?? 40;
  const rng = mulberry32(hashSeed(seed));

  // Group images by class then bucket then source
  /** @type {Map<string, ImageMeta[]>} */
  const byKey = new Map();
  for (const img of allImages) {
    const key = `${img.trueClass}:${img.bucket}:${img.source}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(img);
  }

  // Shuffle each stratum independently (same seed, deterministic)
  for (const [, imgs] of byKey) shuffle(imgs, rng);

  /** @type {AnalysisSetEntry[]} */
  const selected = [];

  // -------------------------------------------------------------------------
  // covid19: all medium+hard (up to perClass), then easy to fill remainder
  // -------------------------------------------------------------------------
  {
    const cls = 'covid19';
    const hard = _getStratum(byKey, cls, 'hard');
    const medium = _getStratum(byKey, cls, 'medium');
    const easyAll = _getAllEasy(byKey, cls); // may span cohen + figure1

    const fixedCount = hard.length + medium.length;
    if (fixedCount > perClass) {
      throw new Error(`covid19 medium+hard count (${fixedCount}) exceeds perClass (${perClass})`);
    }
    const easyNeeded = perClass - fixedCount;

    // Split easyNeeded between sources by largest-remainder proportional to available easy images
    const easySources = _groupBySource(easyAll);
    const sourceNames = Object.keys(easySources);

    // Validate we have enough easy images total
    const totalEasyAvailable = easyAll.length;
    if (totalEasyAvailable < easyNeeded) {
      throw new Error(
        `covid19 easy stratum too small: need ${easyNeeded}, have ${totalEasyAvailable}`,
      );
    }

    const sourceGroups = sourceNames.map((s) => ({
      source: s,
      weight: easySources[s].length,
      images: easySources[s],
    }));
    const counts = largestRemainder(sourceGroups, easyNeeded);

    for (let i = 0; i < sourceGroups.length; i++) {
      const take = counts[i];
      const imgs = sourceGroups[i].images;
      if (imgs.length < take) {
        throw new Error(
          `covid19 easy/${sourceGroups[i].source} stratum too small: need ${take}, have ${imgs.length}`,
        );
      }
      for (let j = 0; j < take; j++) {
        selected.push(_entry(imgs[j], cls, 'easy', sourceGroups[i].source));
      }
    }

    for (const img of medium) selected.push(_entry(img, cls, 'medium', img.source));
    for (const img of hard) selected.push(_entry(img, cls, 'hard', img.source));
  }

  // -------------------------------------------------------------------------
  // pneumonia + normal: 14 hard, 13 medium, 13 easy
  // -------------------------------------------------------------------------
  for (const cls of /** @type {const} */ (['pneumonia', 'normal'])) {
    const hardN = 14;
    const medN = 13;
    const easyN = perClass - hardN - medN; // 13

    for (const [bucket, need] of /** @type {[string, number][]} */ ([
      ['hard', hardN],
      ['medium', medN],
      ['easy', easyN],
    ])) {
      const imgs = _getAllBucket(byKey, cls, bucket);
      if (imgs.length < need) {
        throw new Error(`${cls} ${bucket} stratum too small: need ${need}, have ${imgs.length}`);
      }
      for (let i = 0; i < need; i++) {
        selected.push(_entry(imgs[i], cls, bucket, imgs[i].source));
      }
    }
  }

  return selected;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * @param {Map<string, ImageMeta[]>} byKey
 * @param {string} cls
 * @param {string} bucket
 * @returns {ImageMeta[]}
 */
function _getStratum(byKey, cls, bucket) {
  // Collect across all sources for this class+bucket
  return _getAllBucket(byKey, cls, bucket);
}

/**
 * Collect all images for a class+bucket, across all sources.
 * @param {Map<string, ImageMeta[]>} byKey
 * @param {string} cls
 * @param {string} bucket
 * @returns {ImageMeta[]}
 */
function _getAllBucket(byKey, cls, bucket) {
  const result = [];
  for (const [key, imgs] of byKey) {
    const [c, b] = key.split(':');
    if (c === cls && b === bucket) result.push(...imgs);
  }
  return result;
}

/**
 * Collect all easy images for a class across all sources.
 * @param {Map<string, ImageMeta[]>} byKey
 * @param {string} cls
 * @returns {ImageMeta[]}
 */
function _getAllEasy(byKey, cls) {
  return _getAllBucket(byKey, cls, 'easy');
}

/**
 * Group an array of images by source.
 * @param {ImageMeta[]} imgs
 * @returns {Record<string, ImageMeta[]>}
 */
function _groupBySource(imgs) {
  /** @type {Record<string, ImageMeta[]>} */
  const groups = {};
  for (const img of imgs) {
    if (!groups[img.source]) groups[img.source] = [];
    groups[img.source].push(img);
  }
  return groups;
}

/**
 * Build an AnalysisSetEntry from an image meta.
 * @param {ImageMeta} img
 * @param {string} trueClass
 * @param {string} bucket
 * @param {string} source
 * @returns {AnalysisSetEntry}
 */
function _entry(img, trueClass, bucket, source) {
  return {
    imageId: img._id,
    trueClass,
    bucket,
    source,
    stratum: `${trueClass}:${bucket}:${source}`,
  };
}
