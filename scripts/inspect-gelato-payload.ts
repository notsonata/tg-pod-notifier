import Database from "better-sqlite3";
import { config as loadEnv } from "dotenv";

loadEnv();

const databasePath = process.env.DATABASE_PATH ?? "./data/tg-notifier.sqlite";
type StoreRow = {
  api_key: string;
  external_store_id: string;
  name: string;
};

function configuredStores(): StoreRow[] {
  try {
    const db = new Database(databasePath, { readonly: true });
    return db
      .prepare(
        `
      SELECT provider_keys.api_key, provider_stores.external_store_id, provider_stores.name
      FROM provider_stores
      JOIN provider_keys ON provider_keys.id = provider_stores.key_id
      WHERE provider_stores.provider = 'gelato'
        AND provider_stores.enabled = 1
      LIMIT 3
    `
      )
      .all() as StoreRow[];
  } catch {
    if (process.env.GELATO_API_KEY && process.env.GELATO_STORE_ID) {
      return [
        {
          api_key: process.env.GELATO_API_KEY,
          external_store_id: process.env.GELATO_STORE_ID,
          name: "GELATO_STORE_ID"
        }
      ];
    }
    return [];
  }
}

const stores = configuredStores();

function getPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[part];
  }, value);
}

function candidateNames(order: unknown): Record<string, unknown> {
  const paths = [
    "recipient.firstName",
    "recipient.lastName",
    "recipient.name",
    "recipient.fullName",
    "recipient.companyName",
    "shippingAddress.firstName",
    "shippingAddress.lastName",
    "shippingAddress.name",
    "shippingAddress.fullName",
    "shippingAddress.companyName",
    "customer.firstName",
    "customer.lastName",
    "customer.name",
    "customer.fullName",
    "firstName",
    "lastName",
    "name"
  ];

  return Object.fromEntries(paths.map((path) => [path, getPath(order, path)]).filter(([, value]) => value));
}

async function gelatoRequest<T>(apiKey: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://order.gelatoapis.com${path}`, {
    ...init,
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
      ...init.headers
    }
  });

  if (!response.ok) {
    throw new Error(`Gelato ${path} failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as T;
}

for (const store of stores) {
  console.log(`\nStore: ${store.name} (${store.external_store_id})`);
  const search = await gelatoRequest<{ orders?: Array<Record<string, unknown>> }>(
    store.api_key,
    "/v4/orders:search",
    {
      method: "POST",
      body: JSON.stringify({
        orderTypes: ["order"],
        storeIds: [store.external_store_id],
        limit: 5
      })
    }
  );

  for (const order of search.orders ?? []) {
    console.log("\nSearch order keys:", Object.keys(order).sort());
    console.log("Search ids:", {
      id: order.id,
      orderReferenceId: order.orderReferenceId,
      storeId: order.storeId,
      fulfillmentStatus: order.fulfillmentStatus,
      productionStatus: order.productionStatus
    });
    console.log("Search candidate names:", candidateNames(order));

    const detailId = String(order.id ?? order.orderReferenceId ?? "");
    if (!detailId) {
      continue;
    }

    try {
      const detail = await gelatoRequest<Record<string, unknown>>(store.api_key, `/v4/orders/${detailId}`);
      console.log("Detail keys:", Object.keys(detail).sort());
      console.log("Detail candidate names:", candidateNames(detail));
      console.log("Detail totals:", {
        currency: detail.currency,
        totalInclVat: detail.totalInclVat,
        receipts: Array.isArray(detail.receipts)
          ? detail.receipts.slice(0, 2).map((receipt) => ({
              currency: (receipt as Record<string, unknown>).currency,
              totalInclVat: (receipt as Record<string, unknown>).totalInclVat
            }))
          : undefined
      });
      console.log("Detail shipment packages:", {
        packages: Array.isArray((detail.shipment as Record<string, unknown> | undefined)?.packages)
          ? ((detail.shipment as Record<string, unknown>).packages as unknown[]).length
          : 0
      });
    } catch (error) {
      console.log("Detail fetch failed:", error instanceof Error ? error.message : String(error));
    }
  }
}

if (stores.length === 0) {
  console.log("No enabled Gelato stores found in local SQLite config.");
}
