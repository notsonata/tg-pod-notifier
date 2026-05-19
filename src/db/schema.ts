import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(),
  externalOrderId: text("external_order_id").notNull(),
  displayOrderId: text("display_order_id"),
  referenceOrderId: text("reference_order_id"),
  shopId: text("shop_id"),
  status: text("status").notNull(),
  sentToProductionAt: text("sent_to_production_at"),
  totalCostAmount: integer("total_cost_amount"),
  totalCostCurrency: text("total_cost_currency"),
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

export const orderRiskEvents = sqliteTable("order_risk_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderUniqueKey: text("order_unique_key").notNull(),
  provider: text("provider").notNull(),
  externalOrderId: text("external_order_id").notNull(),
  riskType: text("risk_type").notNull(),
  severity: text("severity").notNull(),
  reason: text("reason").notNull(),
  expectedShipAt: text("expected_ship_at"),
  firstDetectedAt: text("first_detected_at").notNull(),
  lastDetectedAt: text("last_detected_at").notNull(),
  lastAlertedAt: text("last_alerted_at"),
  resolvedAt: text("resolved_at")
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  telegramChatId: text("telegram_chat_id").notNull().unique(),
  timezone: text("timezone").notNull(),
  digestEnabled: integer("digest_enabled", { mode: "boolean" }).notNull().default(true),
  digestOnlyOnUpdates: integer("digest_only_on_updates", { mode: "boolean" }).notNull().default(false),
  lastDigestSentAt: text("last_digest_sent_at")
});

export const providerKeys = sqliteTable("provider_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(),
  label: text("label").notNull(),
  apiKey: text("api_key").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const providerStores = sqliteTable("provider_stores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  keyId: integer("key_id").notNull(),
  provider: text("provider").notNull(),
  externalStoreId: text("external_store_id").notNull(),
  name: text("name").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true)
});
