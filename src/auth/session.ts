import { Page } from "playwright";
import fs from "fs";
import path from "path";

const SESSION_DIR = path.resolve("sessions");

export function sessionExists(): boolean {
  return fs.existsSync(SESSION_DIR) && fs.readdirSync(SESSION_DIR).length > 0;
}

export function getSessionPath(): string {
  return SESSION_DIR;
}

export async function checkIsLoggedIn(page: Page): Promise<boolean> {
  try {
    const cookies = await page.context().cookies("https://www.instagram.com");
    const hasSessionCookie = cookies.some((c) => c.name === "sessionid" && c.value.length > 0);

    if (!hasSessionCookie) {
      return false;
    }

    const currentUrl = page.url();
    if (currentUrl.includes("/accounts/login")) {
      return false;
    }

    const logInButtonVisible = await page
      .locator('input[name="username"], a[href="/accounts/login/"]')
      .first()
      .isVisible()
      .catch(() => false);

    return !logInButtonVisible;
  } catch {
    return false;
  }
}