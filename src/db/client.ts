import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema.js";

export type AppDatabase = ReturnType<typeof drizzle<typeof schema>>;

export function createDatabase(databasePath: string) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const sqlite = new Database(databasePath);
  const db = drizzle(sqlite, { schema });

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      external_order_id TEXT NOT NULL,
      reference_order_id TEXT,
      shop_id TEXT,
      status TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT,
      customer_name TEXT,
      city TEXT,
      region TEXT,
      country TEXT,
      email TEXT,
      phone TEXT,
      address1 TEXT,
      address2 TEXT,
      postal_code TEXT,
      tracking_links_json TEXT NOT NULL DEFAULT '[]',
      provider_url TEXT,
      eta_min_at TEXT,
      eta_max_at TEXT,
      raw_json TEXT NOT NULL,
      unique_key TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_unique_key TEXT NOT NULL,
      external_item_id TEXT,
      sku TEXT,
      title TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS status_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_unique_key TEXT NOT NULL,
      provider TEXT NOT NULL,
      external_event_id TEXT NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      comment TEXT,
      occurred_at TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_unique_key TEXT NOT NULL,
      reason TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      acknowledged_at TEXT,
      snoozed_until TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_chat_id TEXT NOT NULL UNIQUE,
      printify_shop_id TEXT,
      printify_shop_name TEXT,
      timezone TEXT NOT NULL,
      digest_enabled INTEGER NOT NULL DEFAULT 1,
      digest_hour INTEGER NOT NULL,
      digest_minute INTEGER NOT NULL,
      digest_statuses_json TEXT NOT NULL DEFAULT '[]',
      digest_stuck_only INTEGER NOT NULL DEFAULT 0,
      pii_name INTEGER NOT NULL DEFAULT 0,
      pii_email INTEGER NOT NULL DEFAULT 0,
      pii_phone INTEGER NOT NULL DEFAULT 0,
      pii_address INTEGER NOT NULL DEFAULT 0,
      stale_days INTEGER NOT NULL DEFAULT 3,
      last_digest_sent_at TEXT
    );
    CREATE TABLE IF NOT EXISTS webhook_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      external_event_id TEXT NOT NULL UNIQUE,
      received_at TEXT NOT NULL,
      payload_hash TEXT NOT NULL
    );
  `);

  try {
    sqlite.exec(`ALTER TABLE settings ADD COLUMN printify_shop_id TEXT;`);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("duplicate column name")) {
      throw error;
    }
  }

  try {
    sqlite.exec(`ALTER TABLE settings ADD COLUMN printify_shop_name TEXT;`);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("duplicate column name")) {
      throw error;
    }
  }

  try {
    sqlite.exec(`ALTER TABLE settings ADD COLUMN stale_days INTEGER NOT NULL DEFAULT 3;`);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("duplicate column name")) {
      throw error;
    }
  }

  return { sqlite, db };
}
