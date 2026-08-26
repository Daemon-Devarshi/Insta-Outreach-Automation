<div align="center">

# 🤖 Instagram Outreach Automation

**A production-ready, distributed Instagram DM automation engine**  
Built with **Node.js · TypeScript · Playwright · PostgreSQL**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Playwright-1.62-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Compatible-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/ISC)

---

*Send personalized Instagram DMs at scale — with crash recovery, multi-worker safety, CAPTCHA handling, and real-time PostgreSQL tracking.*

</div>

---

A production-ready, distributed Instagram DM automation tool built with **Node.js**, **TypeScript**, and **Playwright**. Uses a **PostgreSQL database queue** to coordinate multiple concurrent workers — each worker claims a batch of 25 pending profiles, sends messages one-by-one, and updates the database in real time.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🗄️ **PostgreSQL Queue** | All targets and statuses live in the database — no CSVs, no local state files |
| 👥 **Multi-Worker Safe** | `FOR UPDATE SKIP LOCKED` ensures multiple runners never process the same profile |
| 🔄 **Crash Recovery** | Active batch checkpointed to `data/working.json` — resumes exactly where it left off |
| 📡 **Real-time Updates** | Each profile is marked `SENT` or `FAILED` immediately after processing |
| 🔁 **Fallback Messaging** | Handles hidden Message buttons via three-dots → Send message fallback |
| 🔐 **2FA / OTP Support** | Pauses and prompts for OTP in the terminal during login challenges |
| 🚨 **CAPTCHA Alert** | Rings system bell and waits up to 5 minutes for manual CAPTCHA solving |
| 📸 **Error Screenshots** | Auto-saves screenshots to `logs/` on failure for easy debugging |
| 🔗 **URL-based Targeting** | Uniqueness enforced on profile URL — `username` field is optional |

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

### Prerequisites

- **Node.js** v18 or higher
- **PostgreSQL** database (local, [Neon](https://neon.tech), Supabase, Railway, or Render)
- **Chromium** (installed automatically by Playwright)

---

### Step 1 — Clone & Install

```bash
git clone https://github.com/learnthusalearner/InstaGram-Outreach-Automation.git
cd InstaGram-Outreach-Automation
npm install
npx playwright install chromium
```

---

### Step 2 — Configure Environment

Copy the example and fill in your credentials:

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

> [!TIP]
> Keep `HEADLESS=false` so you can manually handle OTP prompts and CAPTCHA challenges when Instagram triggers them.

---

### Step 3 — Seed Target Profiles

The `message_queue` table is **auto-created on first run**. Insert your targets using any SQL client (Neon console, pgAdmin, DBeaver, etc.):

```sql
INSERT INTO message_queue (url, message, status)
VALUES
  ('https://www.instagram.com/targetprofile1/', 'Hey! Reaching out from our team 🚀', 'PENDING'),
  ('https://www.instagram.com/targetprofile2/', 'Hey! Reaching out from our team 🚀', 'PENDING');
```

> [!NOTE]
> The `username` column is optional — the scraper extracts the handle from the URL automatically.

---

### Step 4 — Run

```bash
npm run dev
```

Each worker run:
1. Claims the first **25 `PENDING` rows** (concurrent-safe via `SKIP LOCKED`)
2. Sends the DM to each profile one-by-one
3. Updates the status to `SENT` or `FAILED` in real time
4. Exits cleanly when the batch is complete

To run multiple concurrent workers, simply open multiple terminals and run `npm run dev` in each.

---

## 🗄️ Database Schema

The `message_queue` table is auto-created on startup:

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `SERIAL` | auto | Primary key |
| `username` | `VARCHAR(255)` | `NULL` | Optional display name |
| `url` | `TEXT UNIQUE` | — | **Required.** Target Instagram profile URL |
| `message` | `TEXT` | — | The DM text to send |
| `status` | `VARCHAR(50)` | `PENDING` | Current processing state |
| `worker_id` | `VARCHAR(100)` | `NULL` | ID of the claiming worker |
| `error` | `TEXT` | `NULL` | Error detail if `FAILED` |
| `timestamp` | `TIMESTAMPTZ` | `now()` | Row creation time |
| `updated_at` | `TIMESTAMPTZ` | `now()` | Last status update |

---

## 📊 Status Lifecycle

```
PENDING  ──▶  WORKING  ──▶  SENT ✅
                       ╰──▶  FAILED ❌
```

| Status | Meaning |
|---|---|
| `PENDING` | Inserted, waiting to be picked up |
| `WORKING` | Claimed by an active worker (row-locked) |
| `SENT` | DM delivered successfully |
| `FAILED` | Delivery failed — see `error` column for reason |

---

## 📋 Logging & Debugging

| Output | Location |
|---|---|
| Full run log | `logs/automation.log` |
| Error screenshots | `logs/error-<profile>-<timestamp>.png` |
| Active batch checkpoint | `data/working.json` *(auto-deleted after batch)* |

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

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ with TypeScript (`tsx`) |
| Browser Automation | [Playwright](https://playwright.dev/) — Chromium |
| Database | PostgreSQL — compatible with Neon, Supabase, Render, Railway |
| DB Driver | [`pg`](https://node-postgres.com/) (node-postgres) |
| CLI Prompts | [`inquirer`](https://github.com/SBoudrias/Inquirer.js) |
| Environment | [`dotenv`](https://github.com/motdotla/dotenv) |

---

## ⚖️ Disclaimer

> [!WARNING]
> This tool interacts with Instagram through browser automation. Use it responsibly and in accordance with [Instagram's Terms of Service](https://help.instagram.com/581066165581870). Excessive or spam-like usage may result in account restrictions or bans. The authors take no responsibility for misuse.

---

<div align="center">

Made with ❤️ for scalable outreach automation

</div>
