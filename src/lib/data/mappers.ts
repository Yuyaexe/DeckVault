import type { InferSelectModel } from "drizzle-orm";
import type { cards, collections, games, ownedCards, profiles } from "@/lib/db/schema";
import type { DemoCard, DemoCollection, DemoOwnedCard, DemoProfile } from "@/lib/demo/types";
import type { CardCondition, CardLanguage, Currency } from "@/types/tcg";

type DbCard = InferSelectModel<typeof cards>;
type DbGame = InferSelectModel<typeof games>;
type DbOwnedCard = InferSelectModel<typeof ownedCards>;
type DbCollection = InferSelectModel<typeof collections>;
type DbProfile = InferSelectModel<typeof profiles>;

function cardMetadata(card: DbCard): { marketPrice?: number } {
  return (card.metadata as { marketPrice?: number } | null) ?? {};
}

export function toDemoCard(card: DbCard, game: DbGame): DemoCard {
  const meta = cardMetadata(card);
  return {
    id: card.id,
    gameId: card.gameId,
    gameSlug: game.slug,
    gameName: game.name,
    externalId: card.externalId,
    name: card.name,
    setCode: card.setCode,
    setName: card.setName,
    collectorNumber: card.collectorNumber,
    rarity: card.rarity,
    imageUrl: card.imageUrl,
    marketPrice: meta.marketPrice ?? null,
  };
}

export function toDemoOwnedCard(
  owned: DbOwnedCard,
  card: DbCard,
  game: DbGame
): DemoOwnedCard {
  return {
    id: owned.id,
    collectionId: owned.collectionId,
    cardId: owned.cardId,
    card: toDemoCard(card, game),
    quantity: owned.quantity,
    condition: owned.condition as CardCondition,
    language: owned.language as CardLanguage,
    isFoil: owned.isFoil,
    purchasePrice: owned.purchasePrice ? Number(owned.purchasePrice) : null,
    notes: owned.notes,
    tagIds: [],
  };
}

export function toDemoCollection(row: DbCollection): DemoCollection {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.isDefault,
    isFavorite: row.isFavorite,
    coverImageUrl: row.coverImageUrl,
  };
}

export function toDemoProfile(row: DbProfile): DemoProfile {
  return {
    displayName: row.displayName ?? "Collector",
    currency: row.currency as Currency,
    theme: row.theme,
    defaultGameId: row.defaultGameId,
  };
}

export function marketPriceMetadata(
  price: number | null | undefined,
  extra?: { priceSource?: string }
): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  if (price != null) meta.marketPrice = price;
  if (extra?.priceSource) meta.priceSource = extra.priceSource;
  return meta;
}
