import { describe, expect, test } from "vitest";

import { evaluateOrderAlert } from "../src/domain/alerts.js";
import type { NormalizedOrder } from "../src/domain/types.js";

const baseOrder: NormalizedOrder = {
  provider: "printify",
  externalOrderId: "order-1",
  referenceOrderId: null,
  shopId: "123",
  status: "pending",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
  customer: {
    name: "Jane Doe",
    city: "Austin",
    region: "TX",
    country: "US",
    email: "jane@example.com",
    phone: "+1",
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

describe("evaluateOrderAlert", () => {
  test("returns warning when an order has no updates for the configured stale window", () => {
    const result = evaluateOrderAlert(
      { ...baseOrder, status: "pending" },
      {
        nowIso: "2025-01-04T00:00:00.000Z",
        staleDays: 3
      }
    );

    expect(result?.severity).toBe("warning");
    expect(result?.reason).toBe("stale-order");
  });

  test("does not alert before the stale threshold is reached", () => {
    const result = evaluateOrderAlert(
      { ...baseOrder, status: "pending" },
      {
        nowIso: "2025-01-02T23:59:59.000Z",
        staleDays: 3
      }
    );

    expect(result).toBeNull();
  });

  test("returns critical when the expected arrival date has passed", () => {
    const result = evaluateOrderAlert(
      {
        ...baseOrder,
        status: "shipped",
        etaMaxAt: "2025-01-02T00:00:00.000Z"
      },
      {
        nowIso: "2025-01-03T00:00:00.000Z",
        staleDays: 3
      }
    );

    expect(result?.severity).toBe("critical");
    expect(result?.reason).toBe("delayed-order");
  });
});
