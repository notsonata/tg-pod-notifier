import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import type { AppConfig } from "../src/config.js";
import { createDatabase } from "../src/db/client.js";
import { Repository } from "../src/db/repository.js";
import type { NormalizedOrder } from "../src/domain/types.js";

function makeRepository() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "tg-notifier-"));
  const { db } = createDatabase(path.join(dir, "test.sqlite"));
  const config: AppConfig = {
    TELEGRAM_BOT_TOKEN: "token",
    AUTHORIZED_TELEGRAM_CHAT_ID: "-1001",
    GELATO_API_KEY: "legacy-gelato",
    GELATO_STORE_ID: "legacy-store",
    PRINTIFY_API_TOKEN: "legacy-printify",
    PRINTIFY_SHOP_ID: undefined,
    DATABASE_PATH: path.join(dir, "test.sqlite"),
    PORT: 38127,
    DEFAULT_TIMEZONE: "UTC"
  };

  return new Repository(db, config);
}

describe("provider configuration repository", () => {
  test("stores a Printify key and toggled shops", async () => {
    const repository = makeRepository();
    const key = await repository.saveProviderKey("printify", "Printify Main", "printify-token");

    await repository.upsertProviderStore({
      keyId: key.id,
      provider: "printify",
      externalStoreId: "shop-1",
      name: "Peddlex",
      enabled: true
    });
    await repository.upsertProviderStore({
      keyId: key.id,
      provider: "printify",
      externalStoreId: "shop-2",
      name: "Disabled Shop",
      enabled: false
    });

    await expect(repository.listEnabledProviderStores("printify")).resolves.toEqual([
      {
        id: expect.any(Number),
        keyId: key.id,
        provider: "printify",
        label: "Printify Main",
        apiKey: "printify-token",
        externalStoreId: "shop-1",
        name: "Peddlex",
        enabled: true
      }
    ]);
  });

  test("stores Gelato key and manually named stores", async () => {
    const repository = makeRepository();
    const key = await repository.saveProviderKey("gelato", "Gelato Main", "gelato-token");

    await repository.upsertProviderStore({
      keyId: key.id,
      provider: "gelato",
      externalStoreId: "gelato-store-1",
      name: "Peddlex",
      enabled: true
    });

    const stores = await repository.listEnabledProviderStores("gelato");
    expect(stores[0]).toMatchObject({
      provider: "gelato",
      label: "Gelato Main",
      apiKey: "gelato-token",
      externalStoreId: "gelato-store-1",
      name: "Peddlex",
      enabled: true
    });
  });

  test("derives Printify display id and delivered status from legacy raw payload rows", async () => {
    const repository = makeRepository();
    const legacyOrder: NormalizedOrder = {
      provider: "printify",
      externalOrderId: "69c794cdf6f65f1e87064ade",
      displayOrderId: null,
      referenceOrderId: null,
      shopId: "13091824",
      status: "fulfilled",
      sentToProductionAt: null,
      totalCost: null,
      createdAt: "2026-03-28T08:43:57.000Z",
      updatedAt: "2026-03-28T08:43:57.000Z",
      customer: {
        name: "PII_DELETED PII_DELETED",
        city: null,
        region: null,
        country: null,
        email: null,
        phone: null,
        address1: null,
        address2: null,
        postalCode: null
      },
      items: [],
      trackingLinks: [],
      providerUrl: null,
      etaMinAt: null,
      etaMaxAt: null,
      raw: {
        id: "69c794cdf6f65f1e87064ade",
        app_order_id: "13091824.375",
        status: "fulfilled",
        metadata: {
          shop_order_label: "4014746623"
        },
        shipments: [
          {
            delivered_at: "2026-04-02 16:29:00+00:00"
          }
        ]
      }
    };

    await repository.upsertOrder(legacyOrder, "poll");

    await expect(repository.listOpenOrders()).resolves.toEqual([]);
    await expect(repository.getOrder("printify", "69c794cdf6f65f1e87064ade")).resolves.toMatchObject({
      displayOrderId: "4014746623",
      status: "delivered"
    });
  });
});
