import cron from "node-cron";
import type { Bot } from "grammy";

import type { Repository } from "../db/repository.js";
import type { BotSettings, NormalizedOrder } from "../domain/types.js";
import { GelatoClient } from "../providers/gelato.js";
import { PrintifyClient } from "../providers/printify.js";
import { refreshAllOrders } from "./sync.js";
import { sendDigest, sendOrderAlert } from "../telegram/bot.js";

export function startScheduler(deps: {
  repository: Repository;
  bot: Bot;
  settings: BotSettings;
  printify: PrintifyClient;
  gelato: GelatoClient;
}) {
  const { repository, bot, settings, printify, gelato } = deps;

  cron.schedule("*/30 * * * *", async () => {
    const summary = await refreshAllOrders({
      repository,
      printify,
      gelato
    });
    const currentSettings = await repository.ensureSettings();
    for (const notification of summary.orderDetailsNotifications) {
      const order = await repository.getOrder(notification.provider, notification.externalOrderId);
      if (order) {
        await sendOrderAlert(
          bot,
          currentSettings.telegramChatId,
          order,
          currentSettings
        );
      }
    }
  });

  cron.schedule("0 */6 * * *", async () => {
    const currentSettings = await repository.ensureSettings();
    if (currentSettings.digestEnabled) {
      await refreshAllOrders({
        repository,
        printify,
        gelato
      });
      const openOrders = await repository.listOpenOrders();
      const changes = await repository.listRecentStatusEvents(currentSettings.lastDigestSentAt);

      await sendDigest(bot, currentSettings.telegramChatId, openOrders, changes, currentSettings);
      await repository.updateSettings({ lastDigestSentAt: new Date().toISOString() });
    }
  });
}
