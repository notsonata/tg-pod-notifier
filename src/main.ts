import { loadConfig } from "./config.js";
import { createDatabase } from "./db/client.js";
import { Repository } from "./db/repository.js";
import { createServer } from "./http/server.js";
import { startScheduler } from "./jobs/scheduler.js";
import { refreshAllOrders } from "./jobs/sync.js";
import {
  createTelegramBot,
  registerTelegramCommands,
  sendOrderAlert
} from "./telegram/bot.js";

async function main() {
  const config = loadConfig();
  const { db } = createDatabase(config.DATABASE_PATH);
  const repository = new Repository(db, config);
  await repository.ensureSettings();
  const bot = createTelegramBot({
    config,
    repository
  });
  const server = createServer({
    config,
    repository,
    bot
  });

  startScheduler({
    repository,
    bot
  });

  await bot.init();
  await registerTelegramCommands(bot, config.AUTHORIZED_TELEGRAM_CHAT_ID);
  console.log(`Registered Telegram commands for chat ${config.AUTHORIZED_TELEGRAM_CHAT_ID}.`);
  await server.listen({ host: "0.0.0.0", port: config.PORT });
  const summary = await refreshAllOrders({
    repository
  });
  const latestSettings = await repository.ensureSettings();
  const stores = await repository.listProviderStores();
  const storeNames = Object.fromEntries(stores.map((store) => [store.externalStoreId, store.name]));
  for (const notification of summary.orderDetailsNotifications) {
    const order = await repository.getOrder(notification.provider, notification.externalOrderId);
    if (order) {
      await sendOrderAlert(
        bot,
        latestSettings.telegramChatId,
        order,
        latestSettings,
        storeNames
      );
    }
  }
  void bot.start({
    onStart: () => {
      console.log("Telegram bot polling started.");
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
