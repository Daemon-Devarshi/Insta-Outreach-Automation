import { Page } from "playwright";
import fs from "fs";
import path from "path";

export async function captureErrorScreenshot(
  page: Page,
  identifier: string = "error"
): Promise<string> {
  const directory = path.resolve("screenshots");

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const safeId = identifier.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `error-${safeId}-${Date.now()}.png`;
  const fullPath = path.join(directory, filename);

  await page.screenshot({
    path: fullPath,
    fullPage: true,
  }).catch((err) => {
    console.error("Failed to capture screenshot:", err);
  });

  return filename;
}