import { createBrowser } from "../instagram/browser";
import { login } from "../auth/login";
import { checkIsLoggedIn } from "../auth/session";
import { executeMessageWorkflow } from "./workflow";
import { LoginCredentials } from "../auth/auth.types";
import { logAutomation } from "../logging/logger";
import { captureErrorScreenshot } from "../logging/screenshots";
import { tracker } from "./tracker";
import { loadCsvData, MessageRecord } from "../input/csv";

export async function runAutomation(credentials: LoginCredentials) {
  // Initialize the tracker from data/seen.json
  tracker.init();

  // Load target records from data/*.csv
  const records: MessageRecord[] = loadCsvData();

  if (records.length === 0) {
    console.log("⚠️ No target profiles found to process. Please provide a CSV file in the data/ folder.");
    return;
  }

  console.log(`Loaded ${records.length} target profile(s) from CSV.\n`);

  const { context, page } = await createBrowser();
  console.log("✓ Browser started");

  let successful = 0;
  let skipped = 0;
  let failed = 0;

  try {
    console.log("Checking Instagram session...");
    await page.goto("https://www.instagram.com/", {
      waitUntil: "domcontentloaded",
    });

    await page.waitForTimeout(3000);

    let loggedIn = await checkIsLoggedIn(page);

    if (!loggedIn) {
      console.log("No active session found. Logging in...");
      await login(page, credentials);
      loggedIn = await checkIsLoggedIn(page);
    }

    if (loggedIn) {
      console.log("✓ Session authenticated\n");
    } else {
      console.log("⚠️ Could not verify session. Proceeding...\n");
    }

    console.log(`========================================`);
    console.log(`   Starting Instagram Outreach Loop`);
    console.log(`========================================\n`);

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const displayName = record.username || "profile";

      // 1. Check if already seen in data/seen.json
      if (tracker.isSeen(record.url, record.username)) {
        console.log(`⏭️ [Profile ${i + 1}/${records.length}] ${displayName} (${record.url}) already in seen.json. Skipping.\n`);
        skipped++;
        continue;
      }

      console.log(`[Profile ${i + 1}/${records.length}] Processing ${displayName} (${record.url})...`);

      try {
        await executeMessageWorkflow(page, record.url, record.message);
        console.log(`✓ Message sent to ${displayName}`);

        // 2. Immediately persist to data/seen.json on each message send
        tracker.markSeen({
          username: record.username,
          url: record.url,
          message: record.message,
          status: "SENT",
        });
        console.log(`✓ Recorded in data/seen.json`);

        successful++;

        logAutomation({
          username: displayName,
          url: record.url,
          success: true,
        });

        console.log("→ Continuing to next profile...\n");
        await page.waitForTimeout(3000);
      } catch (error: any) {
        const errorReason = error?.message || String(error);
        console.log(`✗ ${displayName} failed: ${errorReason}`);

        const screenshot = await captureErrorScreenshot(page, displayName);
        console.log(`→ Screenshot saved: ${screenshot}`);
        console.log("→ Continuing to next profile...\n");

        failed++;

        logAutomation({
          username: displayName,
          url: record.url,
          success: false,
          error: errorReason,
          screenshot,
        });
      }
    }

    console.log(`========================================
         AUTOMATION RUN COMPLETE
========================================

Total in CSV  : ${records.length}
Sent (New)    : ${successful}
Skipped (Seen): ${skipped}
Failed        : ${failed}
Total in seen : ${tracker.getSeenCount()}
`);

  } finally {
    await context.close();
    await tracker.close();
  }
}