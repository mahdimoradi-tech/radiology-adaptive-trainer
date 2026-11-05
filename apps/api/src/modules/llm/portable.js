import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LlmCache } from './cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const DEFAULT_PORTABLE_PATH = path.resolve(
  __dirname,
  '../../../seed/llm-cache.portable.json',
);

/**
 * Exports all portable cache entries to a JSON seed file.
 *
 * @param {string} [outputPath=DEFAULT_PORTABLE_PATH]
 * @returns {Promise<{ exportedCount: number, outputPath: string }>}
 */
export async function exportPortableCache(outputPath = DEFAULT_PORTABLE_PATH) {
  const docs = await LlmCache.find({ portable: true }).sort({ key: 1 }).lean();

  const serialized = docs.map((d) => ({
    key: d.key,
    promptId: d.promptId,
    version: d.version,
    lang: d.lang,
    portable: true,
    input: d.input,
    response: d.response,
  }));

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(serialized, null, 2), 'utf8');

  return {
    exportedCount: serialized.length,
    outputPath,
  };
}

/**
 * Imports portable cache entries from a JSON seed file into the database.
 *
 * @param {string} [inputPath=DEFAULT_PORTABLE_PATH]
 * @returns {Promise<{ importedCount: number, inputPath: string }>}
 */
export async function importPortableCache(inputPath = DEFAULT_PORTABLE_PATH) {
  if (!fs.existsSync(inputPath)) {
    return { importedCount: 0, inputPath };
  }

  const raw = fs.readFileSync(inputPath, 'utf8');
  const entries = JSON.parse(raw);

  if (!Array.isArray(entries)) {
    throw new Error('Portable cache file must contain an array of cache entries');
  }

  let count = 0;
  for (const entry of entries) {
    if (!entry.key || !entry.promptId || !entry.response) {
      continue;
    }

    await LlmCache.updateOne(
      { key: entry.key },
      {
        $set: {
          key: entry.key,
          promptId: entry.promptId,
          version: entry.version || 'v1',
          lang: entry.lang || 'fa',
          portable: true,
          input: entry.input,
          response: entry.response,
        },
      },
      { upsert: true },
    );
    count++;
  }

  return {
    importedCount: count,
    inputPath,
  };
}
