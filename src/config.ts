import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const optionalNonEmptyString = z.preprocess((value) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}, z.string().min(1).optional());

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  AUTHORIZED_TELEGRAM_CHAT_ID: z.string().min(1),
  GELATO_API_KEY: z.string().min(1),
  GELATO_STORE_ID: z.string().min(1),
  PRINTIFY_API_TOKEN: z.string().min(1),
  PRINTIFY_SHOP_ID: optionalNonEmptyString,
  DATABASE_PATH: z.string().min(1).default("./data/tg-notifier.sqlite"),
  PORT: z.coerce.number().int().positive().default(38127),
  DEFAULT_TIMEZONE: z.string().min(1).default("UTC")
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  return envSchema.parse(process.env);
}
