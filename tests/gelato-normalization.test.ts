import { describe, expect, test } from "vitest";

import {
  normalizeGelatoOrder,
  normalizeGelatoWebhook
} from "../src/providers/gelato.js";

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
    expect(normalized.items[0]?.status).toBe("printed");
  });

  test("normalizes webhook payloads for split orders", () => {
    const event = normalizeGelatoWebhook({
      id: "os_123",
      event: "order_status_updated",
      orderId: "gelato-order-1",
      orderReferenceId: "merchant-1",
      fulfillmentStatus: "passed",
      comment: "",
      items: [
        {
          itemReferenceId: "item-1",
          fulfillmentStatus: "passed",
          fulfillments: []
        }
      ]
    });

    expect(event.eventId).toBe("os_123");
    expect(event.orderId).toBe("gelato-order-1");
    expect(event.referenceOrderId).toBe("merchant-1");
    expect(event.status).toBe("passed");
  });

  test("normalizes tracking-code webhook payloads", () => {
    const event = normalizeGelatoWebhook({
      id: "tc_123",
      event: "order_item_tracking_code_updated",
      orderId: "gelato-order-1",
      orderReferenceId: "merchant-1",
      trackingCode: "TRACK-123",
      trackingUrl: "https://tracking.example/gelato",
      created: "2025-01-03T12:11:30+00:00"
    });

    expect(event.eventId).toBe("tc_123");
    expect(event.orderId).toBe("gelato-order-1");
    expect(event.occurredAt).toBe("2025-01-03T12:11:30.000Z");
    expect(event.status).toBe("order_item_tracking_code_updated");
  });

  test("normalizes delivery-estimate webhook payloads", () => {
    const event = normalizeGelatoWebhook({
      id: "de_123",
      event: "order_delivery_estimate_updated",
      orderId: "gelato-order-1",
      orderReferenceId: "merchant-1",
      minDeliveryDate: "2025-01-05",
      maxDeliveryDate: "2025-01-07",
      created: "2025-01-03T07:26:52+00:00"
    });

    expect(event.eventId).toBe("de_123");
    expect(event.orderId).toBe("gelato-order-1");
    expect(event.status).toBe("order_delivery_estimate_updated");
  });
});
