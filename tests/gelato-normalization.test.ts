import { describe, expect, test } from "vitest";

import { normalizeGelatoOrder } from "../src/providers/gelato.js";

describe("Gelato normalization", () => {
  test("normalizes a status response for known order refresh", () => {
    const normalized = normalizeGelatoOrder({
      id: "gelato-order-1",
      orderReferenceId: "merchant-1",
      fulfillmentStatus: "in_production",
      orderType: "order",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T02:00:00.000Z",
      orderItems: [
        {
          itemReferenceId: "item-1",
          status: "printed",
          trackingCode: [
            {
              parcelNumber: 1,
              trackingCode: "TRACK-1",
              trackingUrl: "https://tracking.example/gelato"
            }
          ],
          productionLog: []
        }
      ],
      recipient: {
        firstName: "John",
        lastName: "Smith",
        city: "Berlin",
        state: "BE",
        country: "DE",
        email: "john@example.com",
        phone: "+49"
      }
    });

    expect(normalized.provider).toBe("gelato");
    expect(normalized.externalOrderId).toBe("gelato-order-1");
    expect(normalized.referenceOrderId).toBe("merchant-1");
    expect(normalized.sentToProductionAt).toBeNull();
    expect(normalized.totalCost).toBeNull();
    expect(normalized.items[0]?.status).toBe("printed");
  });

});
