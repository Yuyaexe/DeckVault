import type { AnimeCharacterCard, DemoActivityEvent, DemoState } from "./types";
import { ANIME_ACTIVITY_COLLECTION_ID, type OwnedCardSnapshot } from "@/lib/activity/types";
import { compactBinderLayout, mergeBinderLayout } from "@/lib/collections/binder-layout";
import {
  animeCardSyncKey,
  animeCharacterSyncKey,
  clearTombstone,
  upsertTombstone,
} from "@/lib/data/anime-share-merge";

export function characterTombstoneKey(state: DemoState, character: { seriesId: string; name: string }): string {
  const seriesById = new Map((state.animeSeries ?? []).map((s) => [s.id, s] as const));
  return animeCharacterSyncKey(character, seriesById);
}

export function characterCardIds(state: DemoState, characterId: string): string[] {
  return state.animeCharacterCards
    .filter((card) => card.characterId === characterId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((card) => card.id);
}

export function tombstonesAfterRemovingCards(
  state: DemoState,
  removed: AnimeCharacterCard[]
): DemoState["animeCardTombstones"] {
  let next = state.animeCardTombstones ?? [];
  const now = new Date().toISOString();
  for (const entry of removed) {
    next = upsertTombstone(next, animeCardSyncKey(entry), now);
  }
  return next;
}

export function tombstonesAfterTouchingCard(
  state: DemoState,
  entry: Pick<AnimeCharacterCard, "characterId" | "card">
): DemoState["animeCardTombstones"] {
  return clearTombstone(state.animeCardTombstones ?? [], animeCardSyncKey(entry));
}

export function resolveAnimeBinderLayout(
  state: DemoState,
  characterId: string
): (string | null)[] {
  const ids = characterCardIds(state, characterId);
  const saved = state.animeBinderLayoutByCharacter?.[characterId] ?? ids;
  return mergeBinderLayout(saved, ids);
}

export function withSyncedAnimeBinderOrder(
  state: DemoState,
  characterId: string,
  layout: (string | null)[]
): Pick<DemoState, "animeCharacterCards" | "animeBinderLayoutByCharacter"> {
  const orderMap = new Map(
    compactBinderLayout(layout).map((id, index) => [id, index] as const)
  );
  return {
    animeBinderLayoutByCharacter: {
      ...(state.animeBinderLayoutByCharacter ?? {}),
      [characterId]: layout,
    },
    animeCharacterCards: state.animeCharacterCards.map((entry) =>
      entry.characterId === characterId && orderMap.has(entry.id)
        ? { ...entry, sortOrder: orderMap.get(entry.id)! }
        : entry
    ),
  };
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function stripSeededAnime(state: DemoState): DemoState {
  const seededSeriesIds = new Set(
    (state.animeSeries ?? []).filter((series) => series.isSeeded).map((series) => series.id)
  );
  const animeSeries = (state.animeSeries ?? []).filter((series) => !series.isSeeded);
  const animeCharacters = (state.animeCharacters ?? []).filter(
    (character) => !character.isSeeded && !seededSeriesIds.has(character.seriesId)
  );
  const characterIds = new Set(animeCharacters.map((character) => character.id));
  const animeBinderLayoutByCharacter = Object.fromEntries(
    Object.entries(state.animeBinderLayoutByCharacter ?? {}).filter(([characterId]) =>
      characterIds.has(characterId)
    )
  );
  return {
    ...state,
    animeSeries,
    animeCharacters,
    animeCharacterCards: (state.animeCharacterCards ?? []).filter((entry) =>
      characterIds.has(entry.characterId)
    ),
    animeBinderLayoutByCharacter,
  };
}

export function makeDemoActivity(
  partial: {
    collectionId: string;
    action: string;
    ownedCardId: string | null;
    cardName: string | null;
    beforeState: unknown;
    afterState: unknown;
    actorDisplayName?: string;
    meta?: Record<string, unknown>;
  },
  displayName: string
): DemoActivityEvent {
  return {
    id: generateId(),
    collectionId: partial.collectionId,
    actorUserId: "demo-local",
    actorDisplayName: partial.actorDisplayName ?? displayName,
    action: partial.action,
    ownedCardId: partial.ownedCardId,
    cardName: partial.cardName,
    beforeState: partial.beforeState,
    afterState: partial.afterState,
    meta: partial.meta ?? {},
    createdAt: new Date().toISOString(),
    undoneAt: null,
    undoneBy: null,
  };
}

export function snapshotAnimeCard(
  entry: AnimeCharacterCard,
  characterName?: string
): OwnedCardSnapshot {
  return {
    id: entry.id,
    collectionId: ANIME_ACTIVITY_COLLECTION_ID,
    cardId: entry.card.id,
    quantity: entry.quantity,
    condition: entry.condition,
    language: entry.language,
    isFoil: entry.isFoil,
    purchasePrice: null,
    notes: characterName ? `anime:${characterName}` : null,
    cardName: entry.card.name,
    cardExternalId: entry.card.externalId,
    cardSetCode: entry.card.setCode,
    cardRarity: entry.card.rarity,
    cardImageUrl: entry.card.imageUrl,
  };
}
