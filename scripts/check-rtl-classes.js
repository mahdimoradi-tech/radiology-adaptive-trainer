import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FORBIDDEN_PATTERNS = [
  {
    regex: /\b(ml|mr|pl|pr|left|right)-(\d|\[|px\b|auto\b|full\b)/,
    desc: 'physical margin/padding/position (use ms-, me-, ps-, pe-, start-, end-)',
  },
  {
    regex: /\btext-(left|right)\b/,
    desc: 'physical text alignment (use text-start or text-end)',
  },
  {
    regex: /\b(rounded|border)-(l|r)(-|\b)/,
    desc: 'physical border/rounded side (use border-s, border-e, rounded-s-, rounded-e-)',
  },
  {
    regex: /\bfloat-(left|right)\b/,
    desc: 'physical float direction',
  },
  {
    regex: /\bscale-x-/,
    desc: 'horizontal flip (mirroring X-ray or content is forbidden; if intentional on icons use rtl-ok)',
  },
];

/**
 * Scan a single file content for RTL violations
 * @param {string} content
 * @param {string} filePath
 * @returns {Array<{ file: string, line: number, pattern: string, text: string }>}
 */
export function scanFileContent(content, filePath = 'unknown') {
  const violations = [];
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('rtl-ok')) continue;

    for (const { regex, desc } of FORBIDDEN_PATTERNS) {
      if (regex.test(line)) {
        violations.push({
          file: filePath,
          line: i + 1,
          pattern: desc,
          text: line.trim(),
        });
        break; // One violation per line is enough
      }
    }
  }

  return violations;
}

/**
 * Recursively scan directory for files matching .js, .jsx, .css
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
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
        files = files.concat(getSourceFiles(fullPath));
      }
    } else if (/\.(js|jsx|css)$/.test(entry.name)) {
      if (!entry.name.includes('check-rtl-classes.test.')) {
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
export function runScan(targetDir) {
  const files = getSourceFiles(targetDir);
  let allViolations = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const violations = scanFileContent(content, file);
    allViolations = allViolations.concat(violations);
  }

  return allViolations;
}

// Execute when run as script
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve('apps/web/src');

  const violations = runScan(targetDir);

  if (violations.length > 0) {
    console.error(
      `\n[FAIL] RTL Violation Check Failed: Found ${violations.length} prohibited physical utility usage(s):\n`,
    );
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}`);
      console.error(`    Pattern: ${v.pattern}`);
      console.error(`    Line: ${v.text}\n`);
    }
    process.exit(1);
  } else {
    console.log(
      `[OK] RTL Violation Check Passed: All files in ${targetDir} use logical RTL utilities.`,
    );
    process.exit(0);
  }
}
