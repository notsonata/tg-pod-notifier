import { describe, expect, test } from "vitest";

import type { BotSettings, NormalizedOrder } from "../src/domain/types.js";
import { renderOrderDetails } from "../src/telegram/render.js";

const settings: BotSettings = {
  telegramChatId: "-1001",
  printifyShopId: "13091824",
  printifyShopName: "Framework Supply Store",
  timezone: "UTC",
  digestEnabled: true,
  digestHour: 9,
  digestMinute: 0,
  digestStatuses: [],
  digestStuckOnly: false,
  piiName: true,
  piiEmail: false,
  piiPhone: false,
  piiAddress: true,
  thresholds: {
    staleDays: 3
  },
  lastDigestSentAt: null
};

const order: NormalizedOrder = {
  provider: "printify",
  externalOrderId: "69d52d6b24b9796bcd0604aa",
  referenceOrderId: null,
  shopId: "13091824",
  status: "fulfilled",
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
  test("uses the configured printify shop name and blank-line spacing", () => {
    const rendered = renderOrderDetails(order, settings, "fulfilled");

    expect(rendered).toContain("✅ Fulfilled Order\n\n[Printify]\n[Store Framework Supply Store]\nOrder ID: 69d52d6b24b9796bcd0604aa");
    expect(rendered).toContain("\n\nStatus: fulfilled\nCreated: 2026-04-07T16:14:35.000Z");
    expect(rendered).toContain("\n\nName: Jordan Larkin\nLocation: CASCADE, IA, United States\nAddress: 721 Riverbend Dr NE, 52033-7600");
  });
});
