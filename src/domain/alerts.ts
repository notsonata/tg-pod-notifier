import type { AlertDecision, AlertThresholds, NormalizedOrder } from "./types.js";

const TERMINAL_STATUSES = new Set(["delivered", "returned", "canceled", "failed"]);

function daysBetween(startIso: string | null, endIso: string): number {
  if (!startIso) {
    return 0;
  }

  return (Date.parse(endIso) - Date.parse(startIso)) / (1000 * 60 * 60 * 24);
}

export function evaluateOrderAlert(
  order: NormalizedOrder,
  thresholds: AlertThresholds
): AlertDecision | null {
  const status = order.status.toLowerCase();
  if (TERMINAL_STATUSES.has(status)) {
    return null;
  }

  if (
    order.etaMaxAt &&
    Date.parse(order.etaMaxAt) < Date.parse(thresholds.nowIso)
  ) {
    return {
      severity: "critical",
      reason: "delayed-order",
      message: "Order has passed its expected arrival date and is still not delivered."
    };
  }

  if (
    daysBetween(order.updatedAt ?? order.createdAt, thresholds.nowIso) >=
    thresholds.staleDays
  ) {
    return {
      severity: "warning",
      reason: "stale-order",
      message: `Order has not received an update for ${thresholds.staleDays} day(s).`
    };
  }

  return null;
}
