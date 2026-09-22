export interface PurchasedCard {
  id: string;
  name: string;
  expansion: string | null;
  quantity: number;
  /** Units still covered by a purchase; excludes missing/refunded CT Zero units. */
  validQuantity?: number;
  priceCents: number | null;
  currency: string | null;
  status: string;
  seller: string | null;
  orderCode: string | null;
  orderId?: number | null;
  zeroQuantities?: { arrived: number; pending: number; missing: number };
  blueprintId: number | null;
  gameId: number | null;
  imageUrl: string | null;
  source: "order" | "cardtrader-zero";
}

export interface PurchasedCardsResponse {
  cards: PurchasedCard[];
  complete: boolean;
  sources: {
    orders: PurchaseSourceStatus;
    cardTraderZero: PurchaseSourceStatus;
  };
  cardTraderZeroSummary: {
    arrived: number;
    pending: number;
    missing: number;
  };
}

export interface PurchaseSourceStatus {
  status: "fresh" | "stale" | "unavailable";
  lastSuccessAt: string | null;
}

export function hasCompletePurchaseCoverage(data: PurchasedCardsResponse | undefined): boolean {
  return data?.complete === true && data.sources?.orders.status === "fresh" &&
    data.sources?.cardTraderZero.status === "fresh";
}

export interface PurchaseMatchInput {
  name: string;
  setName?: string | null;
  imageUrl?: string | null;
  externalId?: string | null;
  cardTraderBlueprintId?: string | null;
  gameSlug?: string | null;
}

export interface PurchasedCardIndex {
  names: Set<string>;
  namesWithoutSet: Set<string>;
  namesWithoutSetOrBlueprint: Set<string>;
  namesWithoutBlueprint: Set<string>;
  blueprintIds: Set<number>;
  nameAndSet: Set<string>;
  nameAndSetWithoutBlueprint: Set<string>;
}
