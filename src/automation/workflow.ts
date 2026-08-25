import { Page } from "playwright";
import { openProfile } from "../instagram/profile";
import {
  openMessageComposer,
  sendMessage,
} from "../instagram/messaging";

export async function executeMessageWorkflow(
  page: Page,
  profileUrl: string,
  message: string
) {
  await openProfile(page, profileUrl);
  await openMessageComposer(page);
  await sendMessage(page, message);
}