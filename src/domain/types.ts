export type ProviderName = "gelato" | "printify";

export type AlertSeverity = "warning" | "critical";

export interface TrackingLink {
  carrier: string | null;
  trackingNumber: string;
  trackingUrl: string | null;
}

export interface NormalizedOrderItem {
  externalItemId: string | null;
  sku: string | null;
  title: string;
  quantity: number;
  status: string;
}

export interface NormalizedCustomer {
  name: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  address1: string | null;
  address2: string | null;
  postalCode: string | null;
}

export interface NormalizedOrder {
  provider: ProviderName;
  externalOrderId: string;
  referenceOrderId: string | null;
  shopId: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  customer: NormalizedCustomer;
  items: NormalizedOrderItem[];
  trackingLinks: TrackingLink[];
  providerUrl: string | null;
  etaMinAt: string | null;
  etaMaxAt: string | null;
  raw: unknown;
}

export interface NormalizedOrderEvent {
  provider: ProviderName;
  eventId: string;
  orderId: string;
  referenceOrderId: string | null;
  status: string;
  occurredAt: string | null;
  comment: string | null;
  raw: unknown;
}

export interface AlertThresholds {
  nowIso: string;
  staleDays: number;
}

export interface AlertDecision {
  severity: AlertSeverity;
  reason: "stale-order" | "delayed-order";
  message: string;
}

export interface BotSettings {
  telegramChatId: string;
  printifyShopId: string | null;
  timezone: string;
  digestEnabled: boolean;
  digestHour: number;
  digestMinute: number;
  digestStatuses: string[];
  digestStuckOnly: boolean;
  piiName: boolean;
  piiEmail: boolean;
  piiPhone: boolean;
  piiAddress: boolean;
  thresholds: {
    staleDays: number;
  };
  lastDigestSentAt: string | null;
}
