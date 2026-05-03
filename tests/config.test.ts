import { describe, expect, test } from "vitest";

import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  test("allows printify shop selection to be unset at startup", () => {
    const originalEnv = { ...process.env };

    process.env.TELEGRAM_BOT_TOKEN = "token";
    process.env.AUTHORIZED_TELEGRAM_CHAT_ID = "-100123";
    process.env.PUBLIC_WEBHOOK_BASE_URL = "https://bot.example.com";
    process.env.CLOUDFLARE_TUNNEL_TOKEN = "cf-token";
    process.env.GELATO_API_KEY = "gelato-key";
    process.env.GELATO_STORE_ID = "gelato-store";
    process.env.PRINTIFY_API_TOKEN = "printify-token";
    delete process.env.PRINTIFY_SHOP_ID;

    const config = loadConfig();
    expect(config.PRINTIFY_SHOP_ID).toBeUndefined();
    expect(config.GELATO_STORE_ID).toBe("gelato-store");

    process.env = originalEnv;
  });

  test("treats an empty PRINTIFY_SHOP_ID as unset", () => {
    const originalEnv = { ...process.env };

    process.env.TELEGRAM_BOT_TOKEN = "token";
    process.env.AUTHORIZED_TELEGRAM_CHAT_ID = "-100123";
    process.env.PUBLIC_WEBHOOK_BASE_URL = "https://bot.example.com";
    process.env.CLOUDFLARE_TUNNEL_TOKEN = "cf-token";
    process.env.GELATO_API_KEY = "gelato-key";
    process.env.GELATO_STORE_ID = "gelato-store";
    process.env.PRINTIFY_API_TOKEN = "printify-token";
    process.env.PRINTIFY_SHOP_ID = "";

    const config = loadConfig();
    expect(config.PRINTIFY_SHOP_ID).toBeUndefined();

    process.env = originalEnv;
  });
});
