import { config as loadEnv } from "dotenv";

import { loadConfig } from "../src/config.js";
import { createDatabase } from "../src/db/client.js";
import { Repository } from "../src/db/repository.js";
import { PrintifyClient } from "../src/providers/printify.js";

loadEnv();

const TOPICS = [
  "order:created",
  "order:updated",
  "order:sent-to-production",
  "order:shipment:created",
  "order:shipment:delivered"
] as const;

interface PrintifyWebhook {
  id: string | number;
  topic: string;
  url: string;
}

async function request<T>(
  token: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`https://api.printify.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`Printify webhook request failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as T;
}

async function main() {
  const config = loadConfig();
  const { db } = createDatabase(config.DATABASE_PATH);
  const repository = new Repository(db, config);
  const printify = new PrintifyClient(config.PRINTIFY_API_TOKEN);
  const settings = await repository.ensureSettings();
  const shopId = settings.printifyShopId ?? config.PRINTIFY_SHOP_ID;
  const webhookSecret = process.env.PRINTIFY_WEBHOOK_SECRET;

  if (!shopId) {
    throw new Error("No Printify shop selected. Select a shop in Telegram settings first or set PRINTIFY_SHOP_ID.");
  }

  const shops = await printify.listShops();
  const selectedShop = shops.find((shop) => String(shop.id) === shopId);
  if (selectedShop) {
    await repository.updateSettings({
      printifyShopId: shopId,
      printifyShopName: selectedShop.title
    });
  }

  const existing = await request<PrintifyWebhook[]>(
    config.PRINTIFY_API_TOKEN,
    `/shops/${shopId}/webhooks.json`
  );

  for (const topic of TOPICS) {
    const alreadyExists = existing.some(
      (webhook) =>
        webhook.topic === topic &&
        webhook.url === `${config.PUBLIC_WEBHOOK_BASE_URL}/webhooks/printify`
    );

    if (alreadyExists) {
      console.log(`Webhook already exists for ${topic}`);
      continue;
    }

    await request(
      config.PRINTIFY_API_TOKEN,
      `/shops/${shopId}/webhooks.json`,
      {
        method: "POST",
        body: JSON.stringify({
          topic,
          url: `${config.PUBLIC_WEBHOOK_BASE_URL}/webhooks/printify`,
          ...(webhookSecret ? { secret: webhookSecret } : {})
        })
      }
    );

    console.log(`Created webhook for ${topic}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
