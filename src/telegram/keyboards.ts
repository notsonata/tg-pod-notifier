import { InlineKeyboard } from "grammy";

import type { BotSettings, NormalizedOrder } from "../domain/types.js";

export function ordersKeyboard(orders: NormalizedOrder[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const order of orders.slice(0, 10)) {
    keyboard.text(`${order.provider}:${order.externalOrderId}`, `order:view:${order.provider}:${order.externalOrderId}`).row();
  }
  keyboard.text("Refresh all", "orders:refresh").row();
  keyboard.text("Digest settings", "settings:digest").text("Privacy", "settings:privacy");
  return keyboard;
}

export function orderKeyboard(order: NormalizedOrder): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text("View Details", `order:view:${order.provider}:${order.externalOrderId}`)
    .text("Refresh Now", `order:refresh:${order.provider}:${order.externalOrderId}`)
    .row()
    .text("Acknowledge", `order:ack:${order.provider}:${order.externalOrderId}`)
    .text("Snooze 6h", `order:snooze:${order.provider}:${order.externalOrderId}:6`)
    .row()
    .text("Provider Link", `noop:provider`);

  if (order.providerUrl) {
    keyboard.url("Open Provider", order.providerUrl);
  }

  return keyboard;
}

export function digestSettingsKeyboard(settings: BotSettings): InlineKeyboard {
  return new InlineKeyboard()
    .text(settings.digestEnabled ? "Disable digest" : "Enable digest", "settings:digest:toggle")
    .row()
    .text("09:00", "settings:digest:time:9:0")
    .text("12:00", "settings:digest:time:12:0")
    .text("18:00", "settings:digest:time:18:0")
    .row()
    .text(settings.digestStuckOnly ? "Show all orders" : "Stuck only", "settings:digest:scope");
}

export function privacySettingsKeyboard(settings: BotSettings): InlineKeyboard {
  return new InlineKeyboard()
    .text(`Name ${settings.piiName ? "ON" : "OFF"}`, "settings:privacy:name")
    .text(`Email ${settings.piiEmail ? "ON" : "OFF"}`, "settings:privacy:email")
    .row()
    .text(`Phone ${settings.piiPhone ? "ON" : "OFF"}`, "settings:privacy:phone")
    .text(`Address ${settings.piiAddress ? "ON" : "OFF"}`, "settings:privacy:address");
}
