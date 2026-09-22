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

export function buildPurchasedCardIndex(cards: PurchasedCard[]): PurchasedCardIndex {
  const names = new Set<string>();
  const namesWithoutSet = new Set<string>();
  const namesWithoutSetOrBlueprint = new Set<string>();
  const namesWithoutBlueprint = new Set<string>();
  const blueprintIds = new Set<number>();
  const nameAndSet = new Set<string>();
  const nameAndSetWithoutBlueprint = new Set<string>();

  for (const card of cards) {
    const validStates = card.source === "order"
      ? ["paid", "sent", "arrived", "done", "hub_pending", "presale"]
      : ["pending", "ok", "arrived"];
    const quantity = card.validQuantity ?? card.quantity;
    if (!validStates.includes(card.status.toLowerCase()) ||
        !Number.isFinite(card.quantity) || card.quantity <= 0 ||
        !Number.isFinite(quantity) || quantity <= 0) continue;
    const name = normalizePurchaseName(card.name);
    if (name) names.add(name);
    const hasBlueprint = card.blueprintId != null && card.blueprintId > 0;
    if (hasBlueprint && card.blueprintId != null) {
      blueprintIds.add(card.blueprintId);
    }
    if (name && !hasBlueprint) namesWithoutBlueprint.add(name);
    const set = normalizePurchaseName(card.expansion ?? "");
    if (name && set) {
      const key = `${name}|${set}`;
      nameAndSet.add(key);
      if (!hasBlueprint) nameAndSetWithoutBlueprint.add(key);
    } else if (name) {
      namesWithoutSet.add(name);
      if (!hasBlueprint) namesWithoutSetOrBlueprint.add(name);
    }
  }

  return { names, namesWithoutSet, namesWithoutSetOrBlueprint, namesWithoutBlueprint, blueprintIds, nameAndSet, nameAndSetWithoutBlueprint };
}

export const EMPTY_PURCHASED_INDEX: PurchasedCardIndex = {
  names: new Set(),
  namesWithoutSet: new Set(),
  namesWithoutSetOrBlueprint: new Set(),
  namesWithoutBlueprint: new Set(),
  blueprintIds: new Set(),
  nameAndSet: new Set(),
  nameAndSetWithoutBlueprint: new Set(),
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
  if (!name) return false;
  const set = normalizePurchaseName(card.setName ?? "");
  if (blueprintId != null) {
    if (!index.namesWithoutBlueprint.has(name)) return false;
    return set
      ? index.nameAndSetWithoutBlueprint.has(`${name}|${set}`) || index.namesWithoutSetOrBlueprint.has(name)
      : true;
  }
  return set
    ? index.nameAndSet.has(`${name}|${set}`) || index.namesWithoutSet.has(name)
    : index.names.has(name);
}
