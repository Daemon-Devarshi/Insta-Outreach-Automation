import fs from "fs";
import path from "path";
import { createBrowser } from "../instagram/browser";
import { login } from "../auth/login";
import { checkIsLoggedIn } from "../auth/session";
import { executeMessageWorkflow } from "./workflow";
import { LoginCredentials } from "../auth/auth.types";
import { logAutomation } from "../logging/logger";
import { captureErrorScreenshot } from "../logging/screenshots";
import { tracker, QueueRecord } from "./tracker";

// Helper to extract a display profile name from the URL if the username column is empty
function getProfileName(record: QueueRecord): string {
  if (record.username && record.username.trim().length > 0) {
    return record.username;
  }
  try {
    const cleanUrl = record.url.trim().replace(/\/$/, "");
    const parts = cleanUrl.split("/");
    return parts[parts.length - 1] || "profile";
  } catch {
    return "profile";
  }
}

export async function runAutomation(credentials: LoginCredentials) {
  const { context, page } = await createBrowser();
  console.log("✓ Browser started");

  try {
    // Initialize the tracker (connects to DB)
    await tracker.init();

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

    let successful = 0;
    let failed = 0;

    const workerId = `worker_${credentials.username.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}`;
    console.log(`\n========================================`);
    console.log(`   Database Queue Mode (Worker: ${workerId})`);
    console.log(`========================================\n`);

    const batchSize = 25;
    const WORKING_FILE = path.resolve("data/working.json");
    let records: QueueRecord[] = [];

    // Check if there is an active batch in progress locally to resume from
    if (fs.existsSync(WORKING_FILE)) {
      try {
        const raw = fs.readFileSync(WORKING_FILE, "utf-8");
        if (raw.trim().length > 0) {
          records = JSON.parse(raw);
          console.log(`⚠ Found unfinished batch in data/working.json. Resuming ${records.length} profile(s)...`);
        }
      } catch (err) {
        console.warn("Could not read data/working.json, will fetch new batch.", err);
      }
    }

    // If no local batch exists or was empty, fetch a new batch from the database
    if (records.length === 0) {
      console.log(`Fetching batch of up to ${batchSize} pending profiles...`);
      records = await tracker.fetchNextBatch(workerId, batchSize);

      if (records.length === 0) {
        console.log("No pending messages in the database queue.");
      } else {
        // Cache the new batch locally in working.json
        try {
          const dir = path.dirname(WORKING_FILE);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(WORKING_FILE, JSON.stringify(records, null, 2), "utf-8");
          console.log(`Saved new batch of ${records.length} profiles to data/working.json.`);
        } catch (err) {
          console.error("Failed to save data/working.json:", err);
        }
      }
    }

    if (records.length > 0) {
      console.log(`Loaded ${records.length} profile(s) to process in this run.\n`);

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const profileName = getProfileName(record);

        // Skip if already processed in this batch (e.g., during resume after crash)
        if (record.status === "SENT" || record.status === "FAILED") {
          console.log(`⏭️ [Profile ${i + 1}/${records.length}] ${profileName} already processed in this batch (${record.status}). Skipping.\n`);
          if (record.status === "SENT") {
            successful++;
          } else {
            failed++;
          }
          continue;
        }

        console.log(`[Profile ${i + 1}/${records.length}] ${profileName} (${record.url})`);

        try {
          await executeMessageWorkflow(page, record.url, record.message);
          console.log("✓ Message sent\n");

          successful++;
          record.status = "SENT";
          await tracker.updateStatus(record.id, "SENT");

          // Save updated batch state to local cache
          fs.writeFileSync(WORKING_FILE, JSON.stringify(records, null, 2), "utf-8");

          logAutomation({
            username: profileName,
            url: record.url,
            success: true,
          });
        } catch (error: any) {
          const errorReason = error?.message || String(error);
          console.log(`✗ ${profileName} failed: ${errorReason}`);

          const screenshot = await captureErrorScreenshot(page, profileName);
          console.log(`→ Screenshot saved: ${screenshot}`);
          console.log("→ Continuing to next profile...\n");

          failed++;
          record.status = "FAILED";
          record.error = errorReason;
          await tracker.updateStatus(record.id, "FAILED", errorReason);

          // Save updated batch state to local cache
          fs.writeFileSync(WORKING_FILE, JSON.stringify(records, null, 2), "utf-8");

          logAutomation({
            username: profileName,
            url: record.url,
            success: false,
            error: errorReason,
            screenshot,
          });
        }
      }

      // Clean up working.json when the entire batch is completed
      try {
        if (fs.existsSync(WORKING_FILE)) {
          fs.unlinkSync(WORKING_FILE);
          console.log("✓ Batch complete. Cleaned up data/working.json.");
        }
      } catch (err) {
        console.error("Failed to delete data/working.json:", err);
      }
    }

    console.log(`========================================
         PROCESS COMPLETE
========================================

Successful : ${successful}
Failed     : ${failed}
`);

  } finally {
    await context.close();
    await tracker.close();
  }
}