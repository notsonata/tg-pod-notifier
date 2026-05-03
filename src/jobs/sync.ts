import type { Repository } from "../db/repository.js";
import { GelatoClient } from "../providers/gelato.js";
import { PrintifyClient } from "../providers/printify.js";

export interface RefreshSummary {
  printifyOrders: number;
  gelatoOrders: number;
  printifyShopSelected: boolean;
  newlyFulfilled: Array<{
    provider: "printify" | "gelato";
    externalOrderId: string;
  }>;
}

export async function refreshAllOrders(deps: {
  repository: Repository;
  printify: PrintifyClient;
  gelato: GelatoClient;
}): Promise<RefreshSummary> {
  const { repository, printify, gelato } = deps;
  let printifyOrders = 0;
  let gelatoOrders = 0;
  const newlyFulfilled: RefreshSummary["newlyFulfilled"] = [];

  const shopId = await repository.getSelectedPrintifyShopId();
  if (shopId) {
    const orders = await printify.listOrders(shopId);
    printifyOrders = orders.length;
    for (const order of orders) {
      const result = await repository.upsertOrder(order, "poll");
      if (
        result.statusChanged &&
        result.currentStatus.toLowerCase() === "fulfilled" &&
        result.previousStatus?.toLowerCase() !== "fulfilled"
      ) {
        newlyFulfilled.push({
          provider: order.provider,
          externalOrderId: order.externalOrderId
        });
      }
    }
  }

  const knownGelatoOrders = await repository.listKnownGelatoOrders();
  gelatoOrders = knownGelatoOrders.length;
  for (const order of knownGelatoOrders) {
    const refreshed = order.referenceOrderId
      ? await gelato.getOrderStatus(order.referenceOrderId)
      : await gelato.getOrder(order.externalOrderId);
    const result = await repository.upsertOrder(refreshed, "poll");
    if (
      result.statusChanged &&
      result.currentStatus.toLowerCase() === "fulfilled" &&
      result.previousStatus?.toLowerCase() !== "fulfilled"
    ) {
      newlyFulfilled.push({
        provider: refreshed.provider,
        externalOrderId: refreshed.externalOrderId
      });
    }
  }

  return {
    printifyOrders,
    gelatoOrders,
    printifyShopSelected: Boolean(shopId),
    newlyFulfilled
  };
}
