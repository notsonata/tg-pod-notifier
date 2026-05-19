import { Bot, type Context } from "grammy";

import type { AppConfig } from "../config.js";
import type { BotSettings, NormalizedOrder } from "../domain/types.js";
import { GelatoClient } from "../providers/gelato.js";
import { PrintifyClient } from "../providers/printify.js";
import { Repository } from "../db/repository.js";
import { refreshAllOrders } from "../jobs/sync.js";
import { isAuthorizedGroupChat } from "./access-control.js";
import {
  digestSettingsKeyboard,
  generalSettingsKeyboard,
  orderKeyboard,
  ordersKeyboard,
  printifyShopsKeyboard,
  providerKeysKeyboard
} from "./keyboards.js";
import {
  renderDigest,
  renderOrderDetails,
  renderOrderSummary
} from "./render.js";

type AppContext = Context;
type TelegramBot = Bot<AppContext>;
type PendingInput =
  | { type: "printify-key" }
  | { type: "gelato-key" }
  | { type: "gelato-store"; keyId: number };

const pendingInputs = new Map<number | string, PendingInput>();

export const TELEGRAM_COMMANDS = [
  { command: "start", description: "Activate the bot in this group" },
  { command: "help", description: "Show available commands" },
  { command: "orders", description: "List active tracked orders" },
  { command: "refresh", description: "Refresh provider order data now" },
  { command: "digest", description: "View digest settings" },
  { command: "settings", description: "Open bot settings" }
] as const;

async function loadOrder(
  repository: Repository,
  provider: string,
  orderId: string
): Promise<NormalizedOrder | null> {
  return repository.getOrder(provider, orderId);
}

async function storeNameMap(repository: Repository): Promise<Record<string, string>> {
  const stores = await repository.listProviderStores();
  return Object.fromEntries(stores.map((store) => [store.externalStoreId, store.name]));
}

export function createTelegramBot(deps: {
  config: AppConfig;
  repository: Repository;
}) {
  const { config, repository } = deps;
  const bot = new Bot<AppContext>(config.TELEGRAM_BOT_TOKEN);

  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id ?? ctx.callbackQuery?.message?.chat.id;
    if (!isAuthorizedGroupChat(chatId, config.AUTHORIZED_TELEGRAM_CHAT_ID)) {
      return;
    }

    await next();
  });

  bot.command("start", async (ctx) => {
    await ctx.reply("📦 Order notifier is active in this group.");
  });

  bot.command("help", async (ctx) => {
    await ctx.reply("Commands: /orders /digest /settings");
  });

  bot.command("orders", async (ctx) => {
    const openOrders = await repository.listOpenOrders();
    await ctx.reply(
      openOrders.length > 0 ? "Open orders" : "No open orders found.",
      {
        reply_markup: openOrders.length > 0 ? ordersKeyboard(openOrders) : undefined
      }
    );
  });

  bot.command("refresh", async (ctx) => {
    await refreshAllOrders({
      repository
    });
    const settings = await repository.ensureSettings();
    const openOrders = await repository.listOpenOrders();
    const stores = await storeNameMap(repository);
    if (openOrders.length === 0) {
      await ctx.reply("No open orders found.");
      return;
    }

    for (const order of openOrders) {
      await ctx.reply(renderOrderDetails(order, settings, stores), {
        parse_mode: "HTML",
        reply_markup: orderKeyboard(order)
      });
    }
  });

  bot.command("digest", async (ctx) => {
    const settings = await repository.ensureSettings();
    const openOrders = await repository.listOpenOrders();
    const changes = await repository.listRecentStatusEvents(settings.lastDigestSentAt);
    await ctx.reply(renderDigest(openOrders, changes, settings, await storeNameMap(repository)), {
      parse_mode: "HTML",
      reply_markup: openOrders.length > 0 ? ordersKeyboard(openOrders) : undefined
    });
  });

  bot.command("settings", async (ctx) => {
    const settings = await repository.ensureSettings();
    await ctx.reply("⚙️ Settings", {
      reply_markup: generalSettingsKeyboard(settings)
    });
  });

  bot.on("message:text", async (ctx, next) => {
    const chatId = ctx.chat.id;
    const pending = pendingInputs.get(chatId);
    const text = ctx.message.text.trim();
    if (!pending || text.startsWith("/")) {
      await next();
      return;
    }

    pendingInputs.delete(chatId);
    if (pending.type === "printify-key") {
      const existingKeys = await repository.listProviderKeys("printify");
      const key = await repository.saveProviderKey(
        "printify",
        `Printify ${existingKeys.length + 1}`,
        text
      );
      const printify = new PrintifyClient(text);
      const shops = await printify.listShops();
      for (const shop of shops) {
        await repository.upsertProviderStore({
          keyId: key.id,
          provider: "printify",
          externalStoreId: String(shop.id),
          name: shop.title,
          enabled: false
        });
      }
      const stores = await repository.listProviderStores("printify");
      await ctx.reply("🔑 Printify key saved. Toggle the stores to capture orders for:", {
        reply_markup: printifyShopsKeyboard(
          stores.map((store) => ({
            id: String(store.id),
            title: `${store.name} (${store.externalStoreId})`,
            enabled: store.enabled
          }))
        )
      });
      return;
    }

    if (pending.type === "gelato-key") {
      const existingKeys = await repository.listProviderKeys("gelato");
      await repository.saveProviderKey("gelato", `Gelato ${existingKeys.length + 1}`, text);
      await ctx.reply("🔑 Gelato key saved. Use Settings > Gelato > Add Gelato store to attach store IDs.");
      return;
    }

    const [storeId, ...nameParts] = text.split("|").map((part) => part.trim());
    const name = nameParts.join(" | ");
    if (!storeId || !name) {
      await ctx.reply("🏬 Store not saved. Send it as: store-id | Store Name");
      return;
    }
    await repository.upsertProviderStore({
      keyId: pending.keyId,
      provider: "gelato",
      externalStoreId: storeId,
      name,
      enabled: true
    });
    await ctx.reply(`🏬 Gelato store saved: ${name} (${storeId})`);
  });

  bot.callbackQuery(/^order:view:(gelato|printify):(.+)$/, async (ctx) => {
    const [, provider, orderId] = ctx.match;
    const order = await loadOrder(repository, provider, orderId);
    const settings = await repository.ensureSettings();
    if (!order) {
      await ctx.answerCallbackQuery({ text: "📦 Order not found." });
      return;
    }

    await ctx.editMessageText(renderOrderDetails(order, settings, await storeNameMap(repository)), {
      parse_mode: "HTML",
      reply_markup: orderKeyboard(order)
    });
  });

  bot.callbackQuery(/^order:refresh:(gelato|printify):(.+)$/, async (ctx) => {
    const [, provider, orderId] = ctx.match;
    let order: NormalizedOrder;
    if (provider === "printify") {
      const existing = await repository.getOrder("printify", orderId);
      const store = (await repository.listEnabledProviderStores("printify")).find(
        (candidate) => candidate.externalStoreId === existing?.shopId
      );
      if (!store) {
        await ctx.answerCallbackQuery({ text: "🖨️ Enable the Printify store in settings first." });
        return;
      }
      order = await new PrintifyClient(store.apiKey).getOrder(store.externalStoreId, orderId);
    } else {
      const existing = await repository.getOrder("gelato", orderId);
      const store = (await repository.listEnabledProviderStores("gelato")).find(
        (candidate) => candidate.externalStoreId === existing?.shopId
      );
      if (!store) {
        await ctx.answerCallbackQuery({ text: "🌐 Enable the Gelato store in settings first." });
        return;
      }
      order = await new GelatoClient(store.apiKey, store.externalStoreId).getOrder(orderId);
    }
    await repository.upsertOrder(order, "poll");
    await ctx.editMessageText(renderOrderSummary(order), {
      reply_markup: orderKeyboard(order)
    });
    await ctx.answerCallbackQuery({ text: "🔄 Order refreshed." });
  });

  bot.callbackQuery(/^settings:digest$/, async (ctx) => {
    const current = await repository.ensureSettings();
    await ctx.editMessageText("📋 Digest settings", {
      reply_markup: digestSettingsKeyboard(current)
    });
  });

  bot.callbackQuery(/^settings:menu$/, async (ctx) => {
    const settings = await repository.ensureSettings();
    await ctx.editMessageText("⚙️ Settings", {
      reply_markup: generalSettingsKeyboard(settings)
    });
  });

  bot.callbackQuery(/^settings:printify$/, async (ctx) => {
    const keys = await repository.listProviderKeys("printify");
    const stores = await repository.listProviderStores("printify");
    await ctx.editMessageText("🖨️ Printify settings", {
      reply_markup: providerKeysKeyboard("printify", keys, stores)
    });
  });

  bot.callbackQuery(/^settings:gelato$/, async (ctx) => {
    const keys = await repository.listProviderKeys("gelato");
    const stores = await repository.listProviderStores("gelato");
    await ctx.editMessageText("🌐 Gelato settings", {
      reply_markup: providerKeysKeyboard("gelato", keys, stores)
    });
  });

  bot.callbackQuery(/^settings:(printify|gelato):key:add$/, async (ctx) => {
    const provider = ctx.match[1] as "printify" | "gelato";
    pendingInputs.set(ctx.chat?.id ?? ctx.callbackQuery.message?.chat.id ?? "unknown", {
      type: provider === "printify" ? "printify-key" : "gelato-key"
    });
    await ctx.editMessageText(`🔑 Paste the ${provider === "printify" ? "Printify" : "Gelato"} API key in the next message.`);
  });

  bot.callbackQuery(/^settings:gelato:store:add:(\d+)$/, async (ctx) => {
    const [, keyId] = ctx.match;
    pendingInputs.set(ctx.chat?.id ?? ctx.callbackQuery.message?.chat.id ?? "unknown", {
      type: "gelato-store",
      keyId: Number(keyId)
    });
    await ctx.editMessageText("🏬 Send the Gelato store as: store-id | Store Name");
  });

  bot.callbackQuery(/^settings:store:toggle:(\d+)$/, async (ctx) => {
    const [, storeId] = ctx.match;
    const stores = await repository.listProviderStores();
    const store = stores.find((candidate) => candidate.id === Number(storeId));
    if (!store) {
      await ctx.answerCallbackQuery({ text: "🏬 Store not found." });
      return;
    }
    await repository.setProviderStoreEnabled(store.id, !store.enabled);
    await ctx.answerCallbackQuery({ text: `${store.enabled ? "⬜" : "✅"} ${store.name} ${store.enabled ? "disabled" : "enabled"}.` });
    const updatedStores = await repository.listProviderStores(store.provider);
    const keys = await repository.listProviderKeys(store.provider);
    await ctx.editMessageText(`${store.provider === "printify" ? "🖨️ Printify" : "🌐 Gelato"} settings`, {
      reply_markup:
        store.provider === "printify"
          ? printifyShopsKeyboard(
              updatedStores.map((updatedStore) => ({
                id: String(updatedStore.id),
                title: `${updatedStore.name} (${updatedStore.externalStoreId})`,
                enabled: updatedStore.enabled
              }))
            )
          : providerKeysKeyboard("gelato", keys, updatedStores)
    });
  });

  bot.callbackQuery(/^settings:digest:toggle$/, async (ctx) => {
    const current = await repository.ensureSettings();
    const updated = await repository.updateSettings({
      digestEnabled: !current.digestEnabled
    });
    await ctx.editMessageText("Digest settings", {
      reply_markup: digestSettingsKeyboard(updated)
    });
  });

  bot.callbackQuery(/^settings:digest:updates-only$/, async (ctx) => {
    const current = await repository.ensureSettings();
    const updated = await repository.updateSettings({
      digestEnabled: true,
      digestOnlyOnUpdates: !current.digestOnlyOnUpdates
    });
    await ctx.editMessageText("Digest settings", {
      reply_markup: digestSettingsKeyboard(updated)
    });
  });

  bot.callbackQuery(/^noop:provider$/, async (ctx) => {
    await ctx.answerCallbackQuery({
      text: "📍 Provider link is not available for this order."
    });
  });

  bot.callbackQuery(/^orders:refresh$/, async (ctx) => {
    const summary = await refreshAllOrders({
      repository
    });

    const settings = await repository.ensureSettings();
    for (const notification of summary.orderDetailsNotifications) {
      const order = await repository.getOrder(notification.provider, notification.externalOrderId);
      if (order) {
        await sendOrderAlert(
          bot,
          settings.telegramChatId,
          order,
          settings,
          await storeNameMap(repository)
        );
      }
    }
    const openOrders = await repository.listOpenOrders();
    const changes = await repository.listRecentStatusEvents(settings.lastDigestSentAt);
    await ctx.editMessageText(renderDigest(openOrders, changes, settings, await storeNameMap(repository)), {
      parse_mode: "HTML",
      reply_markup: ordersKeyboard(openOrders)
    });
    await ctx.answerCallbackQuery({ text: "🔄 Orders refreshed." });
  });

  return bot;
}

export async function registerTelegramCommands(
  bot: TelegramBot,
  chatId: string | number
) {
  const numericChatId = typeof chatId === "number" ? chatId : Number(chatId);

  await bot.api.setMyCommands(TELEGRAM_COMMANDS);
  await bot.api.setMyCommands(TELEGRAM_COMMANDS, {
    scope: { type: "all_group_chats" }
  });
  await bot.api.setMyCommands(TELEGRAM_COMMANDS, {
    scope: {
      type: "chat",
      chat_id: numericChatId
    }
  });

  if (numericChatId > 0) {
    await bot.api.setChatMenuButton({
      chat_id: numericChatId,
      menu_button: {
        type: "commands"
      }
    });
  }
}

export async function sendOrderAlert(
  bot: Bot,
  chatId: string,
  order: NormalizedOrder,
  settings: BotSettings,
  storeNames: Record<string, string> = {}
) {
  await bot.api.sendMessage(chatId, renderOrderDetails(order, settings, storeNames), {
    parse_mode: "HTML",
    reply_markup: orderKeyboard(order)
  });
}

export async function sendDigest(
  bot: Bot,
  chatId: string,
  orders: NormalizedOrder[],
  changes: Array<{ orderUniqueKey: string; status: string; occurredAt: string | null }>,
  settings?: BotSettings,
  storeNames: Record<string, string> = {}
) {
  await bot.api.sendMessage(chatId, renderDigest(orders, changes, settings, storeNames), {
    parse_mode: "HTML",
    reply_markup: orders.length > 0 ? ordersKeyboard(orders) : undefined
  });
}
