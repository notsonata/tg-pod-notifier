import { describe, expect, test } from "vitest";

import { isAuthorizedGroupChat } from "../src/telegram/access-control.js";

describe("isAuthorizedGroupChat", () => {
  test("accepts the configured group chat", () => {
    expect(isAuthorizedGroupChat(-10012345, -10012345)).toBe(true);
  });

  test("rejects private chats and other groups", () => {
    expect(isAuthorizedGroupChat(42, -10012345)).toBe(false);
    expect(isAuthorizedGroupChat(-10099999, -10012345)).toBe(false);
  });
});
