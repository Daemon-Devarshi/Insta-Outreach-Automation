# How to Run Instagram Message Automation

This guide provides step-by-step instructions to set up and run the Instagram message automation workflow.

---

## 📋 Prerequisites

- **Node.js** (v18 or higher recommended)
- **npm** (comes with Node.js)

---

## 🚀 Quick Start Guide

### Step 1: Open Terminal in Project Directory

Make sure your terminal is inside the `instagram-automation` folder:

```bash
cd instagram-automation
```

### Step 2: Install Dependencies

If you haven't installed dependencies yet, run:

```bash
npm install
```

---

## 📝 Step 3: Prepare Your Input File

Edit or add your target Instagram profiles and personalized messages inside:

```text
data/messages.txt
```

### File Format

Each line must follow this format:

```text
username instagram_profile_url - message_to_send
```

> 💡 **Note:** The separator must be ` - ` (space-hyphen-space). You can safely include hyphens inside your message text. Empty lines are ignored automatically.

### Example `data/messages.txt`:

```text
shreemayi https://www.instagram.com/shreemayireddyy/ - Hi Shreemayi, I'm Pallavi from Team Influight. We'd love to share something with you.
creator2 https://www.instagram.com/creator2/ - Hey! I wanted to connect with you about Influight.
creator3 https://www.instagram.com/creator3/ - Hi! I wanted to share something with you.
```

---

## ⚙️ Step 4: Environment Configuration (Optional)

You can configure optional environment variables inside `.env`:

```env
HEADLESS=false
INSTAGRAM_USERNAME=
INSTAGRAM_PASSWORD=
```

- `HEADLESS=false`: Displays the Playwright browser window (recommended for manual login/verification).
- `HEADLESS=true`: Runs the browser in the background without UI.

---

## ▶️ Step 5: Start the Automation

Run the development script:

```bash
npm run dev
```

### Execution Flow:

1. **CLI Prompts**: Terminal will prompt for your Instagram username and password (unless pre-configured in `.env`).
2. **Browser Launch**: A Playwright Chromium browser will launch.
3. **Session Check**:
   - If a saved session exists in `sessions/`, it reuses it automatically.
   - If not, it performs login.
   - If Instagram requests 2FA or verification, pause and complete it manually in the browser window.
4. **Batch Messaging**:
   - Opens `data/messages.txt`.
   - Processes each profile sequentially using the **same browser instance**.
   - Opens profile → clicks Message → inputs message → clicks Send.
5. **Completion Summary**:
   - Prints final count of successful vs. failed messages.
   - Closes browser gracefully.

---

## 📊 Logs & Screenshots

- **Logs**: Execution details are saved with timestamps in:
  ```text
  logs/automation.log
  ```
- **Error Screenshots**: If sending fails for any profile, a screenshot of the page is automatically captured and saved in:
  ```text
  screenshots/error-<username>-<timestamp>.png
  ```

---

## 🛠️ Troubleshooting

| Issue | Solution |
| :--- | :--- |
| **Login Verification Required** | Ensure `HEADLESS=false` in `.env`. Complete any 2FA/Security Check manually in the browser. The script will proceed once authenticated. |
| **"Message button not found"** | Verify the target profile URL is accessible and allows direct messages. Check the screenshot in `screenshots/`. |
| **Invalid line warning** | Check line format in `data/messages.txt`. Make sure ` - ` separates the header from the message. |
