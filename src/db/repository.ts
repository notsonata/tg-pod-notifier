import { and, desc, eq, sql } from "drizzle-orm";

import type { AppConfig } from "../config.js";
import type {
  BotSettings,
  NormalizedOrder
} from "../domain/types.js";
import type { AppDatabase } from "./client.js";
import { orderItems, orders, settings, statusEvents } from "./schema.js";

function orderUniqueKey(order: Pick<NormalizedOrder, "provider" | "externalOrderId">): string {
  return `${order.provider}:${order.externalOrderId}`;
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
      printifyShopId: row.printifyShopId,
      printifyShopName: row.printifyShopName,
      timezone: row.timezone,
      digestEnabled: row.digestEnabled,
      lastDigestSentAt: row.lastDigestSentAt
    };
  }

  async updateSettings(partial: Partial<BotSettings>): Promise<BotSettings> {
    const current = await this.ensureSettings();
    await this.db
      .update(settings)
      .set({
        printifyShopId: partial.printifyShopId ?? current.printifyShopId,
        printifyShopName: partial.printifyShopName ?? current.printifyShopName,
        timezone: partial.timezone ?? current.timezone,
        digestEnabled: partial.digestEnabled ?? current.digestEnabled,
        lastDigestSentAt: partial.lastDigestSentAt ?? current.lastDigestSentAt
      })
      .where(eq(settings.telegramChatId, this.config.AUTHORIZED_TELEGRAM_CHAT_ID));

    return this.ensureSettings();
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

    return rows.map((row) => ({
      provider: row.provider as NormalizedOrder["provider"],
      externalOrderId: row.externalOrderId,
      referenceOrderId: row.referenceOrderId,
      shopId: row.shopId,
      status: row.status,
      sentToProductionAt: row.sentToProductionAt,
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
        name: row.customerName,
        city: row.city,
        region: row.region,
        country: row.country,
        email: row.email,
        phone: row.phone,
        address1: row.address1,
        address2: row.address2,
        postalCode: row.postalCode
      },
      items: [],
      trackingLinks: JSON.parse(row.trackingLinksJson),
      providerUrl: row.providerUrl,
      etaMinAt: row.etaMinAt,
      etaMaxAt: row.etaMaxAt,
      raw: JSON.parse(row.rawJson)
    }));
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

    return {
      provider: row.provider as NormalizedOrder["provider"],
      externalOrderId: row.externalOrderId,
      referenceOrderId: row.referenceOrderId,
      shopId: row.shopId,
      status: row.status,
      sentToProductionAt: row.sentToProductionAt,
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
        name: row.customerName,
        city: row.city,
        region: row.region,
        country: row.country,
        email: row.email,
        phone: row.phone,
        address1: row.address1,
        address2: row.address2,
        postalCode: row.postalCode
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
      raw: JSON.parse(row.rawJson)
    };
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

    return rows.map((row) => ({
      provider: "gelato",
      externalOrderId: row.externalOrderId,
      referenceOrderId: row.referenceOrderId,
      shopId: row.shopId,
      status: row.status,
      sentToProductionAt: row.sentToProductionAt,
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
        name: row.customerName,
        city: row.city,
        region: row.region,
        country: row.country,
        email: row.email,
        phone: row.phone,
        address1: row.address1,
        address2: row.address2,
        postalCode: row.postalCode
      },
      items: [],
      trackingLinks: JSON.parse(row.trackingLinksJson),
      providerUrl: row.providerUrl,
      etaMinAt: row.etaMinAt,
      etaMaxAt: row.etaMaxAt,
      raw: JSON.parse(row.rawJson)
    }));
  }

  async getSelectedPrintifyShopId(): Promise<string | null> {
    const current = await this.ensureSettings();
    return current.printifyShopId ?? this.config.PRINTIFY_SHOP_ID ?? null;
  }
}
