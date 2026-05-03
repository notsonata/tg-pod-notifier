import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  AUTHORIZED_TELEGRAM_CHAT_ID: z.string().min(1),
  PUBLIC_WEBHOOK_BASE_URL: z.string().url(),
  GELATO_API_KEY: z.string().min(1),
  PRINTIFY_API_TOKEN: z.string().min(1),
  PRINTIFY_SHOP_ID: z.string().min(1),
  DATABASE_PATH: z.string().min(1).default("./data/tg-notifier.sqlite"),
  PORT: z.coerce.number().int().positive().default(38127),
  DEFAULT_TIMEZONE: z.string().min(1).default("UTC"),
  DEFAULT_DIGEST_HOUR: z.coerce.number().int().min(0).max(23).default(9),
  DEFAULT_DIGEST_MINUTE: z.coerce.number().int().min(0).max(59).default(0)
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  return envSchema.parse(process.env);
}
