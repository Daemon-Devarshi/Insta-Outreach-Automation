import pg from "pg";
import { env } from "../config/env";

const { Pool } = pg;

export interface QueueRecord {
  id: number;
  username?: string;
  url: string;
  message: string;
  status: "PENDING" | "WORKING" | "SENT" | "FAILED";
  worker_id?: string;
  error?: string;
}

export class ProfileTracker {
  private pool: pg.Pool | null = null;
  private useDb: boolean = false;

  constructor() {
    // Initial construction doesn't connect. Connection is handled in init()
  }

  public async init() {
    if (!env.databaseUrl) {
      throw new Error("DATABASE_URL is not configured. Please define it in your .env file.");
    }

    try {
      console.log("Connecting to PostgreSQL database...");
      const sslConfig = env.databaseUrl.includes("localhost") || env.databaseUrl.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false };

      this.pool = new Pool({
        connectionString: env.databaseUrl,
        ssl: sslConfig,
      });

      // Test connection
      await this.pool.query("SELECT NOW()");

      // Create table message_queue if not exists with UNIQUE on url, not username
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS message_queue (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255),
          url TEXT UNIQUE NOT NULL,
          message TEXT NOT NULL,
          status VARCHAR(50) DEFAULT 'PENDING' NOT NULL,
          worker_id VARCHAR(100),
          error TEXT,
          timestamp TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_message_queue_status ON message_queue(status);
        CREATE INDEX IF NOT EXISTS idx_message_queue_url ON message_queue(url);
      `);

      this.useDb = true;
      console.log("✓ Connected to PostgreSQL database successfully.");
    } catch (err) {
      console.error("✗ Failed to connect to PostgreSQL database:", err);
      this.useDb = false;
      throw err;
    }
  }

  public isDbActive(): boolean {
    return this.useDb;
  }

  public async isProcessed(url: string): Promise<boolean> {
    if (!url || !this.pool) return false;
    const cleanUrl = url.trim().toLowerCase();

    try {
      const res = await this.pool.query(
        "SELECT 1 FROM message_queue WHERE LOWER(url) = $1 AND status = 'SENT' LIMIT 1",
        [cleanUrl]
      );
      return res.rowCount !== null && res.rowCount > 0;
    } catch (err) {
      console.error(`Failed to query database for processed URL ${cleanUrl}:`, err);
      return false;
    }
  }

  public async markProcessed(url: string, status: "SENT" | "FAILED", error?: string) {
    if (!url || !this.pool) return;
    const cleanUrl = url.trim();
    const timestamp = new Date().toISOString();

    try {
      await this.pool.query(
        `INSERT INTO message_queue (url, message, status, error, timestamp, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)
         ON CONFLICT (url)
         DO UPDATE SET status = EXCLUDED.status, error = EXCLUDED.error, updated_at = EXCLUDED.updated_at`,
        [
          cleanUrl,
          "Status marked directly by tracker.",
          status,
          error || null,
          timestamp,
        ]
      );
    } catch (err) {
      console.error(`Failed to save processed profile URL ${cleanUrl} to database:`, err);
    }
  }

  public async addQueueItem(username: string | null, url: string, message: string): Promise<boolean> {
    if (!this.pool) {
      return false;
    }

    try {
      const res = await this.pool.query(
        `INSERT INTO message_queue (username, url, message, status, updated_at)
         VALUES ($1, $2, $3, 'PENDING', NOW())
         ON CONFLICT (url) DO NOTHING`,
        [username ? username.trim() : null, url.trim(), message.trim()]
      );
      return res.rowCount !== null && res.rowCount > 0;
    } catch (err) {
      console.error(`Failed to add item to message queue for ${url}:`, err);
      return false;
    }
  }

  public async fetchNextBatch(workerId: string, limit: number = 25): Promise<QueueRecord[]> {
    if (!this.pool) {
      return [];
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const fetchRes = await client.query(
        `WITH next_batch AS (
           SELECT id FROM message_queue
           WHERE status = 'PENDING'
           ORDER BY id ASC
           LIMIT $1
           FOR UPDATE SKIP LOCKED
         )
         UPDATE message_queue
         SET status = 'WORKING', worker_id = $2, updated_at = NOW()
         WHERE id IN (SELECT id FROM next_batch)
         RETURNING id, username, url, message, status, worker_id, error`,
        [limit, workerId]
      );

      await client.query("COMMIT");
      return fetchRes.rows;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`Error fetching next batch for worker ${workerId}:`, err);
      return [];
    } finally {
      client.release();
    }
  }

  public async updateStatus(id: number, status: "SENT" | "FAILED", error?: string) {
    if (!this.pool) {
      return;
    }

    try {
      await this.pool.query(
        `UPDATE message_queue
         SET status = $1, error = $2, updated_at = NOW()
         WHERE id = $3`,
        [status, error || null, id]
      );
    } catch (err) {
      console.error(`Failed to update status for queue item ${id} to ${status}:`, err);
    }
  }

  public async close() {
    if (this.pool) {
      try {
        await this.pool.end();
        console.log("Closed PostgreSQL connection pool.");
      } catch (err) {
        console.error("Error closing PostgreSQL pool:", err);
      } finally {
        this.pool = null;
        this.useDb = false;
      }
    }
  }
}

export const tracker = new ProfileTracker();
