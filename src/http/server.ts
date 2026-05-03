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
    const resource = payload.resource as { data?: { shop_id?: number | string } } | undefined;
    const shopId =
      resource?.data?.shop_id !== undefined
        ? String(resource.data.shop_id)
        : await repository.getSelectedPrintifyShopId();
    if (!shopId) {
      return reply.status(202).send({ ok: true, skipped: "printify-shop-not-selected" });
    }
    const refreshed = await printify.getOrder(shopId, event.orderId);
    const existing = await repository.getOrder("printify", refreshed.externalOrderId);
    const result = await repository.upsertOrder(refreshed, "webhook");
    const settings = await repository.ensureSettings();
    if (!existing) {
      await sendOrderAlert(bot, settings.telegramChatId, refreshed, settings, "new");
    } else if (
      result.statusChanged &&
      result.currentStatus.toLowerCase() === "fulfilled" &&
      result.previousStatus?.toLowerCase() !== "fulfilled"
    ) {
      await sendOrderAlert(bot, settings.telegramChatId, refreshed, settings, "fulfilled");
    }
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
    const existing = await repository.getOrder("gelato", refreshed.externalOrderId);
    const deliveryEstimate = payload as {
      minDeliveryDate?: string;
      maxDeliveryDate?: string;
    };
    const result = await repository.upsertOrder(
      {
        ...refreshed,
        etaMinAt: deliveryEstimate.minDeliveryDate
          ? new Date(deliveryEstimate.minDeliveryDate).toISOString()
          : refreshed.etaMinAt,
        etaMaxAt: deliveryEstimate.maxDeliveryDate
          ? new Date(deliveryEstimate.maxDeliveryDate).toISOString()
          : refreshed.etaMaxAt
      },
      "webhook"
    );
    const settings = await repository.ensureSettings();
    if (!existing) {
      await sendOrderAlert(bot, settings.telegramChatId, refreshed, settings, "new");
    } else if (
      result.statusChanged &&
      result.currentStatus.toLowerCase() === "fulfilled" &&
      result.previousStatus?.toLowerCase() !== "fulfilled"
    ) {
      await sendOrderAlert(bot, settings.telegramChatId, refreshed, settings, "fulfilled");
    }
    return reply.status(202).send({ ok: true });
  });

  return server;
}
