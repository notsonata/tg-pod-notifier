import type { NormalizedOrder } from "../domain/types.js";

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
  storeId?: string | null;
  currency?: string;
  totalInclVat?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
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

function asIso(value: string | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

function asOptionalString(value: string | null | undefined): string | null {
  return value === null || value === undefined || value === "" ? null : value;
}

export function normalizeGelatoOrder(payload: GelatoOrderPayload): NormalizedOrder {
  const customerName = [payload.recipient?.firstName, payload.recipient?.lastName]
    .filter(Boolean)
    .join(" ");
  const status = payload.fulfillmentStatus ?? payload.productionStatus ?? "created";
  const totalInclVat = payload.totalInclVat ? Number(payload.totalInclVat) : NaN;

  return {
    provider: "gelato",
    externalOrderId: payload.id ?? payload.orderReferenceId,
    displayOrderId: asOptionalString(payload.orderReferenceId) ?? asOptionalString(payload.id),
    referenceOrderId: payload.orderReferenceId,
    shopId: payload.storeId ?? null,
    status,
    sentToProductionAt: null,
    totalCost:
      Number.isFinite(totalInclVat) && payload.currency
        ? {
            amount: Math.round(totalInclVat * 100),
            currency: payload.currency
          }
        : null,
    createdAt: asIso(payload.createdAt),
    updatedAt: asIso(payload.updatedAt),
    customer: {
      name: customerName || [payload.firstName, payload.lastName].filter(Boolean).join(" ") || null,
      city: payload.recipient?.city ?? null,
      region: payload.recipient?.state ?? null,
      country: payload.recipient?.country ?? payload.country ?? null,
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

export class GelatoClient {
  constructor(
    private readonly apiKey: string,
    private readonly storeId: string,
    private readonly baseUrl = "https://order.gelatoapis.com"
  ) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "X-API-KEY": this.apiKey,
        "Content-Type": "application/json",
        ...init.headers
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

  async listOrders(): Promise<NormalizedOrder[]> {
    const payload = await this.request<{ orders?: GelatoOrderPayload[] }>("/v4/orders:search", {
      method: "POST",
      body: JSON.stringify({
        orderTypes: ["order"],
        storeIds: [this.storeId],
        limit: 100
      })
    });

    return Promise.all(
      (payload.orders ?? []).map(async (order) => {
        const normalized = normalizeGelatoOrder(order);
        const detailLookupId = normalized.externalOrderId;

        try {
          return await this.getOrder(detailLookupId);
        } catch {
          return {
            ...normalized,
            shopId: order.storeId ?? this.storeId
          };
        }
      })
    );
  }
}
