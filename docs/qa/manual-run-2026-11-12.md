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
| **M01** | Auth | Register a new resident with a valid email and password | Account created, redirected to the resident home | **PASS** | ثبت‌نام موفق و انتقال به داشبورد |
| **M02** | Auth | Register again with the same email | Clear Persian error, no crash, no duplicate | **PASS** | پیام خطای شفاف فارسی |
| **M03** | Auth | Register with a weak or empty password / invalid email | Field errors shown, request not accepted | **PASS** | خطای اعتبارسنجی فیلدها |
| **M04** | Auth | Log in with a wrong password 6-10 times quickly | Error each time, then rate-limit message (HTTP 429), UI stays usable | **PASS** | فعال‌سازی محدودیت نرخ ۴۲۹ |
| **M05** | Auth | Log out, then press the browser Back button | No private data visible; protected pages redirect to login | **PASS** | خروج و هدایت به لاگین در صورت بازگشت |
| **M06** | Auth | Refresh the page while logged in (F5) | Still logged in on the same page | **PASS** | حفظ نشست کاربری |
| **M07** | Authz | As resident open `/instructor` and `/instructor/review` directly | Forbidden page, not instructor data | **PASS** | صفحه ۴۰۳ بدون دسترسی به داده مدرس |
| **M08** | Authz | As instructor open `/app` pages | Redirected or forbidden, no crash | **PASS** | کرش نکرد و دسترسی مسدود شد؛ دکمه بازگشت به صفحه اصلی فعال نبود |
| **M09** | Authz | Not logged in, open `/app/tests` directly | Redirect to login | **PASS** | ریدایرکت به صفحه ورود |
| **M10** | Authz | Log in as resident A, log out, log in as resident B in the same tab | B never sees A's data (check lists, report, progress) | **PASS** | تفکیک کامل داده‌های دو کاربر |
| **M11** | Baseline | Start the baseline test | 45 questions, progress indicator correct | **PASS** | آزمون ۴۵ سؤاله با نوار پیشرفت صحیح |
| **M12** | Baseline | Answer using keys 1, 2, 3 and Space | Selection and next-question work | **PASS** | کلیدهای میانبر کار می‌کنند؛ بار اول زدن دکمه بعدی لازم بود |
| **M13** | Baseline | Refresh in the middle of the test | Same question and same answers kept; questions NOT re-drawn | **PASS** | حفظ کامل پاسخ‌ها و سؤال بدون بازکشی مجدد |
| **M14** | Baseline | Press browser Back during the test | No broken state; can continue | **PASS** | وضعیت بدون شکست حفظ شد |
| **M15** | Baseline | Double-click an option quickly | Only one answer recorded for the question | **PASS** | ثبت ایمن یک پاسخ بدون دابل‌ثبت |
| **M16** | Baseline | Open the same test in two tabs, answer the same question in both | Second answer rejected or idempotent, no crash | **PASS** | ثبت ایدempotent بدون کرش |
| **M17** | Baseline | Finish all 45 questions | Redirect to report | **PASS** | هدایت خودکار به صفحه کارنامه |
| **M18** | Baseline | After finishing, try to open the quiz URL again / answer via Back | Cannot answer again | **PASS** | پاسخ مجدد مسدود است |
| **M19** | Leak | During the test watch Network responses (questions, images) | No trueClass, bucket, difficulty, confusedWith, source; image URLs opaque; no class names in file names | **PASS** | عدم وجود برچسب‌های تشخیصی و نام دیتاست‌ها در پاسخ‌های شبکه |
| **M20** | Report | Open the report | Totals add up to 45; 3x3 matrix sums correctly; per-class rates match your own count for 5 sample answers | **PASS** | جمع ماتریس ۴۵ و درصدها دقیق |
| **M21** | Report | Open the LLM explanation for a mistake (cache-only) | Persian text appears; no error banner; works with VPN off | **PASS** | نمایش توضیحات فارسی از کش بدون خطا |
| **M22** | Adaptive | Start the next adaptive test right after baseline | Starts; class mix shifts toward your weak classes (compare counts with the report) | **PASS** | آزمون به طور خودکار انطباقی شد |
| **M23** | Adaptive | Try to start an adaptive test before finishing the baseline (new account) | Blocked with a clear message | **FAIL** | سیستم اصلاً نوع آزمون را نمی‌پرسد؛ از ابتدا مستقیماً خط پایه ایجاد می‌شود و بعد از آن انطباقی (رفتار خودکار بک‌اند) |
| **M24** | Adaptive | Repeat tests until a class reaches mastery (or use the demo seed) | Mastery shown correctly, no negative counts | **PASS** | نشان تسلط به درستی نمایش داده شد |
| **M25** | Practice | Open targeted practice for a confusion pair | Questions load; feedback shown after answering; no label before answering | **PASS** | بارگذاری سؤالات و نمایش فیدبک صرفاً پس از پاسخ |
| **M26** | Progress | Open the progress page | Chart/history matches the number of finished tests | **PASS** | نمودار و تاریخچه با تعداد آزمون‌ها همخوان است |
| **M27** | Education | Open the education page | Content loads, no raw markdown symbols, RTL OK | **PASS** | محتوا بدون مارک‌داون خام و راست‌چین |
| **M28** | Instructor | Review panel: approve, reject, edit one question (keys A, R, J, K) | State changes persist after refresh | **PASS** | کلیدهای میانبر و ماندگاری تغییرات پس از رفرش |
| **M29** | Instructor | Reject a question, then play as resident | Rejected/pending questions never appear | **PASS** | عدم نمایش سؤالات رد شده به رزیدنت |
| **M30** | Instructor | Residents list and one resident detail | Numbers match that resident's tests | **PASS** | آمار و جزئیات منطبق بر آزمون‌ها |
| **M31** | Instructor | Catalog page | Counts match (1177 images); confounder disclosure visible | **PASS** | آمار ۱۱۷۷ تصویر و شفاف‌سازی سوگیری |
| **M32** | Empty | New instructor/resident with no data: open every list page | Friendly empty states, no blank screen | **PASS** | وضعیت‌های خالی بدون صفحه سفید |
| **M33** | RTL | Look at every main page in Persian | No text cut, no overlapping, icons/arrows in the right direction | **FAIL** | متون اضافه، بج‌های تسک‌ها و فاصله‌گذاری‌ها نیازمند اصلاح (مربوط به تسک T15 UI Polish) |
| **M34** | Mobile | DevTools device mode 390x844 on login, quiz, report | Usable without horizontal scroll | **FAIL** | در ابعاد موبایل اسکرول افقی می‌خورد (مربوط به تسک T15 UI Polish) |
| **M35** | Resilience | Stop the API while a page is open and click something | Error message with retry, not a blank page | **PASS** | پیام خطا همراه با تلاش مجدد (بهبود لحن در T15) |
| **M36** | Resilience | Stop MongoDB, start API | Clear startup error in the terminal (not an endless hang) | **PASS** | خطای شفاف پایگاه‌داده بدون هنگ |
| **M37** | Resilience | DevTools Network: Slow 3G while starting a test | Loading states visible, no double submits | **PASS** | وضعیت لودینگ و جلوگیری از دابل‌سابمیت |
| **M38** | Offline | `LLM_MODE=cache-only`, VPN off, run M21, M25, M28 | Everything works; no outbound requests in the API log | **PASS** | کارکرد کامل آفلاین در حالت cache-only |

---

## Findings Summary
- Total Tests: 38
- PASS: 35
- FAIL: 3 (M23: رفتار خودکار بک‌اند در اجبار خط پایه، M33: پولیش متون و فاصله‌ها در T15، M34: اسکرول افقی موبایل در T15)
- SKIP: 0
- New entries logged in `docs/qa/BUG-LOG.md`: BUG-005 (M08: دکمه بازگشت در خطای دسترسی), BUG-006 (M34: اسکرول افقی موبایل), BUG-007 (M23: شفاف‌سازی پیام انتخاب نوع آزمون)
