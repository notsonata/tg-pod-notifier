import cron from "node-cron";
import type { Bot } from "grammy";

import type { Repository } from "../db/repository.js";
import { evaluateOrderAlert } from "../domain/alerts.js";
import type { BotSettings, NormalizedOrder } from "../domain/types.js";
import { GelatoClient } from "../providers/gelato.js";
import { PrintifyClient } from "../providers/printify.js";
import { shouldSendDigest } from "./digest.js";
import { sendDigest, sendOrderAlert } from "../telegram/bot.js";

async function refreshPrintifyOrders(printify: PrintifyClient, repository: Repository) {
  const shopId = await repository.getSelectedPrintifyShopId();
  if (!shopId) {
    return;
  }
  const orders = await printify.listOrders(shopId);
  for (const order of orders) {
    await repository.upsertOrder(order, "poll");
  }
}

async function refreshGelatoOrders(gelato: GelatoClient, repository: Repository) {
  const knownOrders = await repository.listKnownGelatoOrders();
  for (const order of knownOrders) {
    const refreshed = order.referenceOrderId
      ? await gelato.getOrderStatus(order.referenceOrderId)
      : await gelato.getOrder(order.externalOrderId);
    await repository.upsertOrder(refreshed, "poll");
  }
}

async function scanAlerts(
  repository: Repository,
  bot: Bot,
  settings: BotSettings
) {
  const openOrders = await repository.listOpenOrders();
  for (const order of openOrders) {
    const alert = evaluateOrderAlert(order, {
      nowIso: new Date().toISOString(),
      preProductionHours: settings.thresholds.preProductionHours,
      holdHours: settings.thresholds.holdHours,
      productionBusinessDays: settings.thresholds.productionBusinessDays
    });

    if (alert) {
      const shouldSend = await repository.upsertAlert(order, alert);
      if (shouldSend) {
        await sendOrderAlert(bot, settings.telegramChatId, order, settings);
      }
    }
  }
}

export function startScheduler(deps: {
  repository: Repository;
  bot: Bot;
  settings: BotSettings;
  printify: PrintifyClient;
  gelato: GelatoClient;
}) {
  const { repository, bot, settings, printify, gelato } = deps;

  cron.schedule("*/30 * * * *", async () => {
    await refreshPrintifyOrders(printify, repository);
    await refreshGelatoOrders(gelato, repository);
    const currentSettings = await repository.ensureSettings();
    await scanAlerts(repository, bot, currentSettings);
  });

  cron.schedule("* * * * *", async () => {
    const currentSettings = await repository.ensureSettings();
    if (shouldSendDigest(currentSettings)) {
      const openOrders = await repository.listOpenOrders();
      const activeAlerts = await repository.listActiveAlerts();
      const changes = await repository.listRecentStatusEvents(currentSettings.lastDigestSentAt);
      const filteredOrders = currentSettings.digestStuckOnly
        ? openOrders.filter((order) =>
            activeAlerts.some(
              (alert) => alert.orderUniqueKey === `${order.provider}:${order.externalOrderId}`
            )
          )
        : openOrders;

      await sendDigest(bot, currentSettings.telegramChatId, filteredOrders, activeAlerts, changes);
      await repository.updateSettings({ lastDigestSentAt: new Date().toISOString() });
    }
  });
}
