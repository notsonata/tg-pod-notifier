import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(),
  externalOrderId: text("external_order_id").notNull(),
  referenceOrderId: text("reference_order_id"),
  shopId: text("shop_id"),
  status: text("status").notNull(),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
  customerName: text("customer_name"),
  city: text("city"),
  region: text("region"),
  country: text("country"),
  email: text("email"),
  phone: text("phone"),
  address1: text("address1"),
  address2: text("address2"),
  postalCode: text("postal_code"),
  trackingLinksJson: text("tracking_links_json").notNull().default("[]"),
  providerUrl: text("provider_url"),
  etaMinAt: text("eta_min_at"),
  etaMaxAt: text("eta_max_at"),
  rawJson: text("raw_json").notNull(),
  uniqueKey: text("unique_key").notNull().unique()
});

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderUniqueKey: text("order_unique_key").notNull(),
  externalItemId: text("external_item_id"),
  sku: text("sku"),
  title: text("title").notNull(),
  quantity: integer("quantity").notNull(),
  status: text("status").notNull()
});

export const statusEvents = sqliteTable("status_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderUniqueKey: text("order_unique_key").notNull(),
  provider: text("provider").notNull(),
  externalEventId: text("external_event_id").notNull(),
  source: text("source").notNull(),
  status: text("status").notNull(),
  comment: text("comment"),
  occurredAt: text("occurred_at"),
  rawJson: text("raw_json").notNull()
});

export const alerts = sqliteTable("alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderUniqueKey: text("order_unique_key").notNull(),
  reason: text("reason").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull().default("active"),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull(),
  acknowledgedAt: text("acknowledged_at"),
  snoozedUntil: text("snoozed_until")
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  telegramChatId: text("telegram_chat_id").notNull().unique(),
  printifyShopId: text("printify_shop_id"),
  timezone: text("timezone").notNull(),
  digestEnabled: integer("digest_enabled", { mode: "boolean" }).notNull().default(true),
  digestHour: integer("digest_hour").notNull(),
  digestMinute: integer("digest_minute").notNull(),
  digestStatusesJson: text("digest_statuses_json").notNull().default("[]"),
  digestStuckOnly: integer("digest_stuck_only", { mode: "boolean" }).notNull().default(false),
  piiName: integer("pii_name", { mode: "boolean" }).notNull().default(false),
  piiEmail: integer("pii_email", { mode: "boolean" }).notNull().default(false),
  piiPhone: integer("pii_phone", { mode: "boolean" }).notNull().default(false),
  piiAddress: integer("pii_address", { mode: "boolean" }).notNull().default(false),
  preProductionHours: integer("pre_production_hours").notNull().default(2),
  holdHours: integer("hold_hours").notNull().default(24),
  productionBusinessDays: integer("production_business_days").notNull().default(3),
  lastDigestSentAt: text("last_digest_sent_at")
});

export const webhookEvents = sqliteTable("webhook_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(),
  externalEventId: text("external_event_id").notNull().unique(),
  receivedAt: text("received_at").notNull(),
  payloadHash: text("payload_hash").notNull()
});
