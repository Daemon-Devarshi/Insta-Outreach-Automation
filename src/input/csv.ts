import fs from "fs";
import path from "path";

export interface MessageRecord {
  username: string;
  url: string;
  message: string;
}

export type ProfileRecord = MessageRecord;

/**
 * Parses raw CSV string into an array of string rows with RFC 4180 compliance.
 * Handles quoted fields, embedded commas, escaped quotes (""), and multiline content.
 */
export function parseCsvContent(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote ("")
          currentCell += '"';
          i++; // Skip subsequent quote
        } else {
          // End of quoted cell
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentCell.trim());
        currentCell = "";
      } else if (char === "\r") {
        if (nextChar === "\n") {
          i++; // Skip \n in CRLF
        }
        currentRow.push(currentCell.trim());
        if (currentRow.some((cell) => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
      } else if (char === "\n") {
        currentRow.push(currentCell.trim());
        if (currentRow.some((cell) => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Reads and parses the CSV file containing Instagram profiles and messages.
 * Automatically identifies headers ('username', 'url', 'message') or uses column positions.
 */
export function parseMessagesCsv(
  filePath: string = path.resolve("data/messages.csv")
): MessageRecord[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`[Parser Warning] File not found at ${filePath}`);
    return [];
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCsvContent(content);

  if (rows.length === 0) {
    return [];
  }

  let usernameIdx = 0;
  let urlIdx = 1;
  let messageIdx = 2;
  let startIndex = 0;

  // Header detection
  const firstRow = rows[0].map((c) => c.toLowerCase().trim());
  const uIdx = firstRow.findIndex((h) =>
    ["username", "user", "creator", "profile", "account"].includes(h)
  );
  const lIdx = firstRow.findIndex((h) =>
    ["url", "profile_url", "profileurl", "link", "instagram_url", "instagramurl"].includes(h)
  );
  const mIdx = firstRow.findIndex((h) =>
    ["message", "msg", "text", "body", "dm"].includes(h)
  );

  if (uIdx !== -1 && (lIdx !== -1 || mIdx !== -1)) {
    usernameIdx = uIdx;
    urlIdx = lIdx !== -1 ? lIdx : 1;
    messageIdx = mIdx !== -1 ? mIdx : 2;
    startIndex = 1; // Skip header row
  }

  const records: MessageRecord[] = [];

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    const username = (row[usernameIdx] || "").trim();
    const url = (row[urlIdx] || "").trim();
    const message = (row[messageIdx] || "").trim();

    if (!username || !url || !message) {
      console.warn(
        `[Parser Warning] Row ${i + 1} skipped: Missing username, URL, or message -> ${JSON.stringify(row)}`
      );
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

/**
 * Backward compatibility alias for readProfiles
 */
export function readProfiles(filePath: string): MessageRecord[] {
  return parseMessagesCsv(filePath);
}