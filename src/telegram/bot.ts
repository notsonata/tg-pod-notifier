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
  printifyShopsKeyboard
} from "./keyboards.js";
import {
  renderDigest,
  renderOrderDetails,
  renderOrderSummary
} from "./render.js";

type AppContext = Context;
type TelegramBot = Bot<AppContext>;

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

export function createTelegramBot(deps: {
  config: AppConfig;
  repository: Repository;
  printify: PrintifyClient;
  gelato: GelatoClient;
}) {
  const { config, repository, printify, gelato } = deps;
  const bot = new Bot<AppContext>(config.TELEGRAM_BOT_TOKEN);

  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id ?? ctx.callbackQuery?.message?.chat.id;
    if (!isAuthorizedGroupChat(chatId, config.AUTHORIZED_TELEGRAM_CHAT_ID)) {
      return;
    }

    await next();
  });

  bot.command("start", async (ctx) => {
    await ctx.reply("Order notifier is active in this group.");
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
    const summary = await refreshAllOrders({
      repository,
      printify,
      gelato
    });
    const settings = await repository.ensureSettings();
    for (const notification of summary.orderDetailsNotifications) {
      const order = await repository.getOrder(notification.provider, notification.externalOrderId);
      if (order) {
        await sendOrderAlert(
          bot,
          settings.telegramChatId,
          order,
          settings
        );
      }
    }
    const openOrders = await repository.listOpenOrders();
    const changes = await repository.listRecentStatusEvents(settings.lastDigestSentAt);

    await ctx.reply(
      [
        "Refresh complete.",
        `Printify shop selected: ${summary.printifyShopSelected ? "yes" : "no"}`,
        `Printify orders refreshed: ${summary.printifyOrders}`,
        `Gelato tracked orders refreshed: ${summary.gelatoOrders}`,
        `Active tracked orders: ${openOrders.length}`,
      ]
        .filter(Boolean)
        .join("\n"),
      {
        reply_markup: openOrders.length > 0 ? ordersKeyboard(openOrders) : undefined
      }
    );
    await ctx.reply(renderDigest(openOrders, changes, settings), {
      reply_markup: openOrders.length > 0 ? ordersKeyboard(openOrders) : undefined
    });
  });

  bot.command("digest", async (ctx) => {
    const settings = await repository.ensureSettings();
    await ctx.reply(
      `Order digest is ${settings.digestEnabled ? "enabled" : "disabled"}.`,
      {
        reply_markup: digestSettingsKeyboard(settings)
      }
    );
  });

  bot.command("settings", async (ctx) => {
    const settings = await repository.ensureSettings();
    await ctx.reply("Settings", {
      reply_markup: generalSettingsKeyboard(settings)
    });
  });

  bot.callbackQuery(/^order:view:(gelato|printify):(.+)$/, async (ctx) => {
    const [, provider, orderId] = ctx.match;
    const order = await loadOrder(repository, provider, orderId);
    const settings = await repository.ensureSettings();
    if (!order) {
      await ctx.answerCallbackQuery({ text: "Order not found." });
      return;
    }

    await ctx.editMessageText(renderOrderDetails(order, settings), {
      reply_markup: orderKeyboard(order)
    });
  });

  bot.callbackQuery(/^order:refresh:(gelato|printify):(.+)$/, async (ctx) => {
    const [, provider, orderId] = ctx.match;
    let order: NormalizedOrder;
    if (provider === "printify") {
      const shopId = await repository.getSelectedPrintifyShopId();
      if (!shopId) {
        await ctx.answerCallbackQuery({ text: "Select a Printify shop in settings first." });
        return;
      }
      order = await printify.getOrder(shopId, orderId);
    } else {
      order = await gelato.getOrder(orderId);
    }
    await repository.upsertOrder(order, "poll");
    await ctx.editMessageText(renderOrderSummary(order), {
      reply_markup: orderKeyboard(order)
    });
    await ctx.answerCallbackQuery({ text: "Order refreshed." });
  });

  bot.callbackQuery(/^settings:digest$/, async (ctx) => {
    const current = await repository.ensureSettings();
    await ctx.editMessageText("Digest settings", {
      reply_markup: digestSettingsKeyboard(current)
    });
  });

  bot.callbackQuery(/^settings:menu$/, async (ctx) => {
    const settings = await repository.ensureSettings();
    await ctx.editMessageText("Settings", {
      reply_markup: generalSettingsKeyboard(settings)
    });
  });

  bot.callbackQuery(/^settings:printify$/, async (ctx) => {
    const shops = await printify.listShops();
    await ctx.editMessageText("Select the Printify shop for this bot.", {
      reply_markup: printifyShopsKeyboard(
        shops.map((shop) => ({
          id: String(shop.id),
          title: `${shop.title} (${String(shop.id)})`
        }))
      )
    });
  });

  bot.callbackQuery(/^settings:printify:select:(.+)$/, async (ctx) => {
    const [, shopId] = ctx.match;
    const shops = await printify.listShops();
    const selectedShop = shops.find((shop) => String(shop.id) === shopId);
    const updated = await repository.updateSettings({
      printifyShopId: shopId,
      printifyShopName: selectedShop?.title ?? null
    });
    await ctx.editMessageText(
      `Selected Printify shop ${selectedShop?.title ?? shopId}.`,
      {
      reply_markup: generalSettingsKeyboard(updated)
      }
    );
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

  bot.callbackQuery(/^noop:provider$/, async (ctx) => {
    await ctx.answerCallbackQuery({
      text: "Provider link is not available for this order."
    });
  });

  bot.callbackQuery(/^orders:refresh$/, async (ctx) => {
    const summary = await refreshAllOrders({
      repository,
      printify,
      gelato
    });

    const settings = await repository.ensureSettings();
    for (const notification of summary.orderDetailsNotifications) {
      const order = await repository.getOrder(notification.provider, notification.externalOrderId);
      if (order) {
        await sendOrderAlert(
          bot,
          settings.telegramChatId,
          order,
          settings
        );
      }
    }
    const openOrders = await repository.listOpenOrders();
    const changes = await repository.listRecentStatusEvents(settings.lastDigestSentAt);
    await ctx.editMessageText(renderDigest(openOrders, changes, settings), {
      reply_markup: ordersKeyboard(openOrders)
    });
    await ctx.answerCallbackQuery({ text: "Orders refreshed." });
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
  settings: BotSettings
) {
  await bot.api.sendMessage(chatId, renderOrderDetails(order, settings), {
    reply_markup: orderKeyboard(order)
  });
}

export async function sendDigest(
  bot: Bot,
  chatId: string,
  orders: NormalizedOrder[],
  changes: Array<{ orderUniqueKey: string; status: string; occurredAt: string | null }>,
  settings?: BotSettings
) {
  await bot.api.sendMessage(chatId, renderDigest(orders, changes, settings), {
    reply_markup: orders.length > 0 ? ordersKeyboard(orders) : undefined
  });
}
