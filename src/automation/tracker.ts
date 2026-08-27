import fs from "fs";
import path from "path";

export interface SeenRecord {
  username?: string;
  url: string;
  message?: string;
  status: "SENT" | "FAILED";
  timestamp: string;
  error?: string;
}

/**
 * Normalizes a URL for comparison / deduplication.
 * Strips http/https differences, trailing slashes, www., query params.
 */
function normalizeUrlForComparison(url: string): string {
  if (!url) return "";
  let clean = url.trim().toLowerCase();
  clean = clean.replace(/^https?:\/\//, "");
  clean = clean.replace(/^www\./, "");
  clean = clean.split("?")[0].split("#")[0];
  clean = clean.replace(/\/+$/, "");
  return clean;
}

export class ProfileTracker {
  private filePath: string;
  private records: SeenRecord[] = [];
  private seenUrls: Set<string> = new Set();
  private seenUsernames: Set<string> = new Set();

  constructor(filePath: string = path.resolve("data/seen.json")) {
    this.filePath = filePath;
  }

  public init() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.records = [];
    this.seenUrls.clear();
    this.seenUsernames.clear();

    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, "utf-8").trim();
        if (raw.length > 0) {
          const parsed = JSON.parse(raw);

          // Handle array of objects or strings
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (typeof item === "string") {
                const normUrl = normalizeUrlForComparison(item);
                if (normUrl) {
                  this.seenUrls.add(normUrl);
                  this.records.push({
                    url: item,
                    status: "SENT",
                    timestamp: new Date().toISOString(),
                  });
                }
              } else if (item && typeof item === "object") {
                const record = item as SeenRecord;
                this.records.push(record);
                if (record.url) {
                  this.seenUrls.add(normalizeUrlForComparison(record.url));
                }
                if (record.username && record.username.trim().length > 0) {
                  this.seenUsernames.add(record.username.trim().toLowerCase());
                }
              }
            }
          } else if (typeof parsed === "object" && parsed !== null) {
            // Handle dictionary/map of { url: record }
            for (const [key, val] of Object.entries(parsed)) {
              const normUrl = normalizeUrlForComparison(key);
              if (normUrl) {
                this.seenUrls.add(normUrl);
              }
              if (val && typeof val === "object") {
                this.records.push(val as SeenRecord);
              } else {
                this.records.push({
                  url: key,
                  status: "SENT",
                  timestamp: new Date().toISOString(),
                });
              }
            }
          }
        }
        console.log(`✓ Loaded ${this.records.length} previously processed profile(s) from data/seen.json`);
      } catch (err) {
        console.warn("Could not parse data/seen.json, starting with fresh tracker state.", err);
      }
    } else {
      // Create empty seen.json if it does not exist
      this.saveToFile();
    }
  }

  /**
   * Check if a profile URL or username has already been processed and saved to seen.json.
   */
  public isSeen(url: string, username?: string): boolean {
    if (url) {
      const norm = normalizeUrlForComparison(url);
      if (this.seenUrls.has(norm)) {
        return true;
      }
    }
    if (username && username.trim().length > 0) {
      const cleanUser = username.trim().toLowerCase();
      if (cleanUser !== "profile" && this.seenUsernames.has(cleanUser)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Records a profile as seen and IMMEDIATELY updates data/seen.json on disk.
   */
  public markSeen(record: {
    username?: string;
    url: string;
    message?: string;
    status: "SENT" | "FAILED";
    error?: string;
  }) {
    const timestamp = new Date().toISOString();
    const newRecord: SeenRecord = {
      username: record.username || undefined,
      url: record.url,
      message: record.message || undefined,
      status: record.status,
      timestamp,
      error: record.error || undefined,
    };

    // Update in-memory sets
    if (record.url) {
      this.seenUrls.add(normalizeUrlForComparison(record.url));
    }
    if (record.username && record.username.trim().length > 0) {
      this.seenUsernames.add(record.username.trim().toLowerCase());
    }

    // Update or append in records array
    const existingIndex = this.records.findIndex(
      (r) => normalizeUrlForComparison(r.url) === normalizeUrlForComparison(record.url)
    );

    if (existingIndex >= 0) {
      this.records[existingIndex] = newRecord;
    } else {
      this.records.push(newRecord);
    }

    // Immediately persist to seen.json synchronously
    this.saveToFile();
  }

  public getSeenCount(): number {
    return this.records.length;
  }

  private saveToFile() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.records, null, 2), "utf-8");
    } catch (err) {
      console.error(`Failed to write to ${this.filePath}:`, err);
    }
  }

  public async close() {
    // Synchronous write already done on every update
  }
}

export const tracker = new ProfileTracker();
