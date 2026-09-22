import type { PurchasedCardsResponse } from "@/lib/purchases/types";

export async function fetchPurchasedCards(): Promise<PurchasedCardsResponse> {
  const response = await fetch("/api/market/cardtrader/purchases");
  const data = (await response.json()) as PurchasedCardsResponse & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Could not load purchases");
  }
  return {
    cards: data.cards ?? [],
    complete: data.complete === true,
    sources: data.sources ?? {
      orders: { status: "unavailable", lastSuccessAt: null },
      cardTraderZero: { status: "unavailable", lastSuccessAt: null },
    },
    cardTraderZeroSummary: data.cardTraderZeroSummary ?? {
      arrived: 0,
      pending: 0,
      missing: 0,
    },
  };
}
