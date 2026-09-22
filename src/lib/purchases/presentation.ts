import type { PurchasedCard } from "./types";

export interface PurchaseGroup {
  id: string;
  source: PurchasedCard["source"];
  status: string;
  orderLabel: string | null;
  cards: PurchasedCard[];
  quantity: number;
}

export function normalizePurchaseStatus(status: string): string {
  return status.toLowerCase().replace("cancelled", "canceled");
}

/** Display groups only: splitting a mixed CT Zero item must never change purchase coverage. */
export function groupPurchases(cards: PurchasedCard[]): PurchaseGroup[] {
  const groups = new Map<string, PurchaseGroup>();
  function add(card: PurchasedCard, status: string, quantity: number) {
    const orderLabel = card.orderCode ?? (card.orderId != null ? String(card.orderId) : null);
    const id = card.source === "cardtrader-zero" ? `ct0:${status}`
      : `order:${card.orderId ?? card.orderCode ?? card.id}:${status}`;
    let group = groups.get(id);
    if (!group) {
      group = { id, source: card.source, status, orderLabel, cards: [], quantity: 0 };
      groups.set(id, group);
    }
    group.cards.push({ ...card, quantity });
    group.quantity += quantity;
  }
  for (const card of cards) {
    const status = normalizePurchaseStatus(card.status);
    if (card.source === "cardtrader-zero" && card.zeroQuantities && status !== "canceled") {
      for (const bucket of ["arrived", "pending", "missing"] as const) {
        const quantity = card.zeroQuantities[bucket];
        if (quantity > 0) add(card, bucket, quantity);
      }
    } else {
      add(card, status, card.quantity);
    }
  }
  return [...groups.values()];
}

export function searchPurchaseGroups(groups: PurchaseGroup[], query: string): PurchaseGroup[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return groups;
  return groups.flatMap(group => {
    const matchesOrder = group.orderLabel?.toLocaleLowerCase().includes(normalized);
    const cards = matchesOrder ? group.cards : group.cards.filter(card =>
      `${card.name} ${card.expansion ?? ""}`.toLocaleLowerCase().includes(normalized));
    return cards.length ? [{ ...group, cards, quantity: cards.reduce((sum, card) => sum + card.quantity, 0) }] : [];
  });
}
