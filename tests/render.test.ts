import { describe, expect, test } from "vitest";

import type { BotSettings, NormalizedOrder } from "../src/domain/types.js";
import { renderDigest, renderOrderDetails } from "../src/telegram/render.js";

const settings: BotSettings = {
  telegramChatId: "-1001",
  timezone: "UTC",
  digestEnabled: true,
  digestOnlyOnUpdates: false,
  lastDigestSentAt: null
};

const order: NormalizedOrder = {
  provider: "printify",
  externalOrderId: "69d52d6b24b9796bcd0604aa",
  displayOrderId: "4052650188",
  referenceOrderId: null,
  shopId: "13091824",
  status: "fulfilled",
  sentToProductionAt: "2026-05-10T00:00:00.000Z",
  orderReceivedAt: "2026-04-07T16:14:35.000Z",
  totalCost: {
    amount: 5788,
    currency: "USD"
  },
  createdAt: "2026-04-07T16:14:35.000Z",
  updatedAt: "2026-04-07T16:14:35.000Z",
  customer: {
    name: "Jordan Larkin",
    city: "CASCADE",
    region: "IA",
    country: "United States",
    email: null,
    phone: null,
    address1: "721 Riverbend Dr NE",
    address2: null,
    postalCode: "52033-7600"
  },
  items: [],
  trackingLinks: [],
  providerUrl: null,
  etaMinAt: null,
  etaMaxAt: null,
  raw: {}
};

describe("renderOrderDetails", () => {
  test("renders the single provider-neutral order status template", () => {
    const rendered = renderOrderDetails(order, settings, { "13091824": "Peddlex" });

    expect(rendered).toBe([
      "🖨️ Printify",
      "🏬 Peddlex",
      "",
      "📦 Order: <code>4052650188</code>",
      "📥 Order received: Tue, Apr 07",
      "🏭 Sent to production: Sun, May 10",
      "",
      "👤 Customer: Jordan Larkin",
      "💵 Total cost: USD 57.88",
      "",
      "🚚 Tracking: Pending",
      "📍 Status: Ready to ship"
    ].join("\n"));
  });

  test("shows pending placeholders when production date and tracking are missing", () => {
    const rendered = renderOrderDetails(
      {
        ...order,
        status: "pending",
        sentToProductionAt: null,
        totalCost: null,
        customer: {
          ...order.customer,
          name: null
        }
      },
      settings
    );

    expect(rendered).toContain("🏭 Sent to production: Pending");
    expect(rendered).toContain("👤 Customer: Unknown");
    expect(rendered).toContain("💵 Total cost: Pending");
    expect(rendered).toContain("🚚 Tracking: Pending");
    expect(rendered).toContain("📍 Status: On hold");
  });

  test("does not show tracking as pending when a delivered order has no tracking number", () => {
    const rendered = renderOrderDetails(
      {
        ...order,
        status: "delivered",
        trackingLinks: []
      },
      settings,
      { "13091824": "Peddlex" }
    );

    expect(rendered).toContain("🚚 Tracking: Delivered, no tracking number");
    expect(rendered).not.toContain("📍 Status:");
  });
});

describe("renderDigest", () => {
  test("renders grouped provider sections with compact order rows", () => {
    const rendered = renderDigest(
      [
        order,
        {
          ...order,
          provider: "gelato",
          externalOrderId: "gelato-order-1",
          displayOrderId: "G-260515162121",
          status: "in_production",
          customer: {
            ...order.customer,
            name: "Jane Doe"
          }
        }
      ],
      [
        {
          orderUniqueKey: "printify:69d52d6b24b9796bcd0604aa",
          status: "in-production",
          occurredAt: "2026-05-10T00:00:00.000Z"
        }
      ],
      {
        ...settings
      },
      {
        "13091824": "Peddlex"
      }
    );

    expect(rendered).toBe([
      "📋 Order Digest",
      "",
      "Printify",
      "🏬 Peddlex",
      "",
      "📦 Order: <code>4052650188</code>",
      "👤 Customer: Jordan Larkin",
      "📍 Status: Ready to ship &lt;- In production",
      "",
      "Gelato",
      "🏬 Peddlex",
      "",
      "📦 Order: <code>G-260515162121</code>",
      "👤 Customer: Jane Doe",
      "📍 Status: In production"
    ].join("\n"));
  });

  test("renders a simple empty digest", () => {
    expect(renderDigest([], [])).toBe("📋 Order Digest\n\nNo active orders.");
  });

  test("omits delivered orders from the digest", () => {
    expect(renderDigest([{ ...order, status: "delivered" }], [])).toBe(
      "📋 Order Digest\n\nNo active orders."
    );
  });
});
