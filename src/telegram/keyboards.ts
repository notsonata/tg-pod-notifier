import { InlineKeyboard } from "grammy";

import type { BotSettings, NormalizedOrder } from "../domain/types.js";

export function ordersKeyboard(orders: NormalizedOrder[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const order of orders.slice(0, 10)) {
    keyboard.text(`${order.provider}:${order.externalOrderId}`, `order:view:${order.provider}:${order.externalOrderId}`).row();
  }
  keyboard.text("Refresh all", "orders:refresh").row();
  keyboard.text("Digest settings", "settings:digest");
  return keyboard;
}

export function orderKeyboard(order: NormalizedOrder): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text("View Details", `order:view:${order.provider}:${order.externalOrderId}`)
    .text("Refresh Now", `order:refresh:${order.provider}:${order.externalOrderId}`);

  if (order.providerUrl) {
    keyboard.row().url("Open Provider", order.providerUrl);
  }

  return keyboard;
}

export function digestSettingsKeyboard(settings: BotSettings): InlineKeyboard {
  return new InlineKeyboard()
    .text(settings.digestEnabled ? "Disable digest" : "Enable digest", "settings:digest:toggle");
}

export function generalSettingsKeyboard(settings: BotSettings): InlineKeyboard {
  return new InlineKeyboard()
    .text("Digest", "settings:digest")
    .row()
    .text(
      settings.printifyShopName
        ? `Printify ${settings.printifyShopName}`
        : settings.printifyShopId
          ? `Printify Shop ${settings.printifyShopId}`
        : "Select Printify Shop",
      "settings:printify"
    );
}

export function printifyShopsKeyboard(
  shops: Array<{ id: string; title: string }>
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const shop of shops.slice(0, 10)) {
    keyboard.text(shop.title, `settings:printify:select:${shop.id}`).row();
  }
  return keyboard.text("Back", "settings:menu");
}
