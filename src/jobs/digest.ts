import type { BotSettings } from "../domain/types.js";

function localDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute)
  };
}

export function shouldSendDigest(settings: BotSettings, now = new Date()): boolean {
  if (!settings.digestEnabled) {
    return false;
  }

  const localNow = localDateParts(now, settings.timezone);
  if (localNow.hour !== settings.digestHour || localNow.minute !== settings.digestMinute) {
    return false;
  }

  if (!settings.lastDigestSentAt) {
    return true;
  }

  const lastSent = localDateParts(new Date(settings.lastDigestSentAt), settings.timezone);
  return (
    localNow.year !== lastSent.year ||
    localNow.month !== lastSent.month ||
    localNow.day !== lastSent.day
  );
}
