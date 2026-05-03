import type { NormalizedOrder, NormalizedOrderEvent } from "../domain/types.js";

interface GelatoTrackingCode {
  parcelNumber?: number;
  trackingCode?: string;
  trackingUrl?: string;
}

interface GelatoOrderItem {
  itemReferenceId?: string;
  status?: string;
  fulfillmentStatus?: string;
  trackingCode?: GelatoTrackingCode[];
  productionLog?: unknown[];
}

interface GelatoOrderPayload {
  id?: string;
  orderReferenceId: string;
  fulfillmentStatus?: string;
  productionStatus?: string;
  orderType?: string;
  createdAt?: string;
  updatedAt?: string;
  orderItems?: GelatoOrderItem[];
  recipient?: {
    firstName?: string;
    lastName?: string;
    city?: string;
    state?: string;
    country?: string;
    email?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    postCode?: string;
  };
}

interface GelatoWebhookPayload {
  id: string;
  event: string;
  orderId: string;
  orderReferenceId: string;
  fulfillmentStatus?: string;
  comment?: string;
  itemReferenceId?: string;
  items?: Array<{
    itemReferenceId?: string;
    fulfillmentStatus?: string;
    fulfillments?: unknown[];
  }>;
}

function asIso(value: string | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

export function normalizeGelatoOrder(payload: GelatoOrderPayload): NormalizedOrder {
  const customerName = [payload.recipient?.firstName, payload.recipient?.lastName]
    .filter(Boolean)
    .join(" ");
  const status = payload.fulfillmentStatus ?? payload.productionStatus ?? "created";

  return {
    provider: "gelato",
    externalOrderId: payload.id ?? payload.orderReferenceId,
    referenceOrderId: payload.orderReferenceId,
    shopId: null,
    status,
    createdAt: asIso(payload.createdAt),
    updatedAt: asIso(payload.updatedAt),
    customer: {
      name: customerName || null,
      city: payload.recipient?.city ?? null,
      region: payload.recipient?.state ?? null,
      country: payload.recipient?.country ?? null,
      email: payload.recipient?.email ?? null,
      phone: payload.recipient?.phone ?? null,
      address1: payload.recipient?.addressLine1 ?? null,
      address2: payload.recipient?.addressLine2 ?? null,
      postalCode: payload.recipient?.postCode ?? null
    },
    items:
      payload.orderItems?.map((item) => ({
        externalItemId: item.itemReferenceId ?? null,
        sku: null,
        title: item.itemReferenceId ?? "Gelato item",
        quantity: 1,
        status: item.status ?? item.fulfillmentStatus ?? status
      })) ?? [],
    trackingLinks:
      payload.orderItems?.flatMap((item) =>
        (item.trackingCode ?? [])
          .filter((tracking) => Boolean(tracking.trackingCode))
          .map((tracking) => ({
            carrier: null,
            trackingNumber: tracking.trackingCode ?? "",
            trackingUrl: tracking.trackingUrl ?? null
          }))
      ) ?? [],
    providerUrl: null,
    etaMinAt: null,
    etaMaxAt: null,
    raw: payload
  };
}

export function normalizeGelatoWebhook(payload: GelatoWebhookPayload): NormalizedOrderEvent {
  return {
    provider: "gelato",
    eventId: payload.id,
    orderId: payload.orderId,
    referenceOrderId: payload.orderReferenceId,
    status: payload.fulfillmentStatus ?? "created",
    occurredAt: null,
    comment: payload.comment ?? null,
    raw: payload
  };
}

export class GelatoClient {
  constructor(
    private readonly apiKey: string,
    private readonly storeId: string,
    private readonly baseUrl = "https://api.gelato.com"
  ) {}

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        "X-API-KEY": this.apiKey,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Gelato request failed: ${response.status}`);
    }

    return (await response.json()) as T;
  }

  async getOrder(orderId: string): Promise<NormalizedOrder> {
    const payload = await this.request<GelatoOrderPayload>(`/v4/orders/${orderId}`);
    const normalized = normalizeGelatoOrder(payload);
    return {
      ...normalized,
      shopId: normalized.shopId ?? this.storeId
    };
  }

  async getOrderStatus(orderReferenceId: string): Promise<NormalizedOrder> {
    const payload = await this.request<GelatoOrderPayload>(
      `/v2/order/status/${orderReferenceId}`
    );
    const normalized = normalizeGelatoOrder(payload);
    return {
      ...normalized,
      shopId: normalized.shopId ?? this.storeId
    };
  }
}
