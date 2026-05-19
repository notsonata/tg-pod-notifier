import type { NormalizedOrder, ProviderName } from "../domain/types.js";

export type ProductionRiskType = "provider_issue" | "past_due" | "due_soon" | "stuck_in_production";
export type ProductionRiskSeverity = "warning" | "critical";

export interface ProductionRisk {
  orderUniqueKey: string;
  provider: ProviderName;
  externalOrderId: string;
  riskType: ProductionRiskType;
  severity: ProductionRiskSeverity;
  reason: string;
  expectedShipAt: string | null;
  detectedAt: string;
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

const SHIPPED_STATUS_KEYS = new Set(["shipped", "delivered", "in-transit", "in_transit", "fulfilled"]);
const DUE_SOON_MS = 24 * 60 * 60 * 1000;
const STUCK_IN_PRODUCTION_MS = 72 * 60 * 60 * 1000;

function normalizeStatusKey(status: string): string {
  return status.trim().toLowerCase().replace(/\s+/g, "-");
}

function asIso(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function rawObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function orderUniqueKey(order: Pick<NormalizedOrder, "provider" | "externalOrderId">): string {
  return `${order.provider}:${order.externalOrderId}`;
}

function hasTracking(order: NormalizedOrder): boolean {
  return order.trackingLinks.length > 0;
}

function isShipped(order: NormalizedOrder): boolean {
  const status = normalizeStatusKey(order.status);
  const raw = rawObject(order.raw);
  return SHIPPED_STATUS_KEYS.has(status) || Boolean(asIso(raw.shippedAt)) || hasTracking(order);
}

function makeRisk(
  order: NormalizedOrder,
  riskType: ProductionRiskType,
  severity: ProductionRiskSeverity,
  reason: string,
  expectedShipAt: string | null,
  now: Date
): ProductionRisk {
  return {
    orderUniqueKey: orderUniqueKey(order),
    provider: order.provider,
    externalOrderId: order.externalOrderId,
    riskType,
    severity,
    reason,
    expectedShipAt,
    detectedAt: now.toISOString()
  };
}

export function detectProductionRisk(order: NormalizedOrder, now = new Date()): ProductionRisk | null {
  const status = normalizeStatusKey(order.status);
  if (SHIPPED_STATUS_KEYS.has(status) || status === "canceled" || status === "cancelled") {
    return null;
  }

  const raw = rawObject(order.raw);
  const expectedShipAt = asIso(raw.shipmentDueDate) ?? order.etaMaxAt;
  const shippedAt = asIso(raw.shippedAt);

  if (PROBLEM_STATUSES.has(status)) {
    return makeRisk(
      order,
      "provider_issue",
      "critical",
      "Provider reported an issue that may block fulfillment.",
      expectedShipAt,
      now
    );
  }

  if (expectedShipAt && !shippedAt && !isShipped(order)) {
    const expected = new Date(expectedShipAt).getTime();
    const current = now.getTime();
    if (expected < current) {
      return makeRisk(
        order,
        "past_due",
        "critical",
        "Expected ship date has passed and the order is not marked shipped.",
        expectedShipAt,
        now
      );
    }
    if (expected - current <= DUE_SOON_MS) {
      return makeRisk(
        order,
        "due_soon",
        "warning",
        "Expected ship date is within 24 hours and the order is not marked shipped.",
        expectedShipAt,
        now
      );
    }
  }

  if (order.provider === "printify" && order.sentToProductionAt && !hasTracking(order)) {
    const productionStartedAt = new Date(order.sentToProductionAt).getTime();
    if (!Number.isNaN(productionStartedAt) && now.getTime() - productionStartedAt >= STUCK_IN_PRODUCTION_MS) {
      return makeRisk(
        order,
        "stuck_in_production",
        "warning",
        "Order has been in production for more than 72 hours with no tracking yet.",
        expectedShipAt,
        now
      );
    }
  }

  return null;
}

function htmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function copyable(value: string): string {
  return `<code>${htmlEscape(value)}</code>`;
}

function providerHeader(provider: ProviderName): string {
  return provider === "printify" ? "🖨️ Printify" : "🌐 Gelato";
}

function orderDisplayId(order: NormalizedOrder): string {
  return order.displayOrderId ?? order.externalOrderId;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Pending";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Pending";
  }
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function formatExpectedShipDate(value: string | null): string {
  return value ? formatDate(value) : "Unavailable";
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
    .map((tracking) => {
      const label = tracking.carrier ? `${tracking.carrier} ${tracking.trackingNumber}` : tracking.trackingNumber;
      return tracking.trackingUrl
        ? `<a href="${htmlEscape(tracking.trackingUrl)}">${htmlEscape(label)}</a>`
        : htmlEscape(label);
    })
    .join("\n");
}

function formatRiskAge(risk: ProductionRisk, now = new Date()): string {
  const detectedAt = new Date(risk.detectedAt);
  if (Number.isNaN(detectedAt.getTime())) {
    return "Unknown";
  }
  const minutes = Math.max(0, Math.floor((now.getTime() - detectedAt.getTime()) / 60000));
  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `${hours}h`;
  }
  return `${Math.floor(hours / 24)}d`;
}

function displayStatus(status: string): string {
  const normalized = status.replaceAll("_", " ").trim().toLowerCase();
  return normalized ? `${normalized[0]?.toUpperCase()}${normalized.slice(1)}` : "Unknown";
}

export function renderProductionRiskAlert(
  order: NormalizedOrder,
  risk: ProductionRisk,
  storeNames: Record<string, string> = {},
  now = new Date()
): string {
  return [
    "⚠️⚠️ Production risk",
    "",
    htmlEscape(providerHeader(order.provider)),
    `🏬 ${htmlEscape(order.shopId ? storeNames[order.shopId] ?? order.shopId : "Unknown")}`,
    "",
    `📦 Order: ${copyable(orderDisplayId(order))}`,
    `📥 Order received: ${formatDate(order.orderReceivedAt)}`,
    `🏭 Sent to production: ${formatDate(order.sentToProductionAt)}`,
    `📍 Status: ${htmlEscape(displayStatus(order.status))}`,
    "",
    `⚠️ Risk: ${htmlEscape(risk.reason)}`,
    `⏱️ Risk age: ${formatRiskAge(risk, now)}`,
    `📅 Expected ship date: ${formatExpectedShipDate(risk.expectedShipAt)}`,
    "",
    `👤 Customer: ${htmlEscape(order.customer.name ?? "Unknown")}`,
    `💵 Total cost: ${formatTotalCost(order)}`,
    "",
    `🚚 Tracking: ${formatTracking(order)}`
  ].join("\n");
}
