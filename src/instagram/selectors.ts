export const selectors = {
  messageButton: [
    'main button:has-text("Message")',
    'main div[role="button"]:has-text("Message")',
    'main a:has-text("Message")',
    'header button:has-text("Message")',
    'header div[role="button"]:has-text("Message")',
  ],

  threeDotsButton: [
    'header svg[aria-label="Options"]',
    'header svg[aria-label*="option" i]',
    'header svg[aria-label*="more" i]',
    'header button:has(svg)',
    'header div[role="button"]:has(svg)',
    'button[aria-label*="option" i]',
    'svg[aria-label="Options"]',
    'svg[aria-label*="option" i]',
    'svg[aria-label*="more" i]',
  ],

  threeDotsSendMessage: [
    'button:has-text("Send message")',
    'button:has-text("Send Message")',
    'div[role="button"]:has-text("Send message")',
    'button:has-text("Message")',
    'div[role="button"]:has-text("Message")',
  ],

  messageInput: [
    'div[contenteditable="true"][aria-label*="Message" i]',
    'div[contenteditable="true"][role="textbox"]',
    'div[aria-label*="Message" i][role="textbox"]',
    'div[aria-placeholder*="Message" i]',
    'p[aria-label*="Message" i]',
    'div[contenteditable="true"]',
    'textarea[placeholder*="Message" i]',
    'textarea',
  ],

  sendButton: [
    'button:has-text("Send")',
    'div[role="button"]:has-text("Send")',
    'button[type="submit"]',
  ],

  closeDmButton: [
    'svg[aria-label="Close"]',
    'button:has-text("Close")',
    'svg[aria-label="Back"]',
    'a[href="/direct/inbox/"]',
  ],

  dismissPopups: [
    'button:has-text("Not Now")',
    'div[role="button"]:has-text("Not Now")',
    'button:has-text("Cancel")',
  ],
};