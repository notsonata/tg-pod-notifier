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
      sent_to_production_at TEXT,
      total_cost_amount INTEGER,
      total_cost_currency TEXT,
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
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_chat_id TEXT NOT NULL UNIQUE,
      timezone TEXT NOT NULL,
      digest_enabled INTEGER NOT NULL DEFAULT 1,
      last_digest_sent_at TEXT
    );
    CREATE TABLE IF NOT EXISTS provider_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      label TEXT NOT NULL,
      api_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS provider_stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_id INTEGER NOT NULL,
      provider TEXT NOT NULL,
      external_store_id TEXT NOT NULL,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      UNIQUE(key_id, external_store_id)
    );
  `);

  try {
    sqlite.exec(`ALTER TABLE orders ADD COLUMN sent_to_production_at TEXT;`);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("duplicate column name")) {
      throw error;
    }
  }

  try {
    sqlite.exec(`ALTER TABLE orders ADD COLUMN total_cost_amount INTEGER;`);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("duplicate column name")) {
      throw error;
    }
  }

  try {
    sqlite.exec(`ALTER TABLE orders ADD COLUMN total_cost_currency TEXT;`);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("duplicate column name")) {
      throw error;
    }
  }

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

  return { sqlite, db };
}
