import type { BotSettings, NormalizedOrder } from "../domain/types.js";

const STATUS_LABELS: Record<string, string> = {
  pending: "On hold",
  "on-hold": "On hold",
  created: "On hold",
  "on-hold-submit-order": "On hold: Submit order",
  "payment-not-received": "On hold: Action required",
  "out-of-stock": "On hold: Action required",
  "sending-to-production": "Sending to production",
  "sent-to-production": "Sending to production",
  "in-production": "In production",
  in_production: "In production",
  printed: "In production",
  "has-issues": "Has issues",
  error: "Has issues",
  failed: "Has issues",
  canceled: "Canceled",
  cancelled: "Canceled",
  fulfilled: "Ready to ship",
  "ready-to-ship": "Ready to ship",
  passed: "Ready to ship",
  shipped: "Shipped",
  "on-the-way": "On the way",
  in_transit: "On the way",
  "available-for-pickup": "Available for pickup",
  "out-for-delivery": "Out for delivery",
  "delivery-attempt": "Delivery attempt",
  "shipping-issue": "Shipping issue",
  exception: "Shipping issue",
  "return-to-sender": "Return to sender",
  returned: "Return to sender",
  delivered: "Delivered"
};

function normalizeStatusKey(status: string): string {
  return status.trim().toLowerCase().replace(/\s+/g, "-");
}

function displayStatus(status: string): string {
  return STATUS_LABELS[normalizeStatusKey(status)] ?? "Unknown";
}

function formatProductionDate(value: string | null): string {
  if (!value) {
    return "Pending";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "2-digit",
    timeZone: "UTC"
  }).format(date);
}

function formatTotalCost(order: NormalizedOrder): string {
  if (!order.totalCost) {
    return "Pending";
  }

  return `${order.totalCost.currency} ${(order.totalCost.amount / 100).toFixed(2)}`;
}

function formatTracking(order: NormalizedOrder): string {
  if (order.trackingLinks.length === 0) {
    return "Pending";
  }

  return order.trackingLinks
    .map((tracking) => tracking.trackingUrl ?? tracking.trackingNumber)
    .join("\n");
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
  _settings: BotSettings
): string {
  return [
    `Order: ${order.externalOrderId}`,
    `Sent to production: ${formatProductionDate(order.sentToProductionAt)}`,
    `Customer: ${order.customer.name ?? "Unknown"}`,
    `Total cost: ${formatTotalCost(order)}`,
    `Tracking: ${formatTracking(order)}`,
    `Status: ${displayStatus(order.status)}`
  ].join("\n");
}

export function renderDigest(
  orders: NormalizedOrder[],
  changes: Array<{ orderUniqueKey: string; status: string; occurredAt: string | null }>,
  settings?: BotSettings,
  storeNames: Record<string, string> = {}
): string {
  void settings;
  if (orders.length === 0) {
    return "Order Digest\n\nNo active orders.";
  }

  const previousStatusByOrder = new Map(changes.map((change) => [change.orderUniqueKey, change.status]));
  const lines = ["Order Digest"];
  const providers: NormalizedOrder["provider"][] = ["printify", "gelato"];

  for (const provider of providers) {
    const providerOrders = orders.filter((order) => order.provider === provider);
    if (providerOrders.length === 0) {
      continue;
    }

    lines.push("", provider === "printify" ? "Printify" : "Gelato");
    lines.push(providerStoreLabel(providerOrders, storeNames));

    for (const order of providerOrders) {
      const uniqueKey = `${order.provider}:${order.externalOrderId}`;
      const currentStatus = displayStatus(order.status);
      const previousStatus = previousStatusByOrder.get(uniqueKey);
      const previousStatusLabel = previousStatus ? displayStatus(previousStatus) : null;
      const statusLine =
        previousStatusLabel && previousStatusLabel !== currentStatus
          ? `Status: ${currentStatus} <- ${previousStatusLabel}`
          : `Status: ${currentStatus}`;

      lines.push(
        "",
        `Order: ${order.externalOrderId}`,
        `Customer: ${order.customer.name ?? "Unknown"}`,
        statusLine
      );
    }
  }

  return lines.join("\n");
}

function providerStoreLabel(orders: NormalizedOrder[], storeNames: Record<string, string>): string {
  const shopId = orders[0]?.shopId;
  return shopId ? storeNames[shopId] ?? shopId : "Unknown";
}
