import Fastify from "fastify";

import type { Bot } from "grammy";

import type { AppConfig } from "../config.js";
import { Repository } from "../db/repository.js";

export function createServer(deps: {
  config: AppConfig;
  repository: Repository;
  bot: Bot;
}) {
  void deps;
  const server = Fastify({ logger: true });

  server.get("/health", async () => ({ ok: true }));

  return server;
}
