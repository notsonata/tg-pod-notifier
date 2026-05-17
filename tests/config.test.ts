import { describe, expect, test } from "vitest";

import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  test("allows provider credentials to be unset at startup", () => {
    const originalEnv = { ...process.env };

    process.env.TELEGRAM_BOT_TOKEN = "token";
    process.env.AUTHORIZED_TELEGRAM_CHAT_ID = "-100123";
    process.env.CLOUDFLARE_TUNNEL_TOKEN = "cf-token";
    delete process.env.GELATO_API_KEY;
    delete process.env.GELATO_STORE_ID;
    delete process.env.PRINTIFY_API_TOKEN;
    delete process.env.PRINTIFY_SHOP_ID;

    const config = loadConfig();
    expect(config.PRINTIFY_SHOP_ID).toBeUndefined();
    expect(config.GELATO_STORE_ID).toBeUndefined();
    expect(config.GELATO_API_KEY).toBeUndefined();
    expect(config.PRINTIFY_API_TOKEN).toBeUndefined();

    process.env = originalEnv;
  });

  test("treats an empty PRINTIFY_SHOP_ID as unset", () => {
    const originalEnv = { ...process.env };

    process.env.TELEGRAM_BOT_TOKEN = "token";
    process.env.AUTHORIZED_TELEGRAM_CHAT_ID = "-100123";
    process.env.CLOUDFLARE_TUNNEL_TOKEN = "cf-token";
    process.env.PRINTIFY_SHOP_ID = "";

    const config = loadConfig();
    expect(config.PRINTIFY_SHOP_ID).toBeUndefined();

    process.env = originalEnv;
  });
});
