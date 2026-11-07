# Pre-Defense Technical Checklist (Day-Before & Presentation Day)

Use this checklist the evening before and 30 minutes prior to the thesis defense presentation to ensure zero unexpected technical surprises.

---

## 1. Laptop & Hardware Health

- [ ] **Power Supply:** Presentation laptop charger packed and plugged in during the presentation.
- [ ] **Power Settings:** Windows power plan set to "High performance"; screen sleep and system sleep set to "Never (when plugged in)".
- [ ] **Display & Projection:** Test HDMI / USB-C projection output. Resolution set to 1920x1080 (100% DPI scaling recommended).
- [ ] **Notifications:** Windows "Focus Assist / Do Not Disturb" enabled to suppress popup banners.

---

## 2. Network & Offline Security

- [ ] **VPN Disabled:** Disconnect all VPN connections (OpenVPN, Cisco AnyConnect, v2ray, etc.) so localhost network traffic (`127.0.0.1`) routes without interference.
- [ ] **Offline Execution Guarantee:** Verify `.env` contains:
  ```properties
  LLM_MODE=cache-only
  NODE_ENV=development
  ```
  *(Confirms that the platform makes zero external HTTP requests to Google AI Studio and functions seamlessly even if the presentation room has no Wi-Fi).*

---

## 3. Database & Local Services

- [ ] **MongoDB Service Active:** Open PowerShell as Administrator and verify local MongoDB Community Server 8 is running:
  ```powershell
  Get-Service -Name MongoDB
  ```
  If stopped, run: `Start-Service -Name MongoDB`.
- [ ] **Fresh Database Import Sequence:** Execute the clean database seeding pipeline in order:
  ```powershell
  npm run seed:catalog -w @radiology/api
  npm run create-instructor -w @radiology/api -- --defaults
  npm run bank:import -w @radiology/api
  npm run llm:cache:import -w @radiology/api
  npm run demo:seed -w @radiology/api
  ```
- [ ] **Database Integrity Check:** Verify the demo trainee exists:
  - Email: `demo.resident@example.com`
  - Sessions: Exactly 4 historical completed sessions present.

---

## 4. Browser Profiles & UI Stance

- [ ] **Two Dedicated Browser Profiles:**
  - **Profile A (Resident):** Google Chrome main profile, logged in as `demo.resident@example.com`.
  - **Profile B (Instructor):** Incognito window or second Chrome profile, logged in as `instructor@hospital.test`.
  *(Prevents session cookie collision between trainee and instructor roles).*
- [ ] **Zoom & Font Rendering:** Browser zoom set to 100%. Persian Vazirmatn font rendered crisply in Right-to-Left (RTL) orientation.
- [ ] **Developer Tools:** Clean DevTools console (F12) with zero uncaught JavaScript errors.

---

## 5. Development Server Runner

- [ ] Start the platform using the concurrent runner:
  ```powershell
  npm run dev
  ```
- [ ] Verify both endpoints respond:
  - Backend API: `http://127.0.0.1:4000/api/health` returns `{ "status": "ok", "db": "up" }`.
  - Frontend Web: `http://127.0.0.1:5173/` renders the login screen.

---

## 6. Backups & Disaster Recovery

- [ ] **Offline Screen Recording:** High-definition video recording of the entire 12-minute walkthrough stored locally on the Desktop (in case of projector hardware failure).
- [ ] **Standalone Backup Archive:** Repository zip archive copied to an external USB flash drive:
  ```powershell
  git archive --format=zip -o radiology-adaptive-trainer-backup.zip HEAD
  ```
- [ ] **Printed Evaluation Summary:** Hardcopy or offline PDF of `docs/EVALUATION.md` available for reference during committee questions.
