import { loadConfig } from "./config.js";
import { createDatabase } from "./db/client.js";
import { Repository } from "./db/repository.js";
import { createServer } from "./http/server.js";
import { startScheduler } from "./jobs/scheduler.js";
import { GelatoClient } from "./providers/gelato.js";
import { PrintifyClient } from "./providers/printify.js";
import { createTelegramBot } from "./telegram/bot.js";

async function main() {
  const config = loadConfig();
  const { db } = createDatabase(config.DATABASE_PATH);
  const repository = new Repository(db, config);
  const settings = await repository.ensureSettings();
  const printify = new PrintifyClient(config.PRINTIFY_API_TOKEN, config.PRINTIFY_SHOP_ID);
  const gelato = new GelatoClient(config.GELATO_API_KEY);
  const bot = createTelegramBot({
    config,
    repository,
    printify,
    gelato
  });
  const server = createServer({
    config,
    repository,
    bot,
    printify,
    gelato
  });

  startScheduler({
    repository,
    bot,
    settings,
    printify,
    gelato
  });

  await bot.init();
  await server.listen({ host: "0.0.0.0", port: config.PORT });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
