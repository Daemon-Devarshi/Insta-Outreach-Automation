import { createBrowser } from "../instagram/browser";
import { login } from "../auth/login";
import { checkIsLoggedIn } from "../auth/session";
import { executeMessageWorkflow } from "./workflow";
import { LoginCredentials } from "../auth/auth.types";
import { parseMessagesTxt } from "../input/txt";
import { logAutomation } from "../logging/logger";
import { captureErrorScreenshot } from "../logging/screenshots";
import { tracker } from "./tracker";

export async function runAutomation(credentials: LoginCredentials) {
  const { context, page } = await createBrowser();
  console.log("✓ Browser started");

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
      console.log("✓ Session authenticated");
    } else {
      console.log("⚠️ Could not verify session. Proceeding...");
    }

    console.log("\nReading messages.txt...\n");
    const records = parseMessagesTxt();

    if (records.length === 0) {
      console.log("No profiles found in data/messages.txt.");
      return;
    }

    console.log(`Found ${records.length} profile(s) in messages.txt.\n`);

    let successful = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      console.log(`[${i + 1}/${records.length}] ${record.username} (${record.url})`);

      // Check if profile was already processed (deduplication check by username only)
      if (tracker.isProcessed(record.username)) {
        console.log(`⏭️ ${record.username} has already been processed previously. Skipping to prevent duplicates.\n`);
        skipped++;
        continue;
      }

      try {
        await executeMessageWorkflow(page, record.url, record.message);
        console.log("✓ Message sent\n");

        successful++;
        tracker.markProcessed(record.username, "SUCCESS");

        logAutomation({
          username: record.username,
          url: record.url,
          success: true,
        });
      } catch (error: any) {
        const errorReason = error?.message || String(error);
        console.log(`✗ ${record.username} failed: ${errorReason}`);

        const screenshot = await captureErrorScreenshot(page, record.username);
        console.log(`→ Screenshot saved: ${screenshot}`);
        console.log("→ Continuing to next profile...\n");

        failed++;
        tracker.markProcessed(record.username, "FAILED", errorReason);

        logAutomation({
          username: record.username,
          url: record.url,
          success: false,
          error: errorReason,
          screenshot,
        });
      }
    }

    console.log(`========================================
         PROCESS COMPLETE
========================================

Successful : ${successful}
Skipped    : ${skipped} (Already processed)
Failed     : ${failed}
`);

  } finally {
    await context.close();
  }
}