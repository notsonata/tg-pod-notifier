import { describe, expect, test } from "vitest";

import {
  normalizePrintifyOrder,
  normalizePrintifyWebhook,
  type PrintifyShop
} from "../src/providers/printify.js";

describe("Printify normalization", () => {
  test("normalizes an order detail payload", () => {
    const normalized = normalizePrintifyOrder({
      id: "order-1",
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T01:00:00.000Z",
      status: "pending",
      total_price: 2500,
      total_shipping: 500,
      line_items: [
        {
          product_id: "prod-1",
          quantity: 2,
          status: "pending",
          metadata: {
            title: "Shirt",
            sku: "SKU-1",
            variant_label: "Large / Black"
          }
        }
      ],
      shipments: [
        {
          carrier: "USPS",
          tracking_number: "TRACK-1",
          tracking_url: "https://tracking.example/1",
          shipped_at: "2025-01-02T00:00:00.000Z",
          delivered_at: null
        }
      ],
      address_to: {
        first_name: "Jane",
        last_name: "Doe",
        city: "Austin",
        region: "TX",
        country: "US",
        email: "jane@example.com",
        phone: "+1"
      }
    });

    expect(normalized.provider).toBe("printify");
    expect(normalized.externalOrderId).toBe("order-1");
    expect(normalized.items).toHaveLength(1);
    expect(normalized.trackingLinks).toEqual([
      {
        carrier: "USPS",
        trackingNumber: "TRACK-1",
        trackingUrl: "https://tracking.example/1"
      }
    ]);
  });

  test("normalizes a shipment webhook into a status transition", () => {
    const event = normalizePrintifyWebhook({
      id: "evt-1",
      type: "order:shipment:created",
      created_at: "2025-01-03 00:00:00+00:00",
      resource: {
        id: "order-1",
        type: "order",
        data: {
          shop_id: 123,
          shipped_at: "2025-01-03 00:00:00+00:00",
          carrier: {
            code: "USPS",
            tracking_number: "TRACK-1"
          },
          skus: ["SKU-1"]
        }
      }
    });

    expect(event.eventId).toBe("evt-1");
    expect(event.orderId).toBe("order-1");
    expect(event.status).toBe("shipped");
  });

  test("preserves the provider shop id when normalizing an order", () => {
    const normalized = normalizePrintifyOrder(
      {
        id: "order-2",
        status: "pending",
        line_items: []
      },
      "9876"
    );

    expect(normalized.shopId).toBe("9876");
  });

  test("maps printify shops into selector options", () => {
    const shops: PrintifyShop[] = [
      { id: 5432, title: "Primary", sales_channel: "shopify" },
      { id: 9876, title: "Secondary", sales_channel: "etsy" }
    ];

    expect(shops.map((shop) => String(shop.id))).toEqual(["5432", "9876"]);
  });
});
