import { Page } from "playwright";
import { checkIsLoggedIn } from "../auth/session";
import { selectors } from "./selectors";

export async function openProfile(
  page: Page,
  profileUrl: string
) {
  const normalizedUrl = profileUrl.endsWith("/")
    ? profileUrl
    : `${profileUrl}/`;

  console.log("Opening profile...");

  await page.goto(normalizedUrl, {
    waitUntil: "domcontentloaded",
  });

  await page.waitForTimeout(3000);

  // Dismiss any popups if present
  for (const selector of selectors.dismissPopups) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click().catch(() => {});
      await page.waitForTimeout(1000);
    }
  }

  const authenticated = await checkIsLoggedIn(page);
  if (!authenticated) {
    throw new Error("Instagram session is not authenticated.");
  }
}