import fs from "fs";
import path from "path";

const TRACKER_FILE = path.resolve("data/processed_profiles.json");

export interface ProcessedEntry {
  username: string;
  status: "SUCCESS" | "FAILED";
  timestamp: string;
  error?: string;
}

export class ProfileTracker {
  private processedMap: Map<string, ProcessedEntry> = new Map();

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(TRACKER_FILE)) {
        const rawData = fs.readFileSync(TRACKER_FILE, "utf-8");
        const json = JSON.parse(rawData);

        for (const [key, value] of Object.entries(json)) {
          // Keep mapping simple: key is username (lowercase)
          this.processedMap.set(key.toLowerCase().trim(), value as ProcessedEntry);
        }
      }
    } catch (err) {
      console.warn("Could not read processed_profiles.json, starting with clean tracker map.", err);
    }
  }

  private save() {
    try {
      const dataDir = path.dirname(TRACKER_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const obj: Record<string, ProcessedEntry> = {};
      for (const [key, value] of this.processedMap.entries()) {
        obj[key] = value;
      }

      fs.writeFileSync(TRACKER_FILE, JSON.stringify(obj, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to save processed_profiles.json:", err);
    }
  }

  public isProcessed(username: string): boolean {
    if (!username) return false;
    const cleanKey = username.toLowerCase().trim();
    return this.processedMap.has(cleanKey);
  }

  public markProcessed(username: string, status: "SUCCESS" | "FAILED", error?: string) {
    if (!username) return;
    const cleanUsername = username.trim();
    const entry: ProcessedEntry = {
      username: cleanUsername,
      status,
      timestamp: new Date().toISOString(),
      ...(error ? { error } : {}),
    };

    this.processedMap.set(cleanUsername.toLowerCase(), entry);
    this.save();
  }
}

export const tracker = new ProfileTracker();
