import { and, desc, eq, sql } from "drizzle-orm";

import type { AppConfig } from "../config.js";
import type {
  BotSettings,
  NormalizedOrder,
  ProviderKeyConfig,
  ProviderKeyName,
  ProviderStoreConfig
} from "../domain/types.js";
import { isHiddenOrderStatus } from "../domain/types.js";
import type { ProductionRisk } from "../jobs/production-risk.js";
import type { AppDatabase } from "./client.js";
import { orderItems, orderRiskEvents, orders, providerKeys, providerStores, settings, statusEvents } from "./schema.js";

function orderUniqueKey(order: Pick<NormalizedOrder, "provider" | "externalOrderId">): string {
  return `${order.provider}:${order.externalOrderId}`;
}

function rawObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function joinedName(...values: Array<unknown>): string | null {
  const name = values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .trim();
  return name || null;
}

function displayOrderIdFromRaw(row: typeof orders.$inferSelect, raw: unknown): string | null {
  if (row.displayOrderId) {
    return row.displayOrderId;
  }

  const payload = rawObject(raw);
  if (row.provider === "printify") {
    const metadata = rawObject(payload.metadata);
    return (
      optionalString(metadata.shop_order_label) ??
      optionalString(metadata.shop_order_id) ??
      optionalString(payload.app_order_id)
    );
  }

  if (row.provider === "gelato") {
    return optionalString(payload.orderReferenceId) ?? optionalString(payload.id);
  }

  return null;
}

function statusFromRaw(row: typeof orders.$inferSelect, raw: unknown): string {
  const payload = rawObject(raw);
  if (row.provider === "printify") {
    const shipments = Array.isArray(payload.shipments) ? payload.shipments : [];
    const delivered = shipments.some((shipment) => {
      const item = rawObject(shipment);
      return Boolean(item.delivered_at) || item.status === "delivered";
    });
    if (delivered) {
      return "delivered";
    }
  }

  if (row.provider === "gelato") {
    return optionalString(payload.fulfillmentStatus) ?? optionalString(payload.productionStatus) ?? row.status;
  }

  return row.status;
}

function orderReceivedAtFromRaw(row: typeof orders.$inferSelect, raw: unknown): string | null {
  if (raw && typeof raw === "object") {
    const payload = raw as Record<string, unknown>;
    if (row.provider === "gelato" && typeof payload.orderedAt === "string") {
      return payload.orderedAt;
    }
    if (typeof payload.created_at === "string") {
      return payload.created_at;
    }
    if (typeof payload.createdAt === "string") {
      return payload.createdAt;
    }
  }

  return row.createdAt;
}

function customerNameFromRaw(row: typeof orders.$inferSelect, raw: unknown): string | null {
  if (row.customerName) {
    return row.customerName;
  }

  const payload = rawObject(raw);
  if (row.provider === "gelato") {
    const shippingAddress = rawObject(payload.shippingAddress);
    const recipient = rawObject(payload.recipient);
    const address =
      Object.keys(shippingAddress).length > 0
        ? shippingAddress
        : Object.keys(recipient).length > 0
          ? recipient
          : {};

    return (
      optionalString(address.fullName) ??
      optionalString(address.name) ??
      joinedName(address.firstName, address.lastName) ??
      joinedName(payload.firstName, payload.lastName)
    );
  }

  if (row.provider === "printify") {
    const addressTo = rawObject(payload.address_to);
    return joinedName(addressTo.first_name, addressTo.last_name);
  }

  return null;
}

function customerFieldFromRaw(
  row: typeof orders.$inferSelect,
  raw: unknown,
  columnValue: string | null,
  field: string
): string | null {
  if (columnValue) {
    return columnValue;
  }

  const payload = rawObject(raw);
  if (row.provider === "gelato") {
    const shippingAddress = rawObject(payload.shippingAddress);
    const recipient = rawObject(payload.recipient);
    const address =
      Object.keys(shippingAddress).length > 0
        ? shippingAddress
        : Object.keys(recipient).length > 0
          ? recipient
          : {};

    return optionalString(address[field]);
  }

  return null;
}

function mapOrderRow(
  row: typeof orders.$inferSelect,
  itemRows: Array<typeof orderItems.$inferSelect> = []
): NormalizedOrder {
  const raw = JSON.parse(row.rawJson);
  return {
    provider: row.provider as NormalizedOrder["provider"],
    externalOrderId: row.externalOrderId,
    displayOrderId: displayOrderIdFromRaw(row, raw),
    referenceOrderId: row.referenceOrderId,
    shopId: row.shopId,
    status: statusFromRaw(row, raw),
    sentToProductionAt: row.sentToProductionAt,
    orderReceivedAt: orderReceivedAtFromRaw(row, raw),
    totalCost:
      row.totalCostAmount !== null && row.totalCostCurrency
        ? {
            amount: row.totalCostAmount,
            currency: row.totalCostCurrency
          }
        : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    customer: {
      name: customerNameFromRaw(row, raw),
      city: customerFieldFromRaw(row, raw, row.city, "city"),
      region: customerFieldFromRaw(row, raw, row.region, "state"),
      country: customerFieldFromRaw(row, raw, row.country, "country"),
      email: customerFieldFromRaw(row, raw, row.email, "email"),
      phone: customerFieldFromRaw(row, raw, row.phone, "phone"),
      address1: customerFieldFromRaw(row, raw, row.address1, "addressLine1"),
      address2: customerFieldFromRaw(row, raw, row.address2, "addressLine2"),
      postalCode: customerFieldFromRaw(row, raw, row.postalCode, "postCode")
    },
    items: itemRows.map((item) => ({
      externalItemId: item.externalItemId,
      sku: item.sku,
      title: item.title,
      quantity: item.quantity,
      status: item.status
    })),
    trackingLinks: JSON.parse(row.trackingLinksJson),
    providerUrl: row.providerUrl,
    etaMinAt: row.etaMinAt,
    etaMaxAt: row.etaMaxAt,
    raw
  };
}

export class Repository {
  constructor(
    private readonly db: AppDatabase,
    private readonly config: AppConfig
  ) {}

  async ensureSettings(): Promise<BotSettings> {
    const existing = await this.db.query.settings.findFirst({
      where: eq(settings.telegramChatId, this.config.AUTHORIZED_TELEGRAM_CHAT_ID)
    });

    if (!existing) {
      await this.db.insert(settings).values({
        telegramChatId: this.config.AUTHORIZED_TELEGRAM_CHAT_ID,
        timezone: this.config.DEFAULT_TIMEZONE
      });
    }

    const row = await this.db.query.settings.findFirst({
      where: eq(settings.telegramChatId, this.config.AUTHORIZED_TELEGRAM_CHAT_ID)
    });

    if (!row) {
      throw new Error("Failed to initialize settings");
    }

    return {
      telegramChatId: row.telegramChatId,
      timezone: row.timezone,
      digestEnabled: row.digestEnabled,
      digestOnlyOnUpdates: row.digestOnlyOnUpdates,
      lastDigestSentAt: row.lastDigestSentAt
    };
  }

  async updateSettings(partial: Partial<BotSettings>): Promise<BotSettings> {
    const current = await this.ensureSettings();
    await this.db
      .update(settings)
      .set({
        timezone: partial.timezone ?? current.timezone,
        digestEnabled: partial.digestEnabled ?? current.digestEnabled,
        digestOnlyOnUpdates: partial.digestOnlyOnUpdates ?? current.digestOnlyOnUpdates,
        lastDigestSentAt: partial.lastDigestSentAt ?? current.lastDigestSentAt
      })
      .where(eq(settings.telegramChatId, this.config.AUTHORIZED_TELEGRAM_CHAT_ID));

    return this.ensureSettings();
  }

  async saveProviderKey(
    provider: ProviderKeyName,
    label: string,
    apiKey: string
  ): Promise<ProviderKeyConfig> {
    const now = new Date().toISOString();
    const existing = await this.db.query.providerKeys.findFirst({
      where: and(eq(providerKeys.provider, provider), eq(providerKeys.label, label))
    });

    if (existing) {
      await this.db
        .update(providerKeys)
        .set({
          apiKey,
          updatedAt: now
        })
        .where(eq(providerKeys.id, existing.id));
    } else {
      await this.db.insert(providerKeys).values({
        provider,
        label,
        apiKey,
        createdAt: now,
        updatedAt: now
      });
    }

    const row = await this.db.query.providerKeys.findFirst({
      where: and(eq(providerKeys.provider, provider), eq(providerKeys.label, label))
    });
    if (!row) {
      throw new Error("Failed to save provider key");
    }

    return mapProviderKey(row);
  }

  async listProviderKeys(provider?: ProviderKeyName): Promise<ProviderKeyConfig[]> {
    const rows = provider
      ? await this.db.query.providerKeys.findMany({
          where: eq(providerKeys.provider, provider),
          orderBy: [desc(providerKeys.updatedAt)]
        })
      : await this.db.query.providerKeys.findMany({ orderBy: [desc(providerKeys.updatedAt)] });

    return rows.map(mapProviderKey);
  }

  async getProviderKey(id: number): Promise<ProviderKeyConfig | null> {
    const row = await this.db.query.providerKeys.findFirst({
      where: eq(providerKeys.id, id)
    });

    return row ? mapProviderKey(row) : null;
  }

  async upsertProviderStore(input: {
    keyId: number;
    provider: ProviderKeyName;
    externalStoreId: string;
    name: string;
    enabled: boolean;
  }): Promise<ProviderStoreConfig> {
    const existing = await this.db.query.providerStores.findFirst({
      where: and(
        eq(providerStores.keyId, input.keyId),
        eq(providerStores.externalStoreId, input.externalStoreId)
      )
    });

    const payload = {
      keyId: input.keyId,
      provider: input.provider,
      externalStoreId: input.externalStoreId,
      name: input.name,
      enabled: input.enabled
    };

    if (existing) {
      await this.db.update(providerStores).set(payload).where(eq(providerStores.id, existing.id));
    } else {
      await this.db.insert(providerStores).values(payload);
    }

    const row = await this.db.query.providerStores.findFirst({
      where: and(
        eq(providerStores.keyId, input.keyId),
        eq(providerStores.externalStoreId, input.externalStoreId)
      )
    });
    if (!row) {
      throw new Error("Failed to save provider store");
    }

    const key = await this.getProviderKey(row.keyId);
    if (!key) {
      throw new Error("Provider key not found for store");
    }

    return mapProviderStore(row, key);
  }

  async setProviderStoreEnabled(storeId: number, enabled: boolean): Promise<void> {
    await this.db.update(providerStores).set({ enabled }).where(eq(providerStores.id, storeId));
  }

  async listProviderStores(provider?: ProviderKeyName): Promise<ProviderStoreConfig[]> {
    const rows = provider
      ? await this.db.query.providerStores.findMany({
          where: eq(providerStores.provider, provider),
          orderBy: [desc(providerStores.id)]
        })
      : await this.db.query.providerStores.findMany({ orderBy: [desc(providerStores.id)] });

    return this.mapProviderStores(rows);
  }

  async listEnabledProviderStores(provider?: ProviderKeyName): Promise<ProviderStoreConfig[]> {
    const rows = provider
      ? await this.db.query.providerStores.findMany({
          where: and(eq(providerStores.provider, provider), eq(providerStores.enabled, true)),
          orderBy: [desc(providerStores.id)]
        })
      : await this.db.query.providerStores.findMany({
          where: eq(providerStores.enabled, true),
          orderBy: [desc(providerStores.id)]
        });

    return this.mapProviderStores(rows);
  }

  private async mapProviderStores(
    rows: Array<typeof providerStores.$inferSelect>
  ): Promise<ProviderStoreConfig[]> {
    const keys = await this.listProviderKeys();
    const keyById = new Map(keys.map((key) => [key.id, key]));

    return rows.flatMap((row) => {
      const key = keyById.get(row.keyId);
      return key ? [mapProviderStore(row, key)] : [];
    });
  }

  async upsertOrder(
    order: NormalizedOrder,
    source: "poll"
  ): Promise<{
    isNew: boolean;
    statusChanged: boolean;
    previousStatus: string | null;
    currentStatus: string;
  }> {
    const uniqueKey = orderUniqueKey(order);
    const existing = await this.db.query.orders.findFirst({
      where: eq(orders.uniqueKey, uniqueKey)
    });

    const payload = {
      provider: order.provider,
      externalOrderId: order.externalOrderId,
      displayOrderId: order.displayOrderId,
      referenceOrderId: order.referenceOrderId,
      shopId: order.shopId,
      status: order.status,
      sentToProductionAt: order.sentToProductionAt,
      totalCostAmount: order.totalCost?.amount ?? null,
      totalCostCurrency: order.totalCost?.currency ?? null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      customerName: order.customer.name,
      city: order.customer.city,
      region: order.customer.region,
      country: order.customer.country,
      email: order.customer.email,
      phone: order.customer.phone,
      address1: order.customer.address1,
      address2: order.customer.address2,
      postalCode: order.customer.postalCode,
      trackingLinksJson: JSON.stringify(order.trackingLinks),
      providerUrl: order.providerUrl,
      etaMinAt: order.etaMinAt,
      etaMaxAt: order.etaMaxAt,
      rawJson: JSON.stringify(order.raw),
      uniqueKey
    };

    if (existing) {
      await this.db.update(orders).set(payload).where(eq(orders.uniqueKey, uniqueKey));
    } else {
      await this.db.insert(orders).values(payload);
    }

    await this.db.delete(orderItems).where(eq(orderItems.orderUniqueKey, uniqueKey));
    if (order.items.length > 0) {
      await this.db.insert(orderItems).values(
        order.items.map((item) => ({
          orderUniqueKey: uniqueKey,
          externalItemId: item.externalItemId,
          sku: item.sku,
          title: item.title,
          quantity: item.quantity,
          status: item.status
        }))
      );
    }

    const statusChanged = !existing || existing.status !== order.status;
    if (statusChanged) {
      await this.db.insert(statusEvents).values({
        orderUniqueKey: uniqueKey,
        provider: order.provider,
        externalEventId: `${source}:${uniqueKey}:${order.status}:${order.updatedAt ?? order.createdAt ?? ""}`,
        source,
        status: order.status,
        comment: null,
        occurredAt: order.updatedAt ?? order.createdAt,
        rawJson: JSON.stringify(order.raw)
      });
    }

    return {
      isNew: !existing,
      statusChanged,
      previousStatus: existing?.status ?? null,
      currentStatus: order.status
    };
  }

  async listOpenOrders(): Promise<NormalizedOrder[]> {
    const rows = await this.db.query.orders.findMany({
      where: sql`${orders.status} NOT IN ('delivered', 'canceled', 'cancelled', 'failed', 'returned')`,
      orderBy: [desc(orders.updatedAt)]
    });

    return rows.map((row) => mapOrderRow(row)).filter((order) => !isHiddenOrderStatus(order.status));
  }

  async getOrder(provider: string, externalOrderId: string): Promise<NormalizedOrder | null> {
    const row = await this.db.query.orders.findFirst({
      where: eq(orders.uniqueKey, `${provider}:${externalOrderId}`)
    });

    if (!row) {
      return null;
    }

    const itemRows = await this.db.query.orderItems.findMany({
      where: eq(orderItems.orderUniqueKey, row.uniqueKey)
    });

    return mapOrderRow(row, itemRows);
  }

  async upsertProductionRisk(risk: ProductionRisk): Promise<{ shouldAlert: boolean; risk: ProductionRisk }> {
    const existing = await this.db.query.orderRiskEvents.findFirst({
      where: and(
        eq(orderRiskEvents.orderUniqueKey, risk.orderUniqueKey),
        eq(orderRiskEvents.riskType, risk.riskType),
        sql`${orderRiskEvents.resolvedAt} IS NULL`
      )
    });

    if (!existing) {
      await this.db.insert(orderRiskEvents).values({
        orderUniqueKey: risk.orderUniqueKey,
        provider: risk.provider,
        externalOrderId: risk.externalOrderId,
        riskType: risk.riskType,
        severity: risk.severity,
        reason: risk.reason,
        expectedShipAt: risk.expectedShipAt,
        firstDetectedAt: risk.detectedAt,
        lastDetectedAt: risk.detectedAt,
        lastAlertedAt: risk.detectedAt,
        resolvedAt: null
      });
      return { shouldAlert: true, risk };
    }

    const severityChanged = existing.severity !== risk.severity || existing.reason !== risk.reason;
    await this.db
      .update(orderRiskEvents)
      .set({
        severity: risk.severity,
        reason: risk.reason,
        expectedShipAt: risk.expectedShipAt,
        lastDetectedAt: risk.detectedAt,
        lastAlertedAt: severityChanged ? risk.detectedAt : existing.lastAlertedAt
      })
      .where(eq(orderRiskEvents.id, existing.id));

    return {
      shouldAlert: severityChanged,
      risk: {
        ...risk,
        detectedAt: existing.firstDetectedAt
      }
    };
  }

  async resolveProductionRisks(orderUniqueKeyValue: string, resolvedAt = new Date().toISOString()): Promise<void> {
    await this.db
      .update(orderRiskEvents)
      .set({ resolvedAt })
      .where(and(eq(orderRiskEvents.orderUniqueKey, orderUniqueKeyValue), sql`${orderRiskEvents.resolvedAt} IS NULL`));
  }

  async listRecentStatusEvents(sinceIso: string | null): Promise<Array<{ orderUniqueKey: string; status: string; occurredAt: string | null }>> {
    const rows = sinceIso
      ? await this.db.query.statusEvents.findMany({
          where: sql`${statusEvents.occurredAt} >= ${sinceIso}`,
          orderBy: [desc(statusEvents.occurredAt)]
        })
      : await this.db.query.statusEvents.findMany({ orderBy: [desc(statusEvents.occurredAt)] });

    return rows.map((row) => ({
      orderUniqueKey: row.orderUniqueKey,
      status: row.status,
      occurredAt: row.occurredAt
    }));
  }

  async listKnownGelatoOrders(): Promise<NormalizedOrder[]> {
    const rows = await this.db.query.orders.findMany({
      where: eq(orders.provider, "gelato")
    });

    return rows.map((row) => mapOrderRow(row));
  }

}

function mapProviderKey(row: typeof providerKeys.$inferSelect): ProviderKeyConfig {
  return {
    id: row.id,
    provider: row.provider as ProviderKeyName,
    label: row.label,
    apiKey: row.apiKey,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapProviderStore(
  row: typeof providerStores.$inferSelect,
  key: ProviderKeyConfig
): ProviderStoreConfig {
  return {
    id: row.id,
    keyId: row.keyId,
    provider: row.provider as ProviderKeyName,
    label: key.label,
    apiKey: key.apiKey,
    externalStoreId: row.externalStoreId,
    name: row.name,
    enabled: row.enabled
  };
}
