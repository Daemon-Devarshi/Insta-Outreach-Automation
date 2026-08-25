# Insta Outreach Automation

A production-ready, distributed Instagram DM automation tool built with **Node.js**, **TypeScript**, and **Playwright**. Uses a **PostgreSQL database queue** to coordinate multiple concurrent workers — each worker claims a batch of 25 pending profiles, sends messages one-by-one, and updates the database in real time.

---

## ✨ Key Features

- 🗄️ **PostgreSQL Queue** — All targets and statuses live in the database. No CSVs, no local state files.
- 👥 **Multi-Worker Safe** — Uses `FOR UPDATE SKIP LOCKED` transactions so multiple runners never process the same profile twice.
- 🔄 **Crash Recovery** — Active batch is checkpointed to `data/working.json`. If the runner crashes, resuming picks up exactly where it left off.
- 📡 **Real-time Status Updates** — Each profile is marked `SENT` or `FAILED` in the DB immediately after processing.
- 🔁 **Fallback Message Button** — Handles profiles where the standard Message button is hidden (uses three-dots → Send message fallback).
- 🔐 **2FA / OTP Support** — Pauses and prompts for OTP in the terminal during login challenges.
- 🚨 **CAPTCHA Alert** — Rings audio system bell and waits up to 5 minutes for manual CAPTCHA solving.
- 📸 **Error Screenshots** — Saves screenshots to `logs/` on failure for easy debugging.
- 🔗 **URL-based Targeting** — Uniqueness is enforced on the profile URL. `username` is optional.

---

## 🗺️ Architecture Flow

```mermaid
graph TD
    A[Start: npm run dev] --> B[Connect to PostgreSQL]
    B --> C[Login to Instagram]
    C --> D{data/working.json exists?}
    D -- Yes --> E[Resume existing batch]
    D -- No --> F[Fetch 25 PENDING rows from DB\nFOR UPDATE SKIP LOCKED]
    F --> G[Mark rows as WORKING in DB]
    G --> H[Save batch to data/working.json]
    E --> I[Process next profile]
    H --> I
    I --> J[Navigate to profile URL]
    J --> K{Message button visible?}
    K -- Yes --> L[Click Message button]
    K -- No --> M[Click three-dots → Send Message]
    L --> N[Type & send message]
    M --> N
    N --> O{Success?}
    O -- Yes --> P[Update DB: SENT]
    O -- No --> Q[Update DB: FAILED\nSave screenshot]
    P --> R{More profiles?}
    Q --> R
    R -- Yes --> I
    R -- No --> S[Delete working.json]
    S --> T[Print summary & Exit]
```

---

## 📂 Project Structure

```text
src/
├── config/
│   ├── env.ts              # Dotenv configuration loader
│   └── constants.ts        # Centralized delays and timeouts
│
├── auth/
│   ├── login.ts            # Multi-path login, OTP & CAPTCHA handler
│   ├── session.ts          # Session detection via cookies & DOM
│   └── auth.types.ts       # TypeScript auth interfaces
│
├── instagram/
│   ├── browser.ts          # Persistent Playwright browser setup
│   ├── profile.ts          # Profile navigation & URL normalization
│   ├── messaging.ts        # DM composer with fallback strategies
│   ├── selectors.ts        # Centralized Instagram DOM selectors
│   └── instagram.types.ts  # Instagram TypeScript interfaces
│
├── automation/
│   ├── orchestrator.ts     # Main loop: DB queue, batch processing, crash recovery
│   ├── workflow.ts         # Profile → Message → Send combined workflow
│   ├── tracker.ts          # PostgreSQL pool, fetchNextBatch, updateStatus
│   └── retry.ts            # Retry utility
│
├── input/
│   ├── cli.ts              # CLI credential prompts
│   └── prompts.ts          # Inquirer prompt configuration
│
├── logging/
│   ├── logger.ts           # Structured logging to logs/automation.log
│   └── screenshots.ts      # Error screenshot capture
│
└── index.ts                # Entrypoint
```

---

## 🛠️ Setup & Installation

### 1. Clone & Install

```bash
git clone https://github.com/kunalsrivastava-dev/Insta-Outreach-Automation.git
cd Insta-Outreach-Automation
npm install
npx playwright install chromium
```

### 2. Configure Environment

Copy the example file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
INSTAGRAM_USERNAME=your_instagram_username
INSTAGRAM_PASSWORD=your_instagram_password
HEADLESS=false
DATABASE_URL=postgresql://username:password@host:5432/dbname?sslmode=require
```

> 💡 Keep `HEADLESS=false` so you can handle OTP and CAPTCHA manually when needed.

### 3. Add Targets to the Database

The table is **auto-created on first run**. Insert your target profiles directly into the `message_queue` table using any SQL client (e.g. Neon console, pgAdmin, DBeaver):

```sql
INSERT INTO message_queue (url, message, status)
VALUES
  ('https://www.instagram.com/targetprofile1/', 'Hi! Reaching out from Team Influight 🚀', 'PENDING'),
  ('https://www.instagram.com/targetprofile2/', 'Hi! Reaching out from Team Influight 🚀', 'PENDING');
```

> The `username` column is optional — the scraper will extract the handle from the URL automatically if not provided.

### 4. Run

```bash
npm run dev
```

Each worker run:
1. Claims the first 25 `PENDING` rows (safe for concurrent workers)
2. Sends the DM to each profile
3. Updates the status to `SENT` or `FAILED` in real time
4. Exits when the batch is complete

---

## 🗄️ Database Schema

The `message_queue` table is auto-created on startup:

| Column | Type | Description |
|---|---|---|
| `id` | SERIAL PK | Auto-increment primary key |
| `username` | VARCHAR(255) | Optional display name |
| `url` | TEXT UNIQUE | **Required.** Target Instagram profile URL |
| `message` | TEXT | Message to send |
| `status` | VARCHAR(50) | `PENDING` → `WORKING` → `SENT` / `FAILED` |
| `worker_id` | VARCHAR(100) | ID of the worker currently processing this row |
| `error` | TEXT | Error message if status is `FAILED` |
| `timestamp` | TIMESTAMPTZ | Row creation time |
| `updated_at` | TIMESTAMPTZ | Last status update time |

---

## 📊 Status Lifecycle

```
PENDING  →  WORKING  →  SENT
                     ↘  FAILED
```

- **PENDING** — Inserted by you, waiting to be picked up
- **WORKING** — Claimed by an active worker (locked)
- **SENT** — Message delivered successfully
- **FAILED** — Message failed; see `error` column for reason

---

## 📋 Logging & Debugging

| Output | Location |
|---|---|
| Run log | `logs/automation.log` |
| Error screenshots | `logs/error-<profile>-<timestamp>.png` |
| Active batch checkpoint | `data/working.json` (auto-deleted after batch) |

---

## ⚠️ Edge Cases Handled

| Scenario | Solution |
|---|---|
| Standard Message button hidden | Falls back to three-dots → Send message option |
| Instagram 2FA / OTP triggered | Pauses and prompts for OTP in terminal |
| CAPTCHA / security check | Rings system bell alarm, waits up to 5 minutes for manual solve |
| Cookie consent banners | Auto-dismissed before any interaction |
| Multiple workers running | `FOR UPDATE SKIP LOCKED` prevents double-processing |
| Worker crash mid-batch | `data/working.json` checkpoint enables automatic resume |
| URL missing `https://` prefix | Auto-normalized before navigation |

---

## 📦 Tech Stack

- **Runtime**: Node.js + TypeScript (`tsx`)
- **Browser Automation**: [Playwright](https://playwright.dev/)
- **Database**: PostgreSQL (compatible with [Neon](https://neon.tech), Supabase, Render, Railway)
- **DB Driver**: `pg` (node-postgres)
