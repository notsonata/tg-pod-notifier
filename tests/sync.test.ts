import { describe, expect, test, vi } from "vitest";

import { refreshAllOrders } from "../src/jobs/sync.js";
import { printifyOrderPayload } from "./printify-normalization.test.js";

vi.mock("../src/providers/printify.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/providers/printify.js")>();
  return {
    ...original,
    PrintifyClient: class {
      async listOrders() {
        return [
          original.normalizePrintifyOrder(
            printifyOrderPayload({
              id: "delivered-order",
              status: "delivered"
            }),
            "shop-1"
          )
        ];
      }
    }
  };
});

vi.mock("../src/providers/gelato.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/providers/gelato.js")>();
  return {
    ...original,
    GelatoClient: class {
      async listOrders() {
        return [];
      }
    }
  };
});

describe("refreshAllOrders", () => {
  test("does not notify for newly discovered delivered orders", async () => {
    const repository = {
      listEnabledProviderStores: async (provider?: string) =>
        provider === "printify"
          ? [
              {
                provider: "printify",
                apiKey: "token",
                externalStoreId: "shop-1"
              }
            ]
          : [],
      upsertOrder: async (order: { status: string }) => ({
        isNew: true,
        statusChanged: true,
        previousStatus: null,
        currentStatus: order.status
      })
    };

    const summary = await refreshAllOrders({
      repository: repository as never
    });

    expect(summary.orderDetailsNotifications).toEqual([]);
    expect(summary.printifyOrders).toBe(1);
  });
});
