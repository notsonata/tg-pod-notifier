import type { NormalizedOrder, NormalizedOrderEvent } from "../domain/types.js";

export interface PrintifyShop {
  id: number | string;
  title: string;
  sales_channel?: string;
}

interface PrintifyLineItem {
  product_id?: string;
  quantity?: number;
  status?: string;
  metadata?: {
    title?: string;
    sku?: string;
    variant_label?: string;
  };
}

interface PrintifyShipment {
  carrier?: string;
  tracking_number?: string;
  tracking_url?: string;
}

interface PrintifyOrderPayload {
  id: string;
  created_at?: string;
  updated_at?: string;
  status?: string;
  total_price?: number;
  total_shipping?: number;
  line_items?: PrintifyLineItem[];
  shipments?: Array<PrintifyShipment & { shipped_at?: string; delivered_at?: string | null }>;
  address_to?: {
    first_name?: string;
    last_name?: string;
    city?: string;
    region?: string;
    country?: string;
    email?: string;
    phone?: string;
    address1?: string;
    address2?: string;
    zip?: string;
  };
}

interface PrintifyWebhookPayload {
  id: string;
  type: string;
  created_at?: string;
  resource: {
    id: string;
    type: string;
      data?: {
        shop_id?: number;
        status?: string;
        shipped_at?: string;
        delivered_at?: string;
        skus?: string[];
        carrier?: {
          code?: string;
          tracking_number?: string;
      };
    } | null;
  };
}

function asIso(value: string | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

function statusFromWebhook(type: string, status: string | undefined): string {
  if (type === "order:shipment:created") {
    return "shipped";
  }

  if (type === "order:shipment:delivered") {
    return "delivered";
  }

  if (type === "order:sent-to-production") {
    return "sent-to-production";
  }

  return status ?? "pending";
}

export function normalizePrintifyOrder(
  payload: PrintifyOrderPayload,
  shopId: string | null = null
): NormalizedOrder {
  const customerName = [payload.address_to?.first_name, payload.address_to?.last_name]
    .filter(Boolean)
    .join(" ");

  return {
    provider: "printify",
    externalOrderId: payload.id,
    referenceOrderId: null,
    shopId,
    status: payload.status ?? "pending",
    createdAt: asIso(payload.created_at),
    updatedAt: asIso(payload.updated_at),
    customer: {
      name: customerName || null,
      city: payload.address_to?.city ?? null,
      region: payload.address_to?.region ?? null,
      country: payload.address_to?.country ?? null,
      email: payload.address_to?.email ?? null,
      phone: payload.address_to?.phone ?? null,
      address1: payload.address_to?.address1 ?? null,
      address2: payload.address_to?.address2 ?? null,
      postalCode: payload.address_to?.zip ?? null
    },
    items:
      payload.line_items?.map((item) => ({
        externalItemId: item.product_id ?? null,
        sku: item.metadata?.sku ?? null,
        title: item.metadata?.title ?? item.metadata?.variant_label ?? "Unnamed item",
        quantity: item.quantity ?? 1,
        status: item.status ?? payload.status ?? "pending"
      })) ?? [],
    trackingLinks:
      payload.shipments
        ?.filter((shipment): shipment is PrintifyShipment & { tracking_number: string } =>
          Boolean(shipment.tracking_number)
        )
        .map((shipment) => ({
          carrier: shipment.carrier ?? null,
          trackingNumber: shipment.tracking_number,
          trackingUrl: shipment.tracking_url ?? null
        })) ?? [],
    providerUrl: null,
    etaMinAt: null,
    etaMaxAt: null,
    raw: payload
  };
}

export function normalizePrintifyWebhook(
  payload: PrintifyWebhookPayload
): NormalizedOrderEvent {
  return {
    provider: "printify",
    eventId: payload.id,
    orderId: payload.resource.id,
    referenceOrderId: null,
    status: statusFromWebhook(payload.type, payload.resource.data?.status),
    occurredAt: asIso(payload.created_at),
    comment: null,
    raw: payload
  };
}

export class PrintifyClient {
  constructor(
    private readonly apiToken: string,
    private readonly baseUrl = "https://api.printify.com/v1"
  ) {}

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.apiToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Printify request failed: ${response.status}`);
    }

    return (await response.json()) as T;
  }

  async listShops(): Promise<PrintifyShop[]> {
    return this.request<PrintifyShop[]>("/shops.json");
  }

  async listOrders(shopId: string): Promise<NormalizedOrder[]> {
    const payload = await this.request<{ data?: PrintifyOrderPayload[]; next?: string }>(
      `/shops/${shopId}/orders.json`
    );

    return (payload.data ?? []).map((order) => normalizePrintifyOrder(order, shopId));
  }

  async getOrder(shopId: string, orderId: string): Promise<NormalizedOrder> {
    const payload = await this.request<PrintifyOrderPayload>(
      `/shops/${shopId}/orders/${orderId}.json`
    );

    return normalizePrintifyOrder(payload, shopId);
  }
}
