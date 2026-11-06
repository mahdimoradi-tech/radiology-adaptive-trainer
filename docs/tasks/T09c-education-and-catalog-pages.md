# T09c - Education page and instructor catalog page (OPTIONAL, priority P2)

- Branch: `feat/T09c-education-catalog`
- Depends on: T09a merged. Do this ONLY if you are at least one day ahead of the calendar in BATCH3-NOTES.md.
- Estimate: about 3 h. If you are behind, do ONLY Step 0 (about 20 min).
- Skills to read first: persian-rtl-ui, api-conventions. ADR 0005 (difficulty and catalog policy), 0009. Also docs/DOMAIN.md and the knowledge base files under apps/api (T07).

## Step 0 - Fallback (always possible)
If time is short: remove the two remaining placeholder routes (`/education`, `/instructor/catalog`) and their nav items from router.jsx and the nav components, delete `PlaceholderPage.jsx` and its usages/tests if nothing else uses it, and make sure `Select-String -Path apps/web/src -Pattern PlaceholderPage -Recurse` returns nothing. Tests must still pass.
Commit: `chore(web): remove unused placeholder routes`. Then stop.

## Step 1 - Resident Education page (`/education`)
Static page, no API. Sections: (a) what this tool is, that it is educational only and never a diagnosis; (b) how the adaptive cycle works (test -> errors per class -> next test focuses on weak classes -> practice -> repeat until each class >= 80%); (c) how to read the report (FP/FN in plain Persian). 
MEDICAL CONTENT RULE: do not write medical claims yourself. If you want a description of the three classes or of imaging signs, copy ONLY text that already exists in the repo knowledge base / closed vocabulary and list the source file for each paragraph in the PR body. Mahdi must review that text. If no suitable text exists, omit the section.
Leakage rule: generic knowledge only, nothing that depends on a specific image.
Tests: renders sections; no API calls; RTL class check passes.
Commit: `feat(web): add education page`.

## Step 2 - Instructor Catalog page (`/instructor/catalog`)
Data: GET /api/catalog/stats and GET /api/catalog/images (filters `trueClass`, `bucket`, `source`, `page`, `pageSize`). Read the contracts first.
- Top: distribution tables (class x bucket, class x source) from stats.
- A visible note (Persian, i18n) taken from ADR 0005: classes are confounded with data sources and COVID-19 has few images, so difficulty partly reflects source/age; the catalog is capped per class.
- Table with the three filters and pagination. Thumbnails only if the list items already contain an image URL (lazy loading); otherwise show ids and labels only.
- Instructor-only (existing guard). Residents must never reach it (extend the guard test).
Tests: stats render; filters change the query params; pagination; empty and error states; resident forbidden.
Commit: `feat(web): add instructor catalog page`.

## Step 3 - Docs
docs/PROGRESS.md row; README (feature list). Commit: `docs: record T09c`.

## Verification
```powershell
npm run lint
npm test
Select-String -Path apps/web/src -Pattern PlaceholderPage -Recurse
```
Last command must print nothing.

## Acceptance criteria
No placeholder page remains anywhere. All tests/lint pass. No new dependency.

## Out of scope
Editing the catalog, uploading images, charts library, English translation beyond existing conventions.
