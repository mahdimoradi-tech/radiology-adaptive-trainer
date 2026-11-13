import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FORBIDDEN_CONTRAST_PATTERNS = [
  {
    regex: /\btext-(gray|slate|zinc|neutral|stone)-(300|400)\b/,
    desc: 'low-contrast text class (violates WCAG AA 4.5:1; use text-slate-500, text-slate-600, or accessible tokens)',
  },
  {
    regex: /\bplaceholder:text-(gray|slate|zinc|neutral|stone|rose)-(300|400)\b/,
    desc: 'low-contrast placeholder class (violates WCAG AA; use placeholder:text-slate-500 or placeholder:text-rose-500)',
  },
];

/**
 * Scan a single file content for low-contrast class violations
 * @param {string} content
 * @param {string} filePath
 * @returns {Array<{ file: string, line: number, pattern: string, text: string }>}
 */
export function scanContrastFileContent(content, filePath = 'unknown') {
  const violations = [];
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('contrast-ok')) continue;

    for (const { regex, desc } of FORBIDDEN_CONTRAST_PATTERNS) {
      if (regex.test(line)) {
        violations.push({
          file: filePath,
          line: i + 1,
          pattern: desc,
          text: line.trim(),
        });
        break;
      }
    }
  }

  return violations;
}

/**
 * Recursively scan directory for files matching .js, .jsx, .css (excluding test files)
 * @param {string} dir
 * @returns {string[]}
 */
export function getSourceFiles(dir) {
  let files = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name !== 'node_modules' &&
        entry.name !== 'dist' &&
        entry.name !== '.git' &&
        entry.name !== '__tests__'
      ) {
        files = files.concat(getSourceFiles(fullPath));
      }
    } else if (/\.(js|jsx|css)$/.test(entry.name)) {
      if (!entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Main scan function
 * @param {string} targetDir
 * @returns {Array<{ file: string, line: number, pattern: string, text: string }>}
 */
export function runContrastScan(targetDir) {
  const files = getSourceFiles(targetDir);
  let allViolations = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const violations = scanContrastFileContent(content, file);
    allViolations = allViolations.concat(violations);
  }

  return allViolations;
}

// Execute when run as script
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve('apps/web/src');

  const violations = runContrastScan(targetDir);

  if (violations.length > 0) {
    console.error(
      `\n[FAIL] Contrast Violation Check Failed: Found ${violations.length} prohibited low-contrast utility usage(s):\n`,
    );
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}`);
      console.error(`    Pattern: ${v.pattern}`);
      console.error(`    Line: ${v.text}\n`);
    }
    process.exit(1);
  } else {
    console.log(
      `[OK] Contrast Violation Check Passed: All files in ${targetDir} use accessible contrast classes.`,
    );
    process.exit(0);
  }
}
