import fs from "fs";
import path from "path";

const logDirectory = path.resolve("logs");
const logFile = path.join(logDirectory, "automation.log");

export function log(message: string) {
  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
  }

  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
}

export function logAutomation(entry: {
  username: string;
  url: string;
  success: boolean;
  error?: string;
  screenshot?: string;
}) {
  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
  }

  const timestamp = new Date().toISOString();
  const statusStr = entry.success ? "SUCCESS" : "FAILURE";
  const errorMsg = entry.error ? ` | Error: ${entry.error}` : "";
  const screenshotMsg = entry.screenshot ? ` | Screenshot: ${entry.screenshot}` : "";

  const logLine = `[${timestamp}] STATUS: ${statusStr} | Username: ${entry.username} | URL: ${entry.url}${errorMsg}${screenshotMsg}\n`;

  fs.appendFileSync(logFile, logLine);
}