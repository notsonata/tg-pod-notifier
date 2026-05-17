import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import type { AppConfig } from "../src/config.js";
import { createDatabase } from "../src/db/client.js";
import { Repository } from "../src/db/repository.js";

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
});
