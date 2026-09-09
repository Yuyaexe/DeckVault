import type { AnimeCharacterCard, DemoOwnedCard } from "@/lib/demo/types";

export function animeCharacterCardToOwned(entry: AnimeCharacterCard): DemoOwnedCard {
  return {
    id: entry.id,
    collectionId: entry.characterId,
    cardId: entry.card.id,
    card: entry.card,
    quantity: entry.quantity,
    condition: entry.condition,
    language: entry.language,
    isFoil: entry.isFoil,
    purchasePrice: null,
    notes: null,
    tagIds: [],
  };
}

export type OwnedCardUpdates = Partial<Omit<DemoOwnedCard, "card">> & {
  card?: Partial<DemoOwnedCard["card"]>;
};

export function ownedUpdatesToAnimeCharacter(
  updates: OwnedCardUpdates
): Partial<Omit<AnimeCharacterCard, "card">> & { card?: Partial<AnimeCharacterCard["card"]> } {
  const { card, ...rest } = updates;
  return card ? { ...rest, card } : rest;
}
