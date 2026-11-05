import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const KB_DIR = path.join(__dirname, 'kb');

/**
 * Simple parser for frontmatter in markdown files.
 * @param {string} raw
 * @returns {{ data: Record<string, any>, content: string }}
 */
export function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { data: {}, content: raw.trim() };
  }

  const yamlBlock = match[1];
  const content = match[2].trim();
  const data = {};

  let currentKey = null;

  for (const line of yamlBlock.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('- ') && currentKey) {
      if (!Array.isArray(data[currentKey])) {
        data[currentKey] = [];
      }
      data[currentKey].push(
        trimmed
          .slice(2)
          .trim()
          .replace(/^['"]|['"]$/g, ''),
      );
      continue;
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx !== -1) {
      const key = trimmed.slice(0, colonIdx).trim();
      const valStr = trimmed.slice(colonIdx + 1).trim();

      if (valStr === '' || valStr === '[]') {
        currentKey = key;
        data[key] = [];
      } else if (valStr === 'false') {
        currentKey = null;
        data[key] = false;
      } else if (valStr === 'true') {
        currentKey = null;
        data[key] = true;
      } else {
        currentKey = null;
        data[key] = valStr.replace(/^['"]|['"]$/g, '');
      }
    }
  }

  return { data, content };
}

let cachedArticles = null;

/**
 * Loads all knowledge-base markdown articles from the kb directory.
 *
 * @param {string} [dir=KB_DIR]
 * @returns {Array<{ slug: string, reviewed: boolean, classes: string[], tags: string[], sources: string[], content: string }>}
 */
export function loadAllKbArticles(dir = KB_DIR) {
  if (cachedArticles && dir === KB_DIR) {
    return cachedArticles;
  }

  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  const articles = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    const { data, content } = parseFrontmatter(raw);

    articles.push({
      slug: data.slug || path.basename(file, '.md'),
      reviewed: Boolean(data.reviewed),
      classes: Array.isArray(data.classes) ? data.classes : [],
      tags: Array.isArray(data.tags) ? data.tags : [],
      sources: Array.isArray(data.sources) ? data.sources : [],
      content,
    });
  }

  if (dir === KB_DIR) {
    cachedArticles = articles;
  }

  return articles;
}

/**
 * Retrieves the top knowledge-base snippets for a given query (classes and optional tags).
 * If a pair query is provided (e.g. ['covid19', 'pneumonia']), the pair article is ranked first.
 *
 * @param {Object} query
 * @param {string[]} [query.classes=[]] - Target disease classes (e.g. ['covid19', 'pneumonia'])
 * @param {string[]} [query.tags=[]] - Target diagnostic tags
 * @param {number} [query.limit=3] - Maximum chunks to return
 * @param {string} [query.kbDir] - Optional directory override for testing
 * @returns {Array<{ slug: string, reviewed: boolean, classes: string[], tags: string[], content: string }>}
 */
export function retrieveKbSnippets({ classes = [], tags = [], limit = 3, kbDir = KB_DIR }) {
  const articles = loadAllKbArticles(kbDir);
  const targetClasses = new Set(classes);
  const targetTags = new Set(tags);

  const scored = articles.map((art) => {
    let score = 0;

    // Exact pair match bonus (when query has multiple classes)
    if (classes.length >= 2) {
      const matchAll = classes.every((c) => art.classes.includes(c));
      if (matchAll && art.classes.length >= 2) {
        score += 100;
      }
    }

    // Exact single class match bonus
    if (classes.length === 1 && art.classes.length === 1 && art.classes[0] === classes[0]) {
      score += 50;
    }

    // Individual class matches and penalties for extraneous classes
    for (const c of art.classes) {
      if (targetClasses.has(c)) {
        score += 10;
      } else {
        score -= 2;
      }
    }

    // Tag matches
    for (const t of art.tags) {
      if (targetTags.has(t)) {
        score += 5;
      }
    }

    return { ...art, score };
  });

  return scored
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ slug, reviewed, classes: cls, tags: tg, content }) => ({
      slug,
      reviewed,
      classes: cls,
      tags: tg,
      content,
    }));
}
