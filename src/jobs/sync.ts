import type { Repository } from "../db/repository.js";
import { GelatoClient } from "../providers/gelato.js";
import { PrintifyClient } from "../providers/printify.js";

export interface RefreshSummary {
  printifyOrders: number;
  gelatoOrders: number;
  printifyShopSelected: boolean;
}

export async function refreshAllOrders(deps: {
  repository: Repository;
  printify: PrintifyClient;
  gelato: GelatoClient;
}): Promise<RefreshSummary> {
  const { repository, printify, gelato } = deps;
  let printifyOrders = 0;
  let gelatoOrders = 0;

  const shopId = await repository.getSelectedPrintifyShopId();
  if (shopId) {
    const orders = await printify.listOrders(shopId);
    printifyOrders = orders.length;
    for (const order of orders) {
      await repository.upsertOrder(order, "poll");
    }
  }

  const knownGelatoOrders = await repository.listKnownGelatoOrders();
  gelatoOrders = knownGelatoOrders.length;
  for (const order of knownGelatoOrders) {
    const refreshed = order.referenceOrderId
      ? await gelato.getOrderStatus(order.referenceOrderId)
      : await gelato.getOrder(order.externalOrderId);
    await repository.upsertOrder(refreshed, "poll");
  }

  return {
    printifyOrders,
    gelatoOrders,
    printifyShopSelected: Boolean(shopId)
  };
}
