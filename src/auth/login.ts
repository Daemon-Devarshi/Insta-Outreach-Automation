import { Page } from "playwright";
import inquirer from "inquirer";
import { LoginCredentials } from "./auth.types";
import { checkIsLoggedIn } from "./session";
import { captureErrorScreenshot } from "../logging/screenshots";

function triggerAlertBeep(count = 5) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      process.stdout.write("\x07");
    }, i * 400);
  }
}

async function detectCaptchaOrChallenge(page: Page): Promise<boolean> {
  const url = page.url().toLowerCase();
  
  if (url.includes("challenge") || url.includes("checkpoint") || url.includes("recaptcha") || url.includes("captcha")) {
    return true;
  }

  const textSelectors = [
    "text=confirm you're a human",
    "text=verify you're a human",
    "text=suspicious activity",
    "text=confirm it's you",
    "text=Help us confirm you own this account",
  ];
  for (const sel of textSelectors) {
    if (await page.locator(sel).first().isVisible().catch(() => false)) {
      return true;
    }
  }

  const iframeVisible = await page.locator('iframe[src*="recaptcha" i], iframe[src*="captcha" i]').first().isVisible().catch(() => false);
  if (iframeVisible) {
    return true;
  }

  return false;
}

async function dismissCookieBanners(page: Page) {
  const cookieSelectors = [
    'button:has-text("Allow all cookies")',
    'button:has-text("Allow essential and optional cookies")',
    'button:has-text("Decline optional cookies")',
    'button:has-text("Only allow essential cookies")',
    'button:has-text("Accept")',
    'button:has-text("Allow")',
  ];

  for (const selector of cookieSelectors) {
    const btn = page.locator(selector).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(1000);
    }
  }
}

async function findUsernameInput(page: Page) {
  const selectors = [
    'input[name="username"]',
    'input[aria-label*="username" i]',
    'input[aria-label*="email" i]',
    'input[aria-label*="Mobile number" i]',
    'input[placeholder*="username" i]',
    'input[placeholder*="email" i]',
    'input[type="text"]',
  ];

  for (const selector of selectors) {
    const loc = page.locator(selector).first();
    if (await loc.isVisible().catch(() => false)) {
      return loc;
    }
  }
  return null;
}

async function findPasswordInput(page: Page) {
  const selectors = [
    'input[name="password"]',
    'input[type="password"]',
    'input[aria-label*="password" i]',
    'input[placeholder*="password" i]',
  ];

  for (const selector of selectors) {
    const loc = page.locator(selector).first();
    if (await loc.isVisible().catch(() => false)) {
      return loc;
    }
  }
  return null;
}

async function findSubmitButton(page: Page) {
  const selectors = [
    'button[type="submit"]',
    'button:has-text("Log in")',
    'button:has-text("Log In")',
    'div[role="button"]:has-text("Log in")',
    'div[role="button"]:has-text("Log In")',
    'button:has-text("Next")',
  ];

  for (const selector of selectors) {
    const loc = page.locator(selector).first();
    if (await loc.isVisible().catch(() => false)) {
      return loc;
    }
  }
  return null;
}

async function promptAndFillOtp(page: Page) {
  console.log("\n====================================================");
  console.log("🔐 Instagram Security Check / OTP Required!");
  console.log("====================================================\n");
  triggerAlertBeep(3);

  const { otpCode } = await inquirer.prompt([
    {
      type: "input",
      name: "otpCode",
      message: "Enter the Instagram OTP / Security Code sent to your device:",
      validate(val: string) {
        return val.trim().length > 0 ? true : "OTP Code cannot be empty.";
      },
    },
  ]);

  console.log(`Entering OTP code into browser...`);

  const otpSelectors = [
    'input[name="verificationCode"]',
    'input[name="security_code"]',
    'input[aria-label*="security" i]',
    'input[aria-label*="code" i]',
    'input[placeholder*="code" i]',
    'input[type="text"]',
    'input[type="number"]',
  ];

  let otpLoc = null;
  for (const selector of otpSelectors) {
    const loc = page.locator(selector).first();
    if (await loc.isVisible().catch(() => false)) {
      otpLoc = loc;
      break;
    }
  }

  if (otpLoc) {
    await otpLoc.fill(otpCode.trim());
    await page.waitForTimeout(500);

    const confirmBtn = page.locator(
      'button[type="submit"], button:has-text("Confirm"), button:has-text("Submit"), button:has-text("Next"), div[role="button"]:has-text("Confirm")'
    ).first();

    if (await confirmBtn.isVisible().catch(() => false)) {
      console.log("Clicking Confirm button...");
      await confirmBtn.click();
    } else {
      await otpLoc.press("Enter");
    }
  } else {
    console.log("⚠️ Could not automatically detect OTP field. Submitting via keyboard...");
    await page.keyboard.type(otpCode.trim());
    await page.keyboard.press("Enter");
  }

  await page.waitForTimeout(4000);
}

export async function login(
  page: Page,
  credentials: LoginCredentials
) {
  console.log("Opening Instagram...");

  await page.goto("https://www.instagram.com/", {
    waitUntil: "domcontentloaded",
  });

  await page.waitForTimeout(3000);
  await dismissCookieBanners(page);

  if (await checkIsLoggedIn(page)) {
    console.log("✓ Already authenticated.");
    return;
  }

  console.log("Waiting for login screen elements...");
  let usernameLoc = null;
  let passwordLoc = null;
  let continueBtn = null;

  const startWait = Date.now();
  const timeout = 15000;

  while (Date.now() - startWait < timeout) {
    if (await checkIsLoggedIn(page)) {
      console.log("✓ Already authenticated.");
      return;
    }

    usernameLoc = await findUsernameInput(page);
    if (usernameLoc) {
      break;
    }

    passwordLoc = await findPasswordInput(page);
    if (passwordLoc) {
      break;
    }

    // Check for "Continue as <user>" / "Continue" button
    const continueSelectors = [
      'button:has-text("Continue")',
      'a:has-text("Continue")',
      '[role="button"]:has-text("Continue")',
      'button:has-text("Continue as")',
      'a:has-text("Continue as")',
    ];
    for (const sel of continueSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible().catch(() => false)) {
        continueBtn = btn;
        break;
      }
    }

    if (continueBtn) {
      console.log("Continue button detected! Clicking Continue...");
      await continueBtn.click().catch(() => {});
      await page.waitForTimeout(3000);
      await dismissCookieBanners(page);
      continueBtn = null;
      continue;
    }

    // Check if Log In link needs to be clicked
    const loginLinkSelectors = [
      'a[href*="/accounts/login"]',
      'a[href="/accounts/login/"]',
      'button:has-text("Log In")',
      'button:has-text("Log in")',
      'a:has-text("Log In")',
      'a:has-text("Log in")',
    ];
    let clickedLoginLink = false;
    for (const sel of loginLinkSelectors) {
      const link = page.locator(sel).first();
      if (await link.isVisible().catch(() => false)) {
        console.log("Clicking 'Log in' link...");
        await link.click().catch(() => {});
        await page.waitForTimeout(3000);
        await dismissCookieBanners(page);
        clickedLoginLink = true;
        break;
      }
    }

    if (!clickedLoginLink) {
      await page.waitForTimeout(1000);
    }
  }

  // Double check inputs after the loop
  if (!usernameLoc) usernameLoc = await findUsernameInput(page);
  if (!passwordLoc) passwordLoc = await findPasswordInput(page);

  // Scenario A: Password-only screen
  if (passwordLoc && !usernameLoc) {
    console.log("Password-only prompt detected. Entering password...");
    await passwordLoc.fill(credentials.password);
    await page.waitForTimeout(500);

    const submitBtn = await findSubmitButton(page);
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await passwordLoc.press("Enter");
    }
  } 
  // Scenario B: Username field present
  else if (usernameLoc) {
    console.log(`Writing username: ${credentials.username}...`);
    await usernameLoc.fill(credentials.username);

    if (!passwordLoc) {
      passwordLoc = await findPasswordInput(page);
    }

    if (passwordLoc) {
      console.log("Writing password...");
      await passwordLoc.fill(credentials.password);
      await page.waitForTimeout(500);

      const submitBtn = await findSubmitButton(page);
      if (submitBtn) {
        console.log("Clicking submit login button...");
        await submitBtn.click();
      } else {
        await passwordLoc.press("Enter");
      }
    } else {
      // Two-step login: Username -> click Next -> wait for password input
      console.log("Clicking Next to reach password screen...");
      const submitBtn = await findSubmitButton(page);
      if (submitBtn) {
        await submitBtn.click();
      } else {
        await usernameLoc.press("Enter");
      }

      await page.waitForTimeout(3000);
      passwordLoc = await findPasswordInput(page);

      if (passwordLoc) {
        console.log("Writing password...");
        await passwordLoc.fill(credentials.password);
        await page.waitForTimeout(500);

        const nextSubmitBtn = await findSubmitButton(page);
        if (nextSubmitBtn) {
          await nextSubmitBtn.click();
        } else {
          await passwordLoc.press("Enter");
        }
      }
    }
  } else {
    const screenshot = await captureErrorScreenshot(page, "login-form-not-found");
    console.log(`❌ Login form input not visible. Screenshot saved: ${screenshot}`);
    throw new Error("Instagram login input fields were not found on the page.");
  }

  console.log("Submitted credentials. Checking authentication status...");
  await page.waitForTimeout(4000);

  // Check if OTP / 2FA / Verification / CAPTCHA is requested
  const currentUrl = page.url();
  const hasOtpInput = await page
    .locator('input[name="verificationCode"], input[name="security_code"], input[aria-label*="code" i], input[aria-label*="Security" i]')
    .first()
    .isVisible()
    .catch(() => false);

  const isChallenge =
    currentUrl.includes("challenge") ||
    currentUrl.includes("two_factor") ||
    currentUrl.includes("onetap") ||
    hasOtpInput;

  const isCaptcha = await detectCaptchaOrChallenge(page);

  if ((isChallenge || isCaptcha) && !(await checkIsLoggedIn(page))) {
    if (hasOtpInput) {
      await promptAndFillOtp(page);
    } else {
      console.log(`
🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨
🚨 CAPTCHA / SECURITY CHALLENGE DETECTED!                 🚨
🚨 Please solve the verification in the browser window.  🚨
🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨
`);
      triggerAlertBeep(5);

      const maxWaitMs = 300000;
      const startChallenge = Date.now();
      let lastBeepTime = Date.now();

      while (Date.now() - startChallenge < maxWaitMs) {
        await page.waitForTimeout(2000);

        if (Date.now() - lastBeepTime > 8000) {
          triggerAlertBeep(3);
          lastBeepTime = Date.now();
        }

        if (await checkIsLoggedIn(page)) {
          console.log("✓ Challenge resolved successfully!");
          return;
        }

        const checkOtp = await page.locator('input[name="verificationCode"], input[name="security_code"]').first().isVisible().catch(() => false);
        if (checkOtp) {
          await promptAndFillOtp(page);
          return;
        }
      }
      throw new Error("Challenge/CAPTCHA resolution timed out.");
    }
  }

  // Poll for general login completion & handle popups
  const maxWaitMs = 30000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    await page.waitForTimeout(1000);

    const saveInfoBtn = page.locator('button:has-text("Save info"), button:has-text("Save Info")').first();
    if (await saveInfoBtn.isVisible().catch(() => false)) {
      await saveInfoBtn.click().catch(() => {});
    }

    const notNowBtn = page.locator('button:has-text("Not Now")').first();
    if (await notNowBtn.isVisible().catch(() => false)) {
      await notNowBtn.click().catch(() => {});
    }

    if (await checkIsLoggedIn(page)) {
      console.log("✓ Instagram login successful!");
      return;
    }
  }

  if (await checkIsLoggedIn(page)) {
    console.log("✓ Instagram login successful!");
  } else {
    throw new Error("Failed to authenticate Instagram session.");
  }
}