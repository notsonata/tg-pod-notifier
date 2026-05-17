import type { Repository } from "../db/repository.js";
import { isHiddenOrderStatus } from "../domain/types.js";
import { GelatoClient } from "../providers/gelato.js";
import { PrintifyClient } from "../providers/printify.js";

export interface RefreshSummary {
  printifyOrders: number;
  gelatoOrders: number;
  printifyShopSelected: boolean;
  orderDetailsNotifications: Array<{
    provider: "printify" | "gelato";
    externalOrderId: string;
  }>;
}

const PROBLEM_STATUSES = new Set([
  "has-issues",
  "error",
  "failed",
  "payment-not-received",
  "out-of-stock",
  "shipping-issue",
  "exception",
  "return-to-sender",
  "returned"
]);

function isProblemStatus(status: string): boolean {
  return PROBLEM_STATUSES.has(status.trim().toLowerCase().replace(/\s+/g, "-"));
}

export async function refreshAllOrders(deps: {
  repository: Repository;
}): Promise<RefreshSummary> {
  const { repository } = deps;
  let printifyOrders = 0;
  let gelatoOrders = 0;
  const orderDetailsNotifications: RefreshSummary["orderDetailsNotifications"] = [];

  const printifyStores = await repository.listEnabledProviderStores("printify");
  for (const store of printifyStores) {
    const printify = new PrintifyClient(store.apiKey);
    const orders = await printify.listOrders(store.externalStoreId);
    printifyOrders += orders.length;
    for (const order of orders) {
      const result = await repository.upsertOrder(order, "poll");
      if (
        !isHiddenOrderStatus(result.currentStatus) &&
        (result.isNew || (result.statusChanged && isProblemStatus(result.currentStatus)))
      ) {
        orderDetailsNotifications.push({
          provider: order.provider,
          externalOrderId: order.externalOrderId
        });
      }
    }
  }

  const gelatoStores = await repository.listEnabledProviderStores("gelato");
  for (const store of gelatoStores) {
    const gelato = new GelatoClient(store.apiKey, store.externalStoreId);
    const orders = await gelato.listOrders();
    gelatoOrders += orders.length;
    for (const order of orders) {
      const result = await repository.upsertOrder(order, "poll");
      if (
        !isHiddenOrderStatus(result.currentStatus) &&
        (result.isNew || (result.statusChanged && isProblemStatus(result.currentStatus)))
      ) {
        orderDetailsNotifications.push({
          provider: order.provider,
          externalOrderId: order.externalOrderId
        });
      }
    }
  }

  return {
    printifyOrders,
    gelatoOrders,
    printifyShopSelected: printifyStores.length > 0,
    orderDetailsNotifications
  };
}
