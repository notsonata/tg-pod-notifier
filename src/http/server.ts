import Fastify from "fastify";

import type { Bot } from "grammy";

import type { AppConfig } from "../config.js";
import { Repository } from "../db/repository.js";
import { GelatoClient } from "../providers/gelato.js";
import { PrintifyClient } from "../providers/printify.js";

export function createServer(deps: {
  config: AppConfig;
  repository: Repository;
  bot: Bot;
  printify: PrintifyClient;
  gelato: GelatoClient;
}) {
  void deps;
  const server = Fastify({ logger: true });

  server.get("/health", async () => ({ ok: true }));

  return server;
}
