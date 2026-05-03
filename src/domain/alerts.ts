import type { AlertDecision, AlertThresholds, NormalizedOrder } from "./types.js";

const PROVIDER_ERROR_STATUSES = new Set(["failed", "canceled", "returned"]);
const PRE_PRODUCTION_STATUSES = new Set([
  "pending",
  "created",
  "uploading",
  "passed",
  "pending_approval",
  "pending_personalization",
  "not_connected"
]);
const HOLD_STATUSES = new Set(["on_hold", "on-hold"]);
const PRODUCTION_STATUSES = new Set([
  "in_production",
  "in-production",
  "processing",
  "sent-to-production",
  "printed"
]);

function hoursBetween(startIso: string | null, endIso: string): number {
  if (!startIso) {
    return 0;
  }

  return (Date.parse(endIso) - Date.parse(startIso)) / (1000 * 60 * 60);
}

function businessDaysBetween(startIso: string | null, endIso: string): number {
  if (!startIso) {
    return 0;
  }

  const start = new Date(startIso);
  const end = new Date(endIso);
  let days = 0;
  const cursor = new Date(start);
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      days += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return Math.max(0, days - 1);
}

export function evaluateOrderAlert(
  order: NormalizedOrder,
  thresholds: AlertThresholds
): AlertDecision | null {
  const status = order.status.toLowerCase();

  if (PROVIDER_ERROR_STATUSES.has(status)) {
    return {
      severity: "critical",
      reason: "provider-error",
      message: `Order is in provider error state: ${order.status}`
    };
  }

  if (
    status === "shipped" &&
    order.etaMaxAt &&
    Date.parse(order.etaMaxAt) < Date.parse(thresholds.nowIso)
  ) {
    return {
      severity: "critical",
      reason: "eta-exceeded",
      message: "Order is shipped and past the provider ETA."
    };
  }

  if (
    PRE_PRODUCTION_STATUSES.has(status) &&
    hoursBetween(order.createdAt ?? order.updatedAt, thresholds.nowIso) >
      thresholds.preProductionHours
  ) {
    return {
      severity: "warning",
      reason: "pre-production-stale",
      message: `Order has stayed in ${order.status} past the pre-production threshold.`
    };
  }

  if (
    HOLD_STATUSES.has(status) &&
    hoursBetween(order.updatedAt ?? order.createdAt, thresholds.nowIso) >
      thresholds.holdHours
  ) {
    return {
      severity: "warning",
      reason: "hold-stale",
      message: `Order has stayed in ${order.status} past the hold threshold.`
    };
  }

  if (
    PRODUCTION_STATUSES.has(status) &&
    businessDaysBetween(order.updatedAt ?? order.createdAt, thresholds.nowIso) >
      thresholds.productionBusinessDays
  ) {
    return {
      severity: "warning",
      reason: "production-stale",
      message: `Order has stayed in ${order.status} past the production threshold.`
    };
  }

  return null;
}
