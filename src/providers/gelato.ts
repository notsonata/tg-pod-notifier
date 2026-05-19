import type { NormalizedOrder } from "../domain/types.js";

interface GelatoTrackingCode {
  parcelNumber?: number;
  trackingCode?: string;
  trackingUrl?: string;
}

interface GelatoOrderItem {
  id?: string;
  itemReferenceId?: string;
  productName?: string;
  quantity?: number;
  status?: string;
  fulfillmentStatus?: string;
  trackingCode?: GelatoTrackingCode[];
  productionLog?: unknown[];
}

interface GelatoAddressPayload {
  firstName?: string;
  lastName?: string;
  name?: string;
  fullName?: string;
  city?: string;
  state?: string;
  country?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  postCode?: string;
}

interface GelatoOrderPayload {
  id?: string;
  orderReferenceId: string;
  fulfillmentStatus?: string;
  productionStatus?: string;
  orderType?: string;
  orderedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  storeId?: string | null;
  currency?: string;
  totalInclVat?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  orderItems?: GelatoOrderItem[];
  items?: GelatoOrderItem[];
  recipient?: GelatoAddressPayload;
  shippingAddress?: GelatoAddressPayload;
  shipment?: {
    packages?: Array<{
      trackingCode?: string;
      trackingUrl?: string;
    }>;
  };
  receipts?: Array<{
    currency?: string;
    totalInclVat?: number;
  }>;
}

function asIso(value: string | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

function asOptionalString(value: string | null | undefined): string | null {
  return value === null || value === undefined || value === "" ? null : value;
}

function joinedName(...values: Array<string | null | undefined>): string | null {
  const name = values.filter(Boolean).join(" ").trim();
  return name || null;
}

function customerName(payload: GelatoOrderPayload): string | null {
  const address = payload.shippingAddress ?? payload.recipient;
  return (
    asOptionalString(address?.fullName) ??
    asOptionalString(address?.name) ??
    joinedName(address?.firstName, address?.lastName) ??
    joinedName(payload.firstName, payload.lastName)
  );
}

function totalCost(payload: GelatoOrderPayload): NormalizedOrder["totalCost"] {
  const directTotal = payload.totalInclVat ? Number(payload.totalInclVat) : NaN;
  if (Number.isFinite(directTotal) && payload.currency) {
    return {
      amount: Math.round(directTotal * 100),
      currency: payload.currency
    };
  }

  const receipt = payload.receipts?.find(
    (candidate) => typeof candidate.totalInclVat === "number" && candidate.currency
  );
  if (receipt?.currency && typeof receipt.totalInclVat === "number") {
    return {
      amount: Math.round(receipt.totalInclVat * 100),
      currency: receipt.currency
    };
  }

  return null;
}

export function normalizeGelatoOrder(payload: GelatoOrderPayload): NormalizedOrder {
  const address = payload.shippingAddress ?? payload.recipient;
  const status = payload.fulfillmentStatus ?? payload.productionStatus ?? "created";
  const items = payload.items ?? payload.orderItems ?? [];

  return {
    provider: "gelato",
    externalOrderId: payload.id ?? payload.orderReferenceId,
    displayOrderId: asOptionalString(payload.orderReferenceId) ?? asOptionalString(payload.id),
    referenceOrderId: payload.orderReferenceId,
    shopId: payload.storeId ?? null,
    status,
    sentToProductionAt: null,
    orderReceivedAt: asIso(payload.orderedAt ?? payload.createdAt),
    totalCost: totalCost(payload),
    createdAt: asIso(payload.createdAt),
    updatedAt: asIso(payload.updatedAt),
    customer: {
      name: customerName(payload),
      city: address?.city ?? null,
      region: address?.state ?? null,
      country: address?.country ?? payload.country ?? null,
      email: address?.email ?? null,
      phone: address?.phone ?? null,
      address1: address?.addressLine1 ?? null,
      address2: address?.addressLine2 ?? null,
      postalCode: address?.postCode ?? null
    },
    items:
      items.map((item) => ({
        externalItemId: item.itemReferenceId ?? item.id ?? null,
        sku: null,
        title: item.productName ?? item.itemReferenceId ?? "Gelato item",
        quantity: item.quantity ?? 1,
        status: item.status ?? item.fulfillmentStatus ?? status
      })),
    trackingLinks:
      [
        ...items.flatMap((item) =>
          (item.trackingCode ?? [])
            .filter((tracking) => Boolean(tracking.trackingCode))
            .map((tracking) => ({
              carrier: null,
              trackingNumber: tracking.trackingCode ?? "",
              trackingUrl: tracking.trackingUrl ?? null
            }))
        ),
        ...(payload.shipment?.packages ?? [])
          .filter((tracking) => Boolean(tracking.trackingCode))
          .map((tracking) => ({
            carrier: null,
            trackingNumber: tracking.trackingCode ?? "",
            trackingUrl: tracking.trackingUrl ?? null
          }))
      ],
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
