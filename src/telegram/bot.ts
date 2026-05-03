import { Bot, type Context, InlineKeyboard } from "grammy";

import type { AppConfig } from "../config.js";
import { evaluateOrderAlert } from "../domain/alerts.js";
import type { BotSettings, NormalizedOrder } from "../domain/types.js";
import { GelatoClient } from "../providers/gelato.js";
import { PrintifyClient } from "../providers/printify.js";
import { Repository } from "../db/repository.js";
import { isAuthorizedGroupChat } from "./access-control.js";
import {
  digestSettingsKeyboard,
  orderKeyboard,
  ordersKeyboard,
  privacySettingsKeyboard
} from "./keyboards.js";
import { renderDigest, renderOrderDetails, renderOrderSummary } from "./render.js";

type AppContext = Context;

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
    await ctx.reply("Commands: /orders /digest /settings /privacy");
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

  bot.command("digest", async (ctx) => {
    const settings = await repository.ensureSettings();
    await ctx.reply(
      `Digest is ${settings.digestEnabled ? "enabled" : "disabled"} at ${String(settings.digestHour).padStart(2, "0")}:${String(settings.digestMinute).padStart(2, "0")} ${settings.timezone}`,
      {
        reply_markup: digestSettingsKeyboard(settings)
      }
    );
  });

  bot.command("settings", async (ctx) => {
    const settings = await repository.ensureSettings();
    await ctx.reply("Settings", {
      reply_markup: new InlineKeyboard()
        .text("Digest", "settings:digest")
        .text("Privacy", "settings:privacy")
    });
  });

  bot.command("privacy", async (ctx) => {
    const settings = await repository.ensureSettings();
    await ctx.reply("Privacy settings", {
      reply_markup: privacySettingsKeyboard(settings)
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
    const order =
      provider === "printify" ? await printify.getOrder(orderId) : await gelato.getOrder(orderId);
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

  bot.callbackQuery(/^settings:privacy$/, async (ctx) => {
    const current = await repository.ensureSettings();
    await ctx.editMessageText("Privacy settings", {
      reply_markup: privacySettingsKeyboard(current)
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

  bot.callbackQuery(/^settings:digest:scope$/, async (ctx) => {
    const current = await repository.ensureSettings();
    const updated = await repository.updateSettings({
      digestStuckOnly: !current.digestStuckOnly
    });
    await ctx.editMessageText("Digest settings", {
      reply_markup: digestSettingsKeyboard(updated)
    });
  });

  bot.callbackQuery(/^settings:digest:time:(\d+):(\d+)$/, async (ctx) => {
    const [, hour, minute] = ctx.match;
    const updated = await repository.updateSettings({
      digestHour: Number(hour),
      digestMinute: Number(minute)
    });
    await ctx.editMessageText("Digest settings", {
      reply_markup: digestSettingsKeyboard(updated)
    });
  });

  bot.callbackQuery(/^settings:privacy:(name|email|phone|address)$/, async (ctx) => {
    const current = await repository.ensureSettings();
    const field = ctx.match[1];
    const updated = await repository.updateSettings({
      piiName: field === "name" ? !current.piiName : current.piiName,
      piiEmail: field === "email" ? !current.piiEmail : current.piiEmail,
      piiPhone: field === "phone" ? !current.piiPhone : current.piiPhone,
      piiAddress: field === "address" ? !current.piiAddress : current.piiAddress
    });
    await ctx.editMessageText("Privacy settings", {
      reply_markup: privacySettingsKeyboard(updated)
    });
  });

  bot.callbackQuery(/^order:ack:(gelato|printify):(.+)$/, async (ctx) => {
    const [, provider, orderId] = ctx.match;
    const updated = await repository.setLatestAlertStateForOrder(
      provider,
      orderId,
      "acknowledged"
    );
    await ctx.answerCallbackQuery({
      text: updated ? "Alert acknowledged." : "No active alert for this order."
    });
  });

  bot.callbackQuery(/^order:snooze:(gelato|printify):(.+):(\d+)$/, async (ctx) => {
    const [, provider, orderId, hours] = ctx.match;
    const snoozedUntil = new Date(Date.now() + Number(hours) * 60 * 60 * 1000).toISOString();
    const updated = await repository.setLatestAlertStateForOrder(
      provider,
      orderId,
      "snoozed",
      snoozedUntil
    );
    await ctx.answerCallbackQuery({
      text: updated ? `Alert snoozed for ${hours}h.` : "No active alert for this order."
    });
  });

  bot.callbackQuery(/^orders:refresh$/, async (ctx) => {
    const printifyOrders = await printify.listOrders();
    for (const order of printifyOrders) {
      await repository.upsertOrder(order, "poll");
    }

    const settings = await repository.ensureSettings();
    const openOrders = await repository.listOpenOrders();
    const alerts = await repository.listActiveAlerts();
    const changes = await repository.listRecentStatusEvents(settings.lastDigestSentAt);
    await ctx.editMessageText(renderDigest(openOrders, alerts, changes), {
      reply_markup: ordersKeyboard(openOrders)
    });
    await ctx.answerCallbackQuery({ text: "Orders refreshed." });
  });

  return bot;
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
  alerts: Array<{ orderUniqueKey: string; severity: string; message: string }>,
  changes: Array<{ orderUniqueKey: string; status: string; occurredAt: string | null }>
) {
  await bot.api.sendMessage(chatId, renderDigest(orders, alerts, changes));
}

export async function findAlertForOrder(
  order: NormalizedOrder,
  settings: BotSettings
) {
  return evaluateOrderAlert(order, {
    nowIso: new Date().toISOString(),
    preProductionHours: settings.thresholds.preProductionHours,
    holdHours: settings.thresholds.holdHours,
    productionBusinessDays: settings.thresholds.productionBusinessDays
  });
}
