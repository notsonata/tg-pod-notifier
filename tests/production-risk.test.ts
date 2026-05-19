import { describe, expect, test } from "vitest";

import type { NormalizedOrder } from "../src/domain/types.js";
import {
  detectProductionRisk,
  renderProductionRiskAlert,
  type ProductionRisk
} from "../src/jobs/production-risk.js";

const baseOrder: NormalizedOrder = {
  provider: "gelato",
  externalOrderId: "gelato-1",
  displayOrderId: "4059362517",
  referenceOrderId: "4059362517",
  shopId: "store-1",
  status: "in_production",
  sentToProductionAt: null,
  orderReceivedAt: "2026-05-12T18:54:06.000Z",
  totalCost: null,
  createdAt: "2026-05-11T01:06:46.000Z",
  updatedAt: "2026-05-14T12:00:00.000Z",
  customer: {
    name: "Juliet Smith",
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
  raw: {}
};

describe("detectProductionRisk", () => {
  test("flags Gelato orders that are past shipment due date and not shipped", () => {
    const risk = detectProductionRisk(
      {
        ...baseOrder,
        raw: {
          shipmentDueDate: "2026-05-14T00:00:00+00:00",
          shippedAt: null
        }
      },
      new Date("2026-05-15T00:00:00.000Z")
    );

    expect(risk).toMatchObject({
      riskType: "past_due",
      severity: "critical",
      expectedShipAt: "2026-05-14T00:00:00.000Z"
    });
  });

  test("flags Gelato orders due soon and not shipped", () => {
    const risk = detectProductionRisk(
      {
        ...baseOrder,
        raw: {
          shipmentDueDate: "2026-05-14T12:00:00+00:00",
          shippedAt: null
        }
      },
      new Date("2026-05-14T00:30:00.000Z")
    );

    expect(risk).toMatchObject({
      riskType: "due_soon",
      severity: "warning",
      expectedShipAt: "2026-05-14T12:00:00.000Z"
    });
  });

  test("flags Printify orders stuck in production with no tracking", () => {
    const risk = detectProductionRisk(
      {
        ...baseOrder,
        provider: "printify",
        status: "in-production",
        sentToProductionAt: "2026-05-10T00:00:00.000Z",
        raw: {}
      },
      new Date("2026-05-13T01:00:00.000Z")
    );

    expect(risk).toMatchObject({
      riskType: "stuck_in_production",
      severity: "warning"
    });
  });

  test("does not flag shipped orders", () => {
    const risk = detectProductionRisk(
      {
        ...baseOrder,
        status: "shipped",
        raw: {
          shipmentDueDate: "2026-05-14T00:00:00+00:00",
          shippedAt: "2026-05-14T10:00:00+00:00"
        }
      },
      new Date("2026-05-15T00:00:00.000Z")
    );

    expect(risk).toBeNull();
  });
});

describe("renderProductionRiskAlert", () => {
  test("renders a distinct production risk variation of order details", () => {
    const risk: ProductionRisk = {
      orderUniqueKey: "gelato:gelato-1",
      provider: "gelato",
      externalOrderId: "gelato-1",
      riskType: "past_due",
      severity: "critical",
      reason: "Expected ship date has passed and the order is not marked shipped.",
      expectedShipAt: "2026-05-14T00:00:00.000Z",
      detectedAt: "2026-05-15T00:00:00.000Z"
    };

    expect(
      renderProductionRiskAlert(baseOrder, risk, { "store-1": "Peddlex" }, new Date("2026-05-15T00:00:00.000Z"))
    ).toBe([
      "⚠️⚠️ Production risk",
      "",
      "🌐 Gelato",
      "🏬 Peddlex",
      "",
      "📦 Order: <code>4059362517</code>",
      "📥 Order received: Tue, May 12",
      "🏭 Sent to production: Pending",
      "📍 Status: In production",
      "",
      "⚠️ Risk: Expected ship date has passed and the order is not marked shipped.",
      "⏱️ Risk age: Just now",
      "📅 Expected ship date: Thu, May 14",
      "",
      "👤 Customer: Juliet Smith",
      "💵 Total cost: Pending",
      "",
      "🚚 Tracking: Pending"
    ].join("\n"));
  });
});
