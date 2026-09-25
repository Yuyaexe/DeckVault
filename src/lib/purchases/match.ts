import { resolveStoredBlueprintId } from "@/lib/cardtrader/catalog";
import type {
  PurchasedCard,
  PurchasedCardIndex,
  PurchaseMatchInput,
} from "@/lib/purchases/types";

export function normalizePurchaseName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const purchasedCardIndexCache = new WeakMap<PurchasedCard[], PurchasedCardIndex>();

export function buildPurchasedCardIndex(cards: PurchasedCard[]): PurchasedCardIndex {
  const names = new Set<string>();
  const blueprintIds = new Set<number>();

  for (const card of cards) {
    const validStates =
      card.source === "order"
        ? ["paid", "sent", "arrived", "done", "hub_pending", "presale"]
        : ["pending", "ok", "arrived"];
    const quantity = card.validQuantity ?? card.quantity;
    if (
      !validStates.includes(card.status.toLowerCase()) ||
      !Number.isFinite(card.quantity) ||
      card.quantity <= 0 ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      continue;
    }

    const name = normalizePurchaseName(card.name);
    if (name) names.add(name);

    const hasBlueprint = card.blueprintId != null && card.blueprintId > 0;
    if (hasBlueprint && card.blueprintId != null) {
      blueprintIds.add(card.blueprintId);
    }
  }

  return { names, blueprintIds };
}

export function getPurchasedCardIndex(cards: PurchasedCard[]): PurchasedCardIndex {
  const cached = purchasedCardIndexCache.get(cards);
  if (cached) return cached;

  const index = buildPurchasedCardIndex(cards);
  purchasedCardIndexCache.set(cards, index);
  return index;
}

export const EMPTY_PURCHASED_INDEX: PurchasedCardIndex = {
  names: new Set(),
  blueprintIds: new Set(),
};

export function isCardPurchased(
  card: PurchaseMatchInput,
  index: PurchasedCardIndex
): boolean {
  const blueprintId = resolveStoredBlueprintId(
    card.externalId,
    card.imageUrl,
    card.cardTraderBlueprintId,
    card.gameSlug
  );
  if (blueprintId != null && index.blueprintIds.has(blueprintId)) return true;

  const name = normalizePurchaseName(card.name);
  return !!name && index.names.has(name);
}
