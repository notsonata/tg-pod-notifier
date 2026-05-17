export type ProviderName = "gelato" | "printify";

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
  sentToProductionAt: string | null;
  totalCost: {
    amount: number;
    currency: string;
  } | null;
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

export interface BotSettings {
  telegramChatId: string;
  printifyShopId: string | null;
  printifyShopName: string | null;
  timezone: string;
  digestEnabled: boolean;
  lastDigestSentAt: string | null;
}
