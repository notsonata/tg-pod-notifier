import type { Repository } from "../db/repository.js";
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
  printify: PrintifyClient;
  gelato: GelatoClient;
}): Promise<RefreshSummary> {
  const { repository, printify, gelato } = deps;
  let printifyOrders = 0;
  let gelatoOrders = 0;
  const orderDetailsNotifications: RefreshSummary["orderDetailsNotifications"] = [];

  const shopId = await repository.getSelectedPrintifyShopId();
  if (shopId) {
    const orders = await printify.listOrders(shopId);
    printifyOrders = orders.length;
    for (const order of orders) {
      const result = await repository.upsertOrder(order, "poll");
      if (result.isNew || (result.statusChanged && isProblemStatus(result.currentStatus))) {
        orderDetailsNotifications.push({
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
    if (result.isNew || (result.statusChanged && isProblemStatus(result.currentStatus))) {
      orderDetailsNotifications.push({
        provider: refreshed.provider,
        externalOrderId: refreshed.externalOrderId
      });
    }
  }

  return {
    printifyOrders,
    gelatoOrders,
    printifyShopSelected: Boolean(shopId),
    orderDetailsNotifications
  };
}
