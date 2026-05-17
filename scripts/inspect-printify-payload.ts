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
    const rows = db
      .prepare(
        `
      SELECT provider_keys.api_key, provider_stores.external_store_id, provider_stores.name
      FROM provider_stores
      JOIN provider_keys ON provider_keys.id = provider_stores.key_id
      WHERE provider_stores.provider = 'printify'
        AND provider_stores.enabled = 1
      LIMIT 3
    `
      )
      .all() as StoreRow[];
    if (rows.length > 0) {
      return rows;
    }
  } catch {
    // Fall back to legacy env below.
  }

  if (process.env.PRINTIFY_API_TOKEN && process.env.PRINTIFY_SHOP_ID) {
    return [
      {
        api_key: process.env.PRINTIFY_API_TOKEN,
        external_store_id: process.env.PRINTIFY_SHOP_ID,
        name: "PRINTIFY_SHOP_ID"
      }
    ];
  }

  return [];
}

type PrintifyShop = {
  id: string | number;
  title?: string;
};

async function printifyRequest<T>(apiKey: string, path: string): Promise<T> {
  const response = await fetch(`https://api.printify.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });

  if (!response.ok) {
    throw new Error(`Printify ${path} failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as T;
}

function candidateFields(order: Record<string, unknown>): Record<string, unknown> {
  return {
    id: order.id,
    app_order_id: order.app_order_id,
    status: order.status,
    created_at: order.created_at,
    updated_at: order.updated_at,
    sent_to_production_at: order.sent_to_production_at,
    metadata: order.metadata,
    address_to: order.address_to,
    shipments: Array.isArray(order.shipments)
      ? order.shipments.map((shipment) => {
          const row = shipment as Record<string, unknown>;
          return {
            carrier: row.carrier,
            tracking_number: row.tracking_number,
            tracking_url: row.tracking_url,
            status: row.status,
            shipped_at: row.shipped_at,
            delivered_at: row.delivered_at
          };
        })
      : order.shipments,
    line_items: Array.isArray(order.line_items)
      ? order.line_items.map((item) => {
          const row = item as Record<string, unknown>;
          return {
            id: row.id,
            product_id: row.product_id,
            status: row.status,
            is_deleted: row.is_deleted,
            metadata: row.metadata
          };
        })
      : order.line_items
  };
}

let stores = configuredStores();
if (stores.length === 0 && process.env.PRINTIFY_API_TOKEN) {
  const shops = await printifyRequest<PrintifyShop[]>(process.env.PRINTIFY_API_TOKEN, "/shops.json");
  stores = shops.slice(0, 3).map((shop) => ({
    api_key: process.env.PRINTIFY_API_TOKEN ?? "",
    external_store_id: String(shop.id),
    name: shop.title ?? `Shop ${shop.id}`
  }));
  console.log(
    `No local Printify store config found. Inspecting first ${stores.length} shop(s) from /shops.json.`
  );
}

for (const store of stores) {
  console.log(`\nStore: ${store.name} (${store.external_store_id})`);
  const requestedOrderIds = process.argv.slice(2);
  if (requestedOrderIds.length > 0) {
    for (const id of requestedOrderIds) {
      try {
        const detail = await printifyRequest<Record<string, unknown>>(
          store.api_key,
          `/shops/${store.external_store_id}/orders/${id}.json`
        );
        console.log(`\nDetail for ${id}:`);
        console.log("Detail keys:", Object.keys(detail).sort());
        console.log("Detail candidate fields:", JSON.stringify(candidateFields(detail), null, 2));
      } catch (error) {
        console.log(
          `Detail fetch failed for ${id}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
    continue;
  }

  const list = await printifyRequest<{ data?: Array<Record<string, unknown>> }>(
    store.api_key,
    `/shops/${store.external_store_id}/orders.json`
  );

  for (const order of (list.data ?? []).slice(0, 12)) {
    console.log("\nList keys:", Object.keys(order).sort());
    console.log("List candidate fields:", JSON.stringify(candidateFields(order), null, 2));

    const id = String(order.id ?? "");
    if (!id) {
      continue;
    }

    try {
      const detail = await printifyRequest<Record<string, unknown>>(
        store.api_key,
        `/shops/${store.external_store_id}/orders/${id}.json`
      );
      console.log("Detail keys:", Object.keys(detail).sort());
      console.log("Detail candidate fields:", JSON.stringify(candidateFields(detail), null, 2));
    } catch (error) {
      console.log("Detail fetch failed:", error instanceof Error ? error.message : String(error));
    }
  }
}

if (stores.length === 0) {
  console.log("No enabled Printify stores found in local SQLite config or PRINTIFY_SHOP_ID.");
}
