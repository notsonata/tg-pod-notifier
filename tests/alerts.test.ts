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
  test("returns critical for provider error states", () => {
    const result = evaluateOrderAlert(
      { ...baseOrder, status: "failed" },
      {
        nowIso: "2025-01-01T01:00:00.000Z",
        preProductionHours: 2,
        holdHours: 24,
        productionBusinessDays: 3
      }
    );

    expect(result?.severity).toBe("critical");
    expect(result?.reason).toBe("provider-error");
  });

  test("returns warning when a pre-production order exceeds its threshold", () => {
    const result = evaluateOrderAlert(
      { ...baseOrder, status: "pending" },
      {
        nowIso: "2025-01-01T03:00:01.000Z",
        preProductionHours: 2,
        holdHours: 24,
        productionBusinessDays: 3
      }
    );

    expect(result?.severity).toBe("warning");
    expect(result?.reason).toBe("pre-production-stale");
  });

  test("returns critical when shipped orders exceed provider eta", () => {
    const result = evaluateOrderAlert(
      {
        ...baseOrder,
        status: "shipped",
        etaMaxAt: "2025-01-02T00:00:00.000Z"
      },
      {
        nowIso: "2025-01-03T00:00:00.000Z",
        preProductionHours: 2,
        holdHours: 24,
        productionBusinessDays: 3
      }
    );

    expect(result?.severity).toBe("critical");
    expect(result?.reason).toBe("eta-exceeded");
  });
});
