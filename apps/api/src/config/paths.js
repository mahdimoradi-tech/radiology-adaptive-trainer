import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/**
 * Absolute path to the repository root directory
 */
export const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/**
 * Resolve a relative path from the repository root
 * @param {...string} segments
 * @returns {string}
 */
export function resolveRepoPath(...segments) {
  return resolve(REPO_ROOT, ...segments);
}
