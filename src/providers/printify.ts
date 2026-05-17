import type { NormalizedOrder } from "../domain/types.js";

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
  status?: string;
}

export interface PrintifyOrderPayload {
  id: string;
  app_order_id?: string | number;
  created_at?: string;
  updated_at?: string;
  status?: string;
  sent_to_production_at?: string;
  total_price?: number;
  currency?: string;
  total_shipping?: number;
  metadata?: {
    shop_order_id?: string | number;
    shop_order_label?: string;
    order_type?: string;
  };
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

function asIso(value: string | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

function asOptionalString(value: string | number | null | undefined): string | null {
  return value === null || value === undefined || value === "" ? null : String(value);
}

function printifyDisplayOrderId(payload: PrintifyOrderPayload): string {
  return (
    asOptionalString(payload.metadata?.shop_order_label) ??
    asOptionalString(payload.metadata?.shop_order_id) ??
    asOptionalString(payload.app_order_id) ??
    payload.id
  );
}

function printifyReferenceOrderId(payload: PrintifyOrderPayload): string | null {
  return asOptionalString(payload.app_order_id);
}

function shipmentIsDelivered(shipment: PrintifyShipment & { delivered_at?: string | null }): boolean {
  return Boolean(shipment.delivered_at) || shipment.status?.toLowerCase() === "delivered";
}

export function normalizePrintifyOrder(
  payload: PrintifyOrderPayload,
  shopId: string | null = null
): NormalizedOrder {
  const customerName = [payload.address_to?.first_name, payload.address_to?.last_name]
    .filter(Boolean)
    .join(" ");
  const status = payload.shipments?.some((shipment) => shipmentIsDelivered(shipment))
    ? "delivered"
    : payload.status ?? "pending";

  return {
    provider: "printify",
    externalOrderId: payload.id,
    displayOrderId: printifyDisplayOrderId(payload),
    referenceOrderId: printifyReferenceOrderId(payload),
    shopId,
    status,
    sentToProductionAt: asIso(payload.sent_to_production_at),
    totalCost:
      typeof payload.total_price === "number"
        ? {
            amount: payload.total_price,
            currency: payload.currency ?? "USD"
          }
        : null,
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
        status: item.status ?? status
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

    return Promise.all(
      (payload.data ?? []).map(async (order) => {
        try {
          return await this.getOrder(shopId, order.id);
        } catch {
          return normalizePrintifyOrder(order, shopId);
        }
      })
    );
  }

  async getOrder(shopId: string, orderId: string): Promise<NormalizedOrder> {
    const payload = await this.request<PrintifyOrderPayload>(
      `/shops/${shopId}/orders/${orderId}.json`
    );

    return normalizePrintifyOrder(payload, shopId);
  }
}
