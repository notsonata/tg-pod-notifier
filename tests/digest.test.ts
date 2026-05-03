import { describe, expect, test } from "vitest";

import { shouldSendDigest } from "../src/jobs/digest.js";

describe("shouldSendDigest", () => {
  test("sends when local timezone matches digest time", () => {
    expect(
      shouldSendDigest(
        {
          telegramChatId: "-1001",
          timezone: "Asia/Manila",
          digestEnabled: true,
          digestHour: 9,
          digestMinute: 0,
          digestStatuses: [],
          digestStuckOnly: false,
          piiName: false,
          piiEmail: false,
          piiPhone: false,
          piiAddress: false,
          thresholds: {
            preProductionHours: 2,
            holdHours: 24,
            productionBusinessDays: 3
          },
          lastDigestSentAt: null
        },
        new Date("2025-01-01T01:00:00.000Z")
      )
    ).toBe(true);
  });

  test("does not resend on the same local day", () => {
    expect(
      shouldSendDigest(
        {
          telegramChatId: "-1001",
          timezone: "Asia/Manila",
          digestEnabled: true,
          digestHour: 9,
          digestMinute: 0,
          digestStatuses: [],
          digestStuckOnly: false,
          piiName: false,
          piiEmail: false,
          piiPhone: false,
          piiAddress: false,
          thresholds: {
            preProductionHours: 2,
            holdHours: 24,
            productionBusinessDays: 3
          },
          lastDigestSentAt: "2025-01-01T01:00:00.000Z"
        },
        new Date("2025-01-01T01:00:30.000Z")
      )
    ).toBe(false);
  });
});
