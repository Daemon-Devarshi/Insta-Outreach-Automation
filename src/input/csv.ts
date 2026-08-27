import fs from "fs";
import path from "path";

export interface MessageRecord {
  username: string;
  url: string;
  message: string;
}

/**
 * Normalizes an Instagram profile URL.
 */
export function normalizeProfileUrl(url: string): string {
  let clean = url.trim();
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    clean = `https://${clean}`;
  }
  if (!clean.endsWith("/")) {
    clean = `${clean}/`;
  }
  return clean;
}

/**
 * Extracts a username from an Instagram profile URL if possible.
 */
export function extractUsernameFromUrl(url: string): string {
  try {
    const cleanUrl = url.trim().replace(/\/$/, "");
    const parts = cleanUrl.split("/");
    const lastPart = parts[parts.length - 1];
    return lastPart && !lastPart.includes("instagram.com") ? lastPart : "profile";
  } catch {
    return "profile";
  }
}

/**
 * Parse an RFC 4180 compliant CSV string into rows of cell arrays.
 * Handles quotes, escaped quotes (""), commas, and newlines inside quotes.
 */
export function parseCsvRows(csvText: string): string[][] {
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
          // Escaped quote
          currentCell += '"';
          i++; // Skip next quote
        } else {
          // End of quote
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
        // Skip CR in CRLF or handle standalone CR
        if (nextChar === "\n") {
          i++;
        }
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
      } else if (char === "\n") {
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
  }

  // Push remaining cell/row if any
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parses a CSV file into structured MessageRecord objects.
 */
export function parseCsvFile(filePath: string): MessageRecord[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`[CSV Warning] File not found at: ${filePath}`);
    return [];
  }

  const content = fs.readFileSync(filePath, "utf-8");
  if (!content.trim()) {
    console.warn(`[CSV Warning] File is empty: ${filePath}`);
    return [];
  }

  const rawRows = parseCsvRows(content);
  if (rawRows.length === 0) {
    return [];
  }

  const firstRow = rawRows[0].map((c) => c.toLowerCase().trim());

  // Determine column indexes from headers
  let usernameIdx = firstRow.findIndex((c) =>
    ["username", "user", "handle", "name", "account"].includes(c)
  );
  let urlIdx = firstRow.findIndex((c) =>
    ["url", "profile_url", "profile url", "profileurl", "instagram_url", "instagram url", "link", "profile"].includes(c)
  );
  let messageIdx = firstRow.findIndex((c) =>
    ["message", "msg", "text", "dm", "body", "content"].includes(c)
  );

  let dataRows = rawRows;

  const hasHeader = urlIdx !== -1 || messageIdx !== -1 || usernameIdx !== -1;

  if (hasHeader) {
    dataRows = rawRows.slice(1);
    // If URL or message column was not identified by name, fall back to defaults
    if (urlIdx === -1) urlIdx = 1;
    if (messageIdx === -1) messageIdx = 2;
  } else {
    // Default column positioning: [username, url, message] or [url, message]
    if (firstRow.length >= 3) {
      usernameIdx = 0;
      urlIdx = 1;
      messageIdx = 2;
    } else if (firstRow.length === 2) {
      usernameIdx = -1;
      urlIdx = 0;
      messageIdx = 1;
    }
  }

  const records: MessageRecord[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (row.length === 0 || row.every((c) => !c)) continue;

    const rawUrl = urlIdx !== -1 && row[urlIdx] ? row[urlIdx].trim() : "";
    const rawMessage = messageIdx !== -1 && row[messageIdx] ? row[messageIdx].trim() : "";
    let rawUsername = usernameIdx !== -1 && row[usernameIdx] ? row[usernameIdx].trim() : "";

    if (!rawUrl) {
      console.warn(`[CSV Warning] Row ${i + (hasHeader ? 2 : 1)} skipped: Missing URL`);
      continue;
    }

    if (!rawMessage) {
      console.warn(`[CSV Warning] Row ${i + (hasHeader ? 2 : 1)} skipped: Missing message for ${rawUrl}`);
      continue;
    }

    const normalizedUrl = normalizeProfileUrl(rawUrl);
    if (!rawUsername) {
      rawUsername = extractUsernameFromUrl(normalizedUrl);
    }

    records.push({
      username: rawUsername,
      url: normalizedUrl,
      message: rawMessage,
    });
  }

  return records;
}

/**
 * Loads CSV records from the data directory.
 * Searches for data/messages.csv or any .csv files in data/.
 */
export function loadCsvData(dataDir: string = path.resolve("data")): MessageRecord[] {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 1. Check if messages.csv exists
  const defaultMessagesCsv = path.join(dataDir, "messages.csv");
  if (fs.existsSync(defaultMessagesCsv)) {
    console.log(`Loading target profiles from ${defaultMessagesCsv}...`);
    return parseCsvFile(defaultMessagesCsv);
  }

  // 2. Scan data directory for any .csv files
  const files = fs.readdirSync(dataDir).filter((f) => f.toLowerCase().endsWith(".csv"));
  if (files.length > 0) {
    const targetFile = path.join(dataDir, files[0]);
    console.log(`Loading target profiles from ${targetFile}...`);
    return parseCsvFile(targetFile);
  }

  console.warn(`\n⚠️ No CSV files found in "${dataDir}".`);
  console.warn(`Please create "${path.join(dataDir, "messages.csv")}" with columns: username,url,message\n`);
  return [];
}
