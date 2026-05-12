import { describe, expect, test } from "vitest";

import { TELEGRAM_COMMANDS } from "../src/telegram/bot.js";

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
});
