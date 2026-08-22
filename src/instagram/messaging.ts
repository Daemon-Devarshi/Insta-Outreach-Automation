import { Page } from "playwright";
import { selectors } from "./selectors";

async function findFirstVisible(
  page: Page,
  selectorList: string[],
  timeoutMs = 5000
) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    for (const selector of selectorList) {
      const locator = page.locator(selector).first();
      if (await locator.isVisible().catch(() => false)) {
        return locator;
      }
    }
    // Also try looking inside active frames or modals
    const iframeMessageInput = page.frameLocator('iframe').locator('div[contenteditable="true"]').first();
    if (await iframeMessageInput.isVisible().catch(() => false)) {
      return iframeMessageInput;
    }
    await page.waitForTimeout(500);
  }
  return null;
}

export async function openMessageComposer(page: Page) {
  console.log("Opening Message...");

  // 1. Try standard Message button first (restricted to main/header to avoid sidebar menu)
  console.log("Checking if standard Message button is visible...");
  const button = await findFirstVisible(page, selectors.messageButton, 4000);

  if (button) {
    console.log("Clicking standard Message button...");
    await button.click();
  } else {
    // 2. Fallback: Try the three-dots options button if standard Message button is not found
    console.log("Standard Message button not visible. Trying three-dots options menu...");
    
    // Find the three dots options button
    const threeDots = await findFirstVisible(page, selectors.threeDotsButton, 4000);
    if (!threeDots) {
      throw new Error("Message button and three-dots options menu button not found.");
    }
    
    console.log("Clicking three-dots options button...");
    await threeDots.click();
    await page.waitForTimeout(2000);

    // Look for the "Send message" option inside the popup menu
    const menuMessageBtn = await findFirstVisible(page, selectors.threeDotsSendMessage, 4000);
    if (menuMessageBtn) {
      console.log("Clicking 'Send message' option inside menu...");
      await menuMessageBtn.click();
    } else {
      console.log("Could not find 'Send message' inside three-dots menu. Closing menu...");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1000);
      throw new Error("Could not find 'Send message' option inside the three-dots menu.");
    }
  }

  await page.waitForTimeout(3000);

  // Dismiss any popups that appear after clicking Message
  for (const selector of selectors.dismissPopups) {
    const popupBtn = page.locator(selector).first();
    if (await popupBtn.isVisible().catch(() => false)) {
      await popupBtn.click().catch(() => {});
      await page.waitForTimeout(1000);
    }
  }
}

export async function sendMessage(
  page: Page,
  message: string
) {
  console.log("Sending message...");

  // Try standard page input field
  let input = await findFirstVisible(page, selectors.messageInput, 8000);

  if (!input) {
    // If the input isn't found directly, try clicking inside the message container first to focus it
    console.log("Trying to focus the DM container to reveal input field...");
    const messageContainerSelectors = [
      'div[role="main"]',
      'div[aria-label*="Conversation" i]',
      'div[aria-label*="Message" i]',
      'div[role="textbox"]',
    ];
    for (const selector of messageContainerSelectors) {
      const container = page.locator(selector).first();
      if (await container.isVisible().catch(() => false)) {
        await container.click().catch(() => {});
        await page.waitForTimeout(1000);
        break;
      }
    }
    input = await findFirstVisible(page, selectors.messageInput, 4000);
  }

  if (!input) {
    throw new Error("Message input field not found on page.");
  }

  await input.click().catch(() => {});
  await page.waitForTimeout(500);
  await input.fill(message);
  await page.waitForTimeout(500);

  const sendButton = await findFirstVisible(page, selectors.sendButton, 2000);

  if (sendButton) {
    await sendButton.click();
  } else {
    await input.press("Enter");
  }

  await page.waitForTimeout(2000);

  // Close DM modal / window if close button is present
  for (const selector of selectors.closeDmButton) {
    const closeBtn = page.locator(selector).first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click().catch(() => {});
      await page.waitForTimeout(1000);
      break;
    }
  }
}