import fs from "fs";
import path from "path";

export interface MessageRecord {
  username: string;
  url: string;
  message: string;
}

export function parseMessagesTxt(filePath: string = path.resolve("data/messages.txt")): MessageRecord[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`[Parser Warning] File not found at ${filePath}`);
    return [];
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/);
  const records: MessageRecord[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const separator = " - ";
    const dashIndex = line.indexOf(separator);

    if (dashIndex === -1) {
      console.warn(`[Parser Warning] Line ${i + 1} skipped: Missing ' - ' separator -> "${line}"`);
      continue;
    }

    const header = line.substring(0, dashIndex).trim();
    const message = line.substring(dashIndex + separator.length).trim();

    const parts = header.split(/\s+/);
    if (parts.length < 2) {
      console.warn(`[Parser Warning] Line ${i + 1} skipped: Invalid username/URL header -> "${header}"`);
      continue;
    }

    const username = parts[0];
    const url = parts[1];

    if (!message) {
      console.warn(`[Parser Warning] Line ${i + 1} skipped: Empty message for username "${username}"`);
      continue;
    }

    records.push({
      username,
      url,
      message,
    });
  }

  return records;
}
