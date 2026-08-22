import { chromium, BrowserContext, Page } from "playwright";
import { getSessionPath } from "../auth/session";
import { env } from "../config/env";

export async function createBrowser(): Promise<{
  context: BrowserContext;
  page: Page;
}> {
  const context = await chromium.launchPersistentContext(
    getSessionPath(),
    {
      headless: env.headless,
      viewport: {
        width: 1280,
        height: 800,
      },
    }
  );

  const page = context.pages()[0] || await context.newPage();

  return {
    context,
    page,
  };
}