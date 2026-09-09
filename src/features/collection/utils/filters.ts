import type { DemoOwnedCard } from "@/lib/demo/types";
import type { CollectionFilters } from "@/types/tcg";

function matchesCollectionFilters(
  oc: DemoOwnedCard,
  filters: CollectionFilters
): boolean {
  const { card } = oc;
  const search = filters.search.toLowerCase();

  if (search) {
    const haystack = [card.name, card.setName, card.setCode, card.collectorNumber]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(search)) return false;
  }

  if (filters.gameId && card.gameId !== filters.gameId) return false;
  if (filters.setCode && card.setCode !== filters.setCode) return false;
  if (filters.rarity && card.rarity !== filters.rarity) return false;
  if (filters.language && oc.language !== filters.language) return false;
  if (filters.condition && oc.condition !== filters.condition) return false;
  if (filters.isFoil !== null && oc.isFoil !== filters.isFoil) return false;
  if (filters.minQuantity !== null && oc.quantity < filters.minQuantity) return false;

  return true;
}

/** Filter cards already scoped to one collection — avoids scanning every collection. */
export function applyCollectionFilters(
  cards: DemoOwnedCard[],
  filters: CollectionFilters
): DemoOwnedCard[] {
  return cards.filter((oc) => matchesCollectionFilters(oc, filters));
}


export function sortOwnedCards(
  cards: DemoOwnedCard[],
  field: string,
  dir: "asc" | "desc"
): DemoOwnedCard[] {
  const sorted = [...cards].sort((a, b) => {
    let av: string | number | null = null;
    let bv: string | number | null = null;

    switch (field) {
      case "name":
        av = a.card.name;
        bv = b.card.name;
        break;
      case "quantity":
        av = a.quantity;
        bv = b.quantity;
        break;
      case "set":
        av = a.card.setCode ?? a.card.setName ?? "";
        bv = b.card.setCode ?? b.card.setName ?? "";
        break;
      case "rarity":
        av = a.card.rarity ?? "";
        bv = b.card.rarity ?? "";
        break;
      default:
        av = a.card.name;
        bv = b.card.name;
    }

    if (typeof av === "string" && typeof bv === "string") {
      return av.localeCompare(bv);
    }
    return (av as number) - (bv as number);
  });

  return dir === "desc" ? sorted.reverse() : sorted;
}
