import { createHmac } from 'node:crypto';

/**
 * Compute opaque 20-character hexadecimal publicId from internal catalog ID and salt
 * @param {string} id
 * @param {string} salt
 * @returns {string}
 */
export function computePublicId(id, salt) {
  if (!id || typeof id !== 'string') {
    throw new Error('Image ID must be a non-empty string');
  }
  if (!salt || typeof salt !== 'string' || salt.length < 16) {
    throw new Error('Public ID salt must be a string of at least 16 characters');
  }

  return createHmac('sha256', salt).update(id).digest('hex').slice(0, 20);
}
