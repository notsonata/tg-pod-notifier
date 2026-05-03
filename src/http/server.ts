import crypto from "node:crypto";

import Fastify from "fastify";

import type { Bot } from "grammy";

import type { AppConfig } from "../config.js";
import { Repository } from "../db/repository.js";
import { GelatoClient, normalizeGelatoWebhook } from "../providers/gelato.js";
import { PrintifyClient, normalizePrintifyWebhook } from "../providers/printify.js";
import { sendOrderAlert } from "../telegram/bot.js";

export function createServer(deps: {
  config: AppConfig;
  repository: Repository;
  bot: Bot;
  printify: PrintifyClient;
  gelato: GelatoClient;
}) {
  const { config, repository, bot, printify, gelato } = deps;
  const server = Fastify({ logger: true });

  server.get("/health", async () => ({ ok: true }));

  server.post("/webhooks/printify", async (request, reply) => {
    const payload = request.body as Record<string, unknown>;
    const event = normalizePrintifyWebhook(payload as never);
    if (await repository.hasProcessedWebhook("printify", event.eventId)) {
      return reply.status(202).send({ ok: true, duplicate: true });
    }

    await repository.markWebhookProcessed("printify", event.eventId, payload);
    await repository.appendStatusEvent(event, "webhook");
    const refreshed = await printify.getOrder(event.orderId);
    await repository.upsertOrder(refreshed, "webhook");
    const settings = await repository.ensureSettings();
    await sendOrderAlert(bot, settings.telegramChatId, refreshed, settings);
    return reply.status(202).send({ ok: true });
  });

  server.post("/webhooks/gelato", async (request, reply) => {
    const payload = request.body as Record<string, unknown>;
    const event = normalizeGelatoWebhook(payload as never);
    const eventId =
      event.eventId ||
      crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

    if (await repository.hasProcessedWebhook("gelato", eventId)) {
      return reply.status(202).send({ ok: true, duplicate: true });
    }

    await repository.markWebhookProcessed("gelato", eventId, payload);
    await repository.appendStatusEvent({ ...event, eventId }, "webhook");
    const refreshed = event.referenceOrderId
      ? await gelato.getOrderStatus(event.referenceOrderId)
      : await gelato.getOrder(event.orderId);
    await repository.upsertOrder(refreshed, "webhook");
    const settings = await repository.ensureSettings();
    await sendOrderAlert(bot, settings.telegramChatId, refreshed, settings);
    return reply.status(202).send({ ok: true });
  });

  return server;
}
