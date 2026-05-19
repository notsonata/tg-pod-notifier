import { describe, expect, test } from "vitest";

import { normalizeGelatoOrder } from "../src/providers/gelato.js";

describe("Gelato normalization", () => {
  test("normalizes a status response for known order refresh", () => {
    const normalized = normalizeGelatoOrder({
      id: "gelato-order-1",
      orderReferenceId: "merchant-1",
      fulfillmentStatus: "in_production",
      orderType: "order",
      orderedAt: "2025-01-01T00:30:00.000Z",
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
    expect(normalized.displayOrderId).toBe("merchant-1");
    expect(normalized.referenceOrderId).toBe("merchant-1");
    expect(normalized.orderReceivedAt).toBe("2025-01-01T00:30:00.000Z");
    expect(normalized.sentToProductionAt).toBeNull();
    expect(normalized.totalCost).toBeNull();
    expect(normalized.items[0]?.status).toBe("printed");
  });

  test("uses Gelato order reference as the displayed order number", () => {
    const normalized = normalizeGelatoOrder({
      id: "45e8d98e-ba22-4e0c-93ae-26bf78f61ca2",
      orderReferenceId: "G-260515162121",
      fulfillmentStatus: "in_transit"
    });

    expect(normalized.externalOrderId).toBe("45e8d98e-ba22-4e0c-93ae-26bf78f61ca2");
    expect(normalized.displayOrderId).toBe("G-260515162121");
    expect(normalized.referenceOrderId).toBe("G-260515162121");
  });

  test("normalizes hydrated Gelato detail payload customer, cost, items, and tracking", () => {
    const normalized = normalizeGelatoOrder({
      id: "45e8d98e-ba22-4e0c-93ae-26bf78f61ca2",
      orderReferenceId: "4059882153",
      fulfillmentStatus: "in_transit",
      currency: "JPY",
      storeId: "store-1",
      shippingAddress: {
        firstName: "Terry",
        lastName: "Kessler",
        city: "Tokyo",
        country: "JP"
      },
      items: [
        {
          id: "item-1",
          itemReferenceId: "5060794426",
          productName: "Premium Matte Paper Wooden Mounted Framed Poster",
          quantity: 2,
          fulfillmentStatus: "shipped"
        }
      ],
      shipment: {
        packages: [
          {
            trackingCode: "1ZE93448YW93849145",
            trackingUrl: "https://tracking.example/gelato"
          }
        ]
      },
      receipts: [
        {
          currency: "JPY",
          totalInclVat: 12003.44
        }
      ]
    });

    expect(normalized.customer.name).toBe("Terry Kessler");
    expect(normalized.totalCost).toEqual({
      amount: 1200344,
      currency: "JPY"
    });
    expect(normalized.items[0]).toMatchObject({
      externalItemId: "5060794426",
      title: "Premium Matte Paper Wooden Mounted Framed Poster",
      quantity: 2,
      status: "shipped"
    });
    expect(normalized.trackingLinks).toEqual([
      {
        carrier: null,
        trackingNumber: "1ZE93448YW93849145",
        trackingUrl: "https://tracking.example/gelato"
      }
    ]);
  });

  test("deduplicates tracking links shared by items and shipment packages", () => {
    const normalized = normalizeGelatoOrder({
      id: "84edbc9d-2fef-4ac1-a79b-a4f0a3236241",
      orderReferenceId: "4059362517",
      fulfillmentStatus: "in_transit",
      items: [
        {
          itemReferenceId: "5060794426",
          trackingCode: [
            {
              trackingCode: "1ZE93448YW93849145",
              trackingUrl: "https://tracking.example/ups"
            }
          ]
        },
        {
          itemReferenceId: "branded-insert",
          trackingCode: [
            {
              trackingCode: "1ZE93448YW93849145",
              trackingUrl: "https://tracking.example/ups"
            }
          ]
        }
      ],
      shipment: {
        packages: [
          {
            trackingCode: "1ZE93448YW93849145",
            trackingUrl: "https://tracking.example/ups"
          }
        ]
      }
    });

    expect(normalized.trackingLinks).toEqual([
      {
        carrier: null,
        trackingNumber: "1ZE93448YW93849145",
        trackingUrl: "https://tracking.example/ups"
      }
    ]);
  });
});
