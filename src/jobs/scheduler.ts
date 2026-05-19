import cron from "node-cron";
import type { Bot } from "grammy";

import type { Repository } from "../db/repository.js";
import { detectProductionRisk } from "./production-risk.js";
import { refreshAllOrders } from "./sync.js";
import { sendDigest, sendOrderAlert, sendProductionRiskAlert } from "../telegram/bot.js";

export function startScheduler(deps: {
  repository: Repository;
  bot: Bot;
}) {
  const { repository, bot } = deps;

  cron.schedule("*/30 * * * *", async () => {
    const summary = await refreshAllOrders({
      repository
    });
    const currentSettings = await repository.ensureSettings();
    const stores = await repository.listProviderStores();
    const storeNames = Object.fromEntries(
      stores.map((store) => [store.externalStoreId, store.name])
    );
    const riskOrderKeys = new Set<string>();
    const openOrders = await repository.listOpenOrders();
    for (const order of openOrders) {
      const risk = detectProductionRisk(order);
      if (!risk) {
        await repository.resolveProductionRisks(`${order.provider}:${order.externalOrderId}`);
        continue;
      }
      riskOrderKeys.add(`${order.provider}:${order.externalOrderId}`);
      const result = await repository.upsertProductionRisk(risk);
      if (result.shouldAlert) {
        await sendProductionRiskAlert(
          bot,
          currentSettings.telegramChatId,
          order,
          result.risk,
          storeNames
        );
      }
    }

    for (const notification of summary.orderDetailsNotifications) {
      if (riskOrderKeys.has(`${notification.provider}:${notification.externalOrderId}`)) {
        continue;
      }
      const order = await repository.getOrder(notification.provider, notification.externalOrderId);
      if (order) {
        const risk = detectProductionRisk(order);
        if (risk) {
          const result = await repository.upsertProductionRisk(risk);
          if (result.shouldAlert) {
            await sendProductionRiskAlert(
              bot,
              currentSettings.telegramChatId,
              order,
              result.risk,
              storeNames
            );
          }
          continue;
        }
        await sendOrderAlert(
          bot,
          currentSettings.telegramChatId,
          order,
          currentSettings,
          storeNames
        );
      }
    }
  });

  cron.schedule("0 */6 * * *", async () => {
    const currentSettings = await repository.ensureSettings();
    if (currentSettings.digestEnabled) {
      await refreshAllOrders({
        repository
      });
      const openOrders = await repository.listOpenOrders();
      const changes = await repository.listRecentStatusEvents(currentSettings.lastDigestSentAt);
      const stores = await repository.listProviderStores();
      const storeNames = Object.fromEntries(
        stores.map((store) => [store.externalStoreId, store.name])
      );

      if (!currentSettings.digestOnlyOnUpdates || changes.length > 0) {
        await sendDigest(bot, currentSettings.telegramChatId, openOrders, changes, currentSettings, storeNames);
      }
      await repository.updateSettings({ lastDigestSentAt: new Date().toISOString() });
    }
  });
}
