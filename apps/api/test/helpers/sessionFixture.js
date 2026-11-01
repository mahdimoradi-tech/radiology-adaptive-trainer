import { CLASS_IDS, BUCKETS } from '@radiology/contracts';
import { ImageModel } from '../../src/modules/catalog/model.js';
import { computePublicId } from '../../src/modules/catalog/publicId.js';

export const TEST_SALT = 'fixture-salt-with-at-least-16-characters';

/**
 * Seed MongoDB with fixture catalog images.
 * Default: 3 classes x 3 buckets x 14 images = 126 images.
 *
 * @param {number} [countPerBin=14]
 * @param {string} [salt=TEST_SALT]
 */
export async function seedFixtureImages(countPerBin = 14, salt = TEST_SALT) {
  const images = [];

  for (const c of CLASS_IDS) {
    for (const b of BUCKETS) {
      for (let i = 1; i <= countPerBin; i++) {
        const padded = String(i).padStart(3, '0');
        const id =
          c === 'covid19'
            ? `cohen_${b}_${padded}`
            : c === 'pneumonia'
              ? `kermany_p_${b}_${padded}`
              : `kermany_n_${b}_${padded}`;

        const publicId = computePublicId(id, salt);
        const difficulty = b === 'easy' ? 0.15 : b === 'medium' ? 0.5 : 0.85;
        const confusedWith =
          c === 'normal' ? 'pneumonia' : c === 'covid19' ? 'pneumonia' : 'covid19';

        images.push({
          _id: id,
          publicId,
          filename: `${id}.jpg`,
          trueClass: c,
          source: c === 'covid19' ? 'cohen' : 'kermany',
          difficulty,
          bucket: b,
          confusedWith,
        });
      }
    }
  }

  await ImageModel.insertMany(images);
  return images;
}

/**
 * Deep scan an object or array to verify no diagnostic labels, internal IDs or source leaks exist.
 *
 * @param {any} root
 * @returns {string[]} List of detected leak descriptions
 */
export function scanLeaks(root) {
  const forbiddenKeys = new Set([
    'trueClass',
    'bucket',
    'difficulty',
    'confusedWith',
    'source',
    'imageId',
    'passwordHash',
  ]);

  const forbiddenSubstrings = ['cohen_', 'kermany_', 'figure1_'];
  const violations = [];

  function walk(val, path = '$') {
    if (val === null || val === undefined) return;

    if (typeof val === 'string') {
      for (const sub of forbiddenSubstrings) {
        if (val.toLowerCase().includes(sub)) {
          violations.push(`Forbidden string "${sub}" found in value at ${path}: "${val}"`);
        }
      }
      return;
    }

    if (Array.isArray(val)) {
      val.forEach((item, idx) => walk(item, `${path}[${idx}]`));
      return;
    }

    if (typeof val === 'object') {
      for (const [key, propVal] of Object.entries(val)) {
        if (forbiddenKeys.has(key)) {
          violations.push(`Forbidden key "${key}" found at ${path}.${key}`);
        }
        walk(propVal, `${path}.${key}`);
      }
    }
  }

  walk(root);
  return violations;
}
