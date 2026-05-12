import { describe, expect, test } from "vitest";

import { registerTelegramCommands, TELEGRAM_COMMANDS } from "../src/telegram/bot.js";

describe("TELEGRAM_COMMANDS", () => {
  test("registers the expected slash commands", () => {
    expect(TELEGRAM_COMMANDS.map((command) => command.command)).toEqual([
      "start",
      "help",
      "orders",
      "refresh",
      "digest",
      "settings",
      "privacy"
    ]);
  });

  test("does not set a private chat menu button for group chats", async () => {
    const calls: [string, ...unknown[]][] = [];
    const bot = {
      api: {
        setMyCommands: async (...args: unknown[]) => {
          calls.push(["setMyCommands", ...args]);
        },
        setChatMenuButton: async (...args: unknown[]) => {
          calls.push(["setChatMenuButton", ...args]);
        }
      }
    };

    await registerTelegramCommands(
      bot as unknown as Parameters<typeof registerTelegramCommands>[0],
      "-1003683184154"
    );

    expect(calls.filter(([method]) => method === "setMyCommands")).toHaveLength(3);
    expect(calls.some(([method]) => method === "setChatMenuButton")).toBe(false);
  });
});
