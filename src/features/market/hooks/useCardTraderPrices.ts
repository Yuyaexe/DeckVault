import { resolveCardTraderProductUrl } from "@/lib/cardtrader";
import type { DemoOwnedCard } from "@/lib/demo/types";

function cardTraderUrlSearchParams(item: DemoOwnedCard): URLSearchParams {
  const { card } = item;
  const params = new URLSearchParams({ name: card.name });
  if (card.gameSlug) params.set("gameSlug", card.gameSlug);
  if (card.externalId) params.set("externalId", card.externalId);
  if (card.cardTraderBlueprintId) params.set("cardTraderBlueprintId", card.cardTraderBlueprintId);
  if (card.setName) params.set("setName", card.setName);
  if (card.setCode) params.set("setCode", card.setCode);
  if (card.rarity) params.set("rarity", card.rarity);
  if (card.imageUrl) params.set("imageUrl", card.imageUrl);
  return params;
}

/** Sync fallback — single blueprint id when known, otherwise slug search. */
export function resolveCardTraderUrl(item: DemoOwnedCard): string | null {
  const url = resolveCardTraderProductUrl({
    name: item.card.name,
    gameSlug: item.card.gameSlug,
    externalId: item.card.externalId,
    cardTraderBlueprintId: item.card.cardTraderBlueprintId,
    setName: item.card.setName,
    setCode: item.card.setCode,
    rarity: item.card.rarity,
    imageUrl: item.card.imageUrl,
  });
  return url || null;
}

/** Fetches manasearch URL with every printing via CardTrader blueprint metadata. */
export async function fetchCardTraderManaSearchUrl(item: DemoOwnedCard): Promise<string | null> {
  const fallback = resolveCardTraderUrl(item);
  try {
    const response = await fetch(`/api/market/cardtrader/url?${cardTraderUrlSearchParams(item)}`);
    if (!response.ok) return fallback;
    const data = (await response.json()) as { url?: string };
    return data.url ?? fallback;
  } catch {
    return fallback;
  }
}

export async function openCardTraderManaSearch(item: DemoOwnedCard): Promise<void> {
  const url = await fetchCardTraderManaSearchUrl(item);
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}
