import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

const currentBranch = getCurrentBranch();

if (currentBranch === 'main') {
  console.error('\x1b[31m[ERROR] Direct push from "main" branch is forbidden.\x1b[0m');
  console.error('All changes must go through a feature branch and a reviewed pull request.');
  process.exit(1);
}

// In git pre-push hook, stdin contains: <local ref> <local sha1> <remote ref> <remote sha1>
// Only inspect stdin if it is not a TTY and has an active pipe
if (!process.stdin.isTTY) {
  try {
    const input = readFileSync(0, 'utf8');
    const lines = input.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      const parts = line.split(/\s+/);
      const localRef = parts[0] || '';
      const remoteRef = parts[2] || '';
      if (localRef === 'refs/heads/main' || remoteRef === 'refs/heads/main') {
        console.error(
          '\x1b[31m[ERROR] Pushing directly to remote "main" branch is forbidden.\x1b[0m',
        );
        process.exit(1);
      }
    }
  } catch {
    // stdin not readable or empty, continue
  }
}

process.exit(0);
