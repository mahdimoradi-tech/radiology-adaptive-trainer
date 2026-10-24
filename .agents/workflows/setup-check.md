# /setup-check

Read-only health check of THIS machine. Run each line, show real output, and summarize in Persian with a table: tool | required | found | OK?
- `node -v` (must start with v24), `npm -v`
- `git --version`, `git config user.name`, `git config user.email`
- `gh --version`, `gh auth status`
- `mongosh --version` and `mongosh "mongodb://127.0.0.1:27017" --quiet --eval "db.runCommand({ping:1}).ok"` (must print 1)
- `python --version` (needed from T01; 3.12.x), `uv --version` (needed from T01)
- PowerShell version: `$PSVersionTable.PSVersion` (5.1 has no `&&`; prefer PowerShell 7)
- Free disk space on the repo drive (need >= 15 GB for datasets and processed images)
- Does `.env` exist? Check which KEYS are present (names only, NEVER print values): `MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY`.
- Is `docs/reference/paper.pdf` present?
For every failure give the exact fix (what to install, which command) and wait. Install nothing silently.
