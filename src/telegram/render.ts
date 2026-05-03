import type { BotSettings, NormalizedOrder } from "../domain/types.js";

export type OrderAlertKind = "new" | "stale" | "delayed" | "fulfilled" | "info";

function customerSummary(order: NormalizedOrder, settings: BotSettings): string[] {
  const lines: string[] = [];
  if (settings.piiName && order.customer.name) {
    lines.push(`Name: ${order.customer.name}`);
  }
  if (order.customer.city || order.customer.country) {
    lines.push(
      `Location: ${[order.customer.city, order.customer.region, order.customer.country]
        .filter(Boolean)
        .join(", ")}`
    );
  }
  if (settings.piiEmail && order.customer.email) {
    lines.push(`Email: ${order.customer.email}`);
  }
  if (settings.piiPhone && order.customer.phone) {
    lines.push(`Phone: ${order.customer.phone}`);
  }
  if (settings.piiAddress && (order.customer.address1 || order.customer.address2)) {
    lines.push(
      `Address: ${[order.customer.address1, order.customer.address2, order.customer.postalCode]
        .filter(Boolean)
        .join(", ")}`
    );
  }

  return lines;
}

function alertHeading(kind: OrderAlertKind): string {
  if (kind === "new") {
    return "🟢 New Order";
  }
  if (kind === "stale") {
    return "🟠 Stale Order";
  }
  if (kind === "delayed") {
    return "🔴 ⚠️ DELAYED Order ⚠️";
  }
  if (kind === "fulfilled") {
    return "✅ Fulfilled Order";
  }
  return "ℹ️ Order Update";
}

export function renderOrderSummary(order: NormalizedOrder): string {
  return [
    `${order.provider.toUpperCase()} order ${order.externalOrderId}`,
    `Status: ${order.status}`,
    `Items: ${order.items.length}`,
    order.updatedAt ? `Updated: ${order.updatedAt}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderOrderDetails(
  order: NormalizedOrder,
  settings: BotSettings,
  kind: OrderAlertKind = "info"
): string {
  const providerLabel = order.provider === "printify" ? "Printify" : "Gelato";
  const storeLabel =
    order.provider === "printify" && settings.printifyShopName
      ? settings.printifyShopName
      : order.shopId ?? "Unknown";

  const identityBlock = [
    alertHeading(kind),
    "",
    `[${providerLabel}]`,
    `[Store ${storeLabel}]`,
    `Order ID: ${order.externalOrderId}`
  ].join("\n");

  const statusBlock = [
    `Status: ${order.status}`,
    order.createdAt ? `Created: ${order.createdAt}` : null,
    order.updatedAt ? `Updated: ${order.updatedAt}` : null,
    order.etaMaxAt ? `Expected by: ${order.etaMaxAt}` : null
  ]
    .filter(Boolean)
    .join("\n");

  const customerBlock = customerSummary(order, settings).join("\n");

  return [
    identityBlock,
    statusBlock,
    customerBlock,
    order.items.length > 0
      ? `Items:\n${order.items
          .map((item) => `- ${item.title} x${item.quantity} [${item.status}]`)
          .join("\n")}`
      : null,
    order.trackingLinks.length > 0
      ? `Tracking:\n${order.trackingLinks
          .map((tracking) => `- ${tracking.trackingNumber}${tracking.trackingUrl ? ` ${tracking.trackingUrl}` : ""}`)
          .join("\n")}`
      : null
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function renderDigest(
  orders: NormalizedOrder[],
  alerts: Array<{ orderUniqueKey: string; severity: string; message: string }>,
  changes: Array<{ orderUniqueKey: string; status: string; occurredAt: string | null }>
): string {
  const activeByProvider = new Map<string, number>();
  for (const order of orders) {
    activeByProvider.set(order.provider, (activeByProvider.get(order.provider) ?? 0) + 1);
  }

  return [
    "Daily order digest",
    `Active orders: ${orders.length}`,
    ...Array.from(activeByProvider.entries()).map(([provider, count]) => `${provider}: ${count}`),
    alerts.length > 0
      ? `Stuck alerts:\n${alerts.map((alert) => `- ${alert.severity}: ${alert.message}`).join("\n")}`
      : "Stuck alerts: none",
    changes.length > 0
      ? `Recent changes:\n${changes
          .slice(0, 10)
          .map((change) => `- ${change.orderUniqueKey} -> ${change.status}`)
          .join("\n")}`
      : "Recent changes: none"
  ].join("\n\n");
}
