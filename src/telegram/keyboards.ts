import { InlineKeyboard } from "grammy";

import type { BotSettings, NormalizedOrder, ProviderKeyConfig, ProviderStoreConfig } from "../domain/types.js";

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
  void settings;
  return new InlineKeyboard()
    .text("Digest", "settings:digest")
    .row()
    .text("Printify", "settings:printify")
    .text("Gelato", "settings:gelato");
}

export function printifyShopsKeyboard(
  shops: Array<{ id: string; title: string; enabled: boolean }>
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const shop of shops.slice(0, 10)) {
    keyboard.text(`${shop.enabled ? "ON" : "OFF"} ${shop.title}`, `settings:store:toggle:${shop.id}`).row();
  }
  return keyboard.text("Back", "settings:menu");
}

export function providerKeysKeyboard(
  provider: "gelato" | "printify",
  keys: ProviderKeyConfig[],
  stores: ProviderStoreConfig[]
): InlineKeyboard {
  const keyboard = new InlineKeyboard().text(
    provider === "printify" ? "Add Printify key" : "Add Gelato key",
    `settings:${provider}:key:add`
  );

  if (provider === "gelato") {
    for (const key of keys) {
      keyboard.row().text(`Add store to ${key.label}`, `settings:gelato:store:add:${key.id}`);
    }
  }

  for (const store of stores.slice(0, 10)) {
    keyboard.row().text(
      `${store.enabled ? "ON" : "OFF"} ${store.name}`,
      `settings:store:toggle:${store.id}`
    );
  }

  return keyboard.row().text("Back", "settings:menu");
}
