# Manual Test Run — 2026-11-12

- **Tester:** Mahdi Moradi
- **Target Version:** Pre-release T14 (Batch 4 QA)
- **Environment:**
  - Browser: Google Chrome (Window 1366x768, DevTools Network Preserve Log: ON)
  - API & Web: Localhost (Express 5 on port 4000, Vite React on port 5173)
  - LLM Mode: `LLM_MODE=cache-only` (offline reproducibility with VPN off)
  - Test Accounts:
    - New Resident: `test-resident-1@hospital.test` (password: `Resident123!`)
    - Instructor: `instructor@hospital.test` (password: `InstructorPassword123!`)

---

## Test Execution Matrix (M01 – M38)

| ID | Area | Steps | Expected | Result (PASS / FAIL / SKIP) | Notes / Observed Behavior |
|---|---|---|---|---|---|
| **M01** | Auth | Register a new resident with a valid email and password | Account created, redirected to the resident home | | |
| **M02** | Auth | Register again with the same email | Clear Persian error, no crash, no duplicate | | |
| **M03** | Auth | Register with a weak or empty password / invalid email | Field errors shown, request not accepted | | |
| **M04** | Auth | Log in with a wrong password 6-10 times quickly | Error each time, then rate-limit message (HTTP 429), UI stays usable | | |
| **M05** | Auth | Log out, then press the browser Back button | No private data visible; protected pages redirect to login | | |
| **M06** | Auth | Refresh the page while logged in (F5) | Still logged in on the same page | | |
| **M07** | Authz | As resident open `/instructor` and `/instructor/review` directly | Forbidden page, not instructor data | | |
| **M08** | Authz | As instructor open `/app` pages | Redirected or forbidden, no crash | | |
| **M09** | Authz | Not logged in, open `/app/tests` directly | Redirect to login | | |
| **M10** | Authz | Log in as resident A, log out, log in as resident B in the same tab | B never sees A's data (check lists, report, progress) | | |
| **M11** | Baseline | Start the baseline test | 45 questions, progress indicator correct | | |
| **M12** | Baseline | Answer using keys 1, 2, 3 and Space | Selection and next-question work | | |
| **M13** | Baseline | Refresh in the middle of the test | Same question and same answers kept; questions NOT re-drawn | | |
| **M14** | Baseline | Press browser Back during the test | No broken state; can continue | | |
| **M15** | Baseline | Double-click an option quickly | Only one answer recorded for the question | | |
| **M16** | Baseline | Open the same test in two tabs, answer the same question in both | Second answer rejected or idempotent, no crash | | |
| **M17** | Baseline | Finish all 45 questions | Redirect to report | | |
| **M18** | Baseline | After finishing, try to open the quiz URL again / answer via Back | Cannot answer again | | |
| **M19** | Leak | During the test watch Network responses (questions, images) | No trueClass, bucket, difficulty, confusedWith, source; image URLs opaque; no class names in file names | | |
| **M20** | Report | Open the report | Totals add up to 45; 3x3 matrix sums correctly; per-class rates match your own count for 5 sample answers | | |
| **M21** | Report | Open the LLM explanation for a mistake (cache-only) | Persian text appears; no error banner; works with VPN off | | |
| **M22** | Adaptive | Start the next adaptive test right after baseline | Starts; class mix shifts toward your weak classes (compare counts with the report) | | |
| **M23** | Adaptive | Try to start an adaptive test before finishing the baseline (new account) | Blocked with a clear message | | |
| **M24** | Adaptive | Repeat tests until a class reaches mastery (or use the demo seed) | Mastery shown correctly, no negative counts | | |
| **M25** | Practice | Open targeted practice for a confusion pair | Questions load; feedback shown after answering; no label before answering | | |
| **M26** | Progress | Open the progress page | Chart/history matches the number of finished tests | | |
| **M27** | Education | Open the education page | Content loads, no raw markdown symbols, RTL OK | | |
| **M28** | Instructor | Review panel: approve, reject, edit one question (keys A, R, J, K) | State changes persist after refresh | | |
| **M29** | Instructor | Reject a question, then play as resident | Rejected/pending questions never appear | | |
| **M30** | Instructor | Residents list and one resident detail | Numbers match that resident's tests | | |
| **M31** | Instructor | Catalog page | Counts match (1177 images); confounder disclosure visible | | |
| **M32** | Empty | New instructor/resident with no data: open every list page | Friendly empty states, no blank screen | | |
| **M33** | RTL | Look at every main page in Persian | No text cut, no overlapping, icons/arrows in the right direction | | |
| **M34** | Mobile | DevTools device mode 390x844 on login, quiz, report | Usable without horizontal scroll | | |
| **M35** | Resilience | Stop the API while a page is open and click something | Error message with retry, not a blank page | | |
| **M36** | Resilience | Stop MongoDB, start API | Clear startup error in the terminal (not an endless hang) | | |
| **M37** | Resilience | DevTools Network: Slow 3G while starting a test | Loading states visible, no double submits | | |
| **M38** | Offline | `LLM_MODE=cache-only`, VPN off, run M21, M25, M28 | Everything works; no outbound requests in the API log | | |

---

## Findings Summary
- Total Tests: 38
- PASS: -
- FAIL: -
- SKIP: -
- New entries logged in `docs/qa/BUG-LOG.md`: -
