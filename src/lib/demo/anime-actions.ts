import type { AnimeCharacter, AnimeSeries } from "@/features/anime-collection/types";
import { slugifyAnimeName } from "@/features/anime-collection/utils/slugify-anime-name";
import { ANIME_ACTIVITY_COLLECTION_ID } from "@/lib/activity/types";
import { reorderIds, reorderIdsToIndex } from "@/lib/collections/card-order";
import {
  mergeBinderLayout,
  moveCardToBinderSlot,
  moveCardsToBinderSlotBatch,
  moveCardsToBinderSpread,
  removeIdsFromBinderLayout,
} from "@/lib/collections/binder-layout";
import {
  animeCardSyncKey,
  animeSeriesSyncKey,
  clearTombstone,
  upsertTombstone,
} from "@/lib/data/anime-share-merge";
import {
  classifyYugiohDeckCategory,
  deckCategorySortRank,
  yugiohTypeFromSearchMetadata,
} from "@/lib/yugioh/deck-category";
import type { AnimeCharacterCard, DemoCard } from "./types";
import type { DemoStore, StoreGet, StoreSet } from "./store-types";
import { cardTraderBlueprintFromSearch } from "./repair-card";
import {
  characterCardIds,
  characterTombstoneKey,
  generateId,
  makeDemoActivity,
  resolveAnimeBinderLayout,
  snapshotAnimeCard,
  tombstonesAfterRemovingCards,
  tombstonesAfterTouchingCard,
  withSyncedAnimeBinderOrder,
} from "./store-helpers";

export type AnimeActions = Pick<DemoStore,
  | "addAnimeSeries" | "renameAnimeSeries" | "updateAnimeSeriesCover"
  | "deleteAnimeSeries" | "addAnimeCharacter" | "addAnimeCharactersBatch"
  | "renameAnimeCharacter" | "updateAnimeCharacterImage" | "deleteAnimeCharacter"
  | "addAnimeCharacterCardFromSearch" | "removeAnimeCharacterCard"
  | "updateAnimeCharacterCardQuantity" | "setAnimeCharacterCardsQuantityToOne"
  | "sortAnimeCharacterCards" | "updateAnimeCharacterCardSetName"
  | "updateAnimeCharacterCard" | "patchAnimeCharacterCardTypes"
  | "reorderAnimeCharacterCard" | "reorderAnimeCharacterCardToIndex"
  | "moveAnimeCharacterCardToBinderSlot" | "moveAnimeCharacterCardsToBinderSlot"
  | "moveAnimeCharacterCardsToBinderSpread" | "transferAnimeCharacterCards"
>;

export function createAnimeActions(set: StoreSet, get: StoreGet): AnimeActions {
  return {
addAnimeSeries: (input) => {
  const name = input.name.trim();
  const baseSlug = slugifyAnimeName(name) || "series";
  const state = get();
  let slug = baseSlug;
  let n = 1;
  while (state.animeSeries.some((s) => s.slug === slug)) {
    slug = `${baseSlug}-${n++}`;
  }
  const newSeries: AnimeSeries = {
    id: generateId(),
    name,
    slug,
    coverImageUrl: input.coverImageUrl ?? null,
    coverColor: input.coverColor ?? null,
    isSeeded: false,
    sortOrder: state.animeSeries.length,
  };
  set((s) => ({
    animeSeries: [...s.animeSeries, newSeries],
    animeSeriesTombstones: clearTombstone(
      s.animeSeriesTombstones ?? [],
      animeSeriesSyncKey(newSeries)
    ),
  }));
  return newSeries;
},

renameAnimeSeries: (id, name) => {
  const trimmed = name.trim();
  if (!trimmed) return;
  set((s) => ({
    animeSeries: s.animeSeries.map((series) =>
      series.id === id ? { ...series, name: trimmed } : series
    ),
  }));
},

updateAnimeSeriesCover: (id, coverImageUrl) => {
  set((s) => ({
    animeSeries: s.animeSeries.map((series) =>
      series.id === id ? { ...series, coverImageUrl } : series
    ),
  }));
},

deleteAnimeSeries: (id) => {
  set((s) => {
    const removedSeries = s.animeSeries.find((series) => series.id === id);
    const characters = s.animeCharacters.filter((c) => c.seriesId === id);
    const characterIds = characters.map((c) => c.id);
    const removedCards = s.animeCharacterCards.filter((card) =>
      characterIds.includes(card.characterId)
    );
    let charTombs = s.animeCharacterTombstones ?? [];
    for (const character of characters) {
      charTombs = upsertTombstone(charTombs, characterTombstoneKey(s, character));
    }
    const seriesTombs = removedSeries
      ? upsertTombstone(s.animeSeriesTombstones ?? [], animeSeriesSyncKey(removedSeries))
      : s.animeSeriesTombstones ?? [];
    return {
      animeSeries: s.animeSeries.filter((series) => series.id !== id),
      animeCharacters: s.animeCharacters.filter((c) => c.seriesId !== id),
      animeCharacterCards: s.animeCharacterCards.filter(
        (card) => !characterIds.includes(card.characterId)
      ),
      animeCardTombstones: tombstonesAfterRemovingCards(s, removedCards),
      animeCharacterTombstones: charTombs,
      animeSeriesTombstones: seriesTombs,
    };
  });
},

addAnimeCharacter: (input) => {
  const name = input.name.trim();
  const state = get();
  const newCharacter: AnimeCharacter = {
    id: generateId(),
    seriesId: input.seriesId,
    name,
    imageUrl: input.imageUrl ?? null,
    accentColor: input.accentColor ?? null,
    isSeeded: false,
    sortOrder: state.animeCharacters.filter((c) => c.seriesId === input.seriesId)
      .length,
  };
  set((s) => ({
    animeCharacters: [...s.animeCharacters, newCharacter],
    animeCharacterTombstones: clearTombstone(
      s.animeCharacterTombstones ?? [],
      characterTombstoneKey({ ...s, animeCharacters: [...s.animeCharacters, newCharacter] }, newCharacter)
    ),
  }));
  return newCharacter;
},

addAnimeCharactersBatch: (input) => {
  const names = input.names.map((name) => name.trim()).filter(Boolean);
  if (names.length === 0) return [];

  const state = get();
  const baseOrder = state.animeCharacters.filter((c) => c.seriesId === input.seriesId)
    .length;

  const newCharacters: AnimeCharacter[] = names.map((name, index) => ({
    id: generateId(),
    seriesId: input.seriesId,
    name,
    imageUrl: null,
    accentColor: null,
    isSeeded: false,
    sortOrder: baseOrder + index,
  }));

  set((s) => {
    let tombs = s.animeCharacterTombstones ?? [];
    const nextChars = [...s.animeCharacters, ...newCharacters];
    const nextState = { ...s, animeCharacters: nextChars };
    for (const character of newCharacters) {
      tombs = clearTombstone(tombs, characterTombstoneKey(nextState, character));
    }
    return {
      animeCharacters: nextChars,
      animeCharacterTombstones: tombs,
    };
  });

  return newCharacters;
},

renameAnimeCharacter: (id, name) => {
  const trimmed = name.trim();
  if (!trimmed) return;
  set((s) => ({
    animeCharacters: s.animeCharacters.map((c) =>
      c.id === id ? { ...c, name: trimmed } : c
    ),
  }));
},

updateAnimeCharacterImage: (id, imageUrl) => {
  set((s) => ({
    animeCharacters: s.animeCharacters.map((c) =>
      c.id === id ? { ...c, imageUrl } : c
    ),
  }));
},

deleteAnimeCharacter: (id) => {
  set((s) => {
    const { [id]: _removed, ...animeBinderLayoutByCharacter } =
      s.animeBinderLayoutByCharacter ?? {};
    const removed = s.animeCharacters.find((c) => c.id === id);
    const removedCards = s.animeCharacterCards.filter((c) => c.characterId === id);
    const charTombs = removed
      ? upsertTombstone(
          s.animeCharacterTombstones ?? [],
          characterTombstoneKey(s, removed)
        )
      : s.animeCharacterTombstones ?? [];
    return {
      animeCharacters: s.animeCharacters.filter((c) => c.id !== id),
      animeCharacterCards: s.animeCharacterCards.filter((c) => c.characterId !== id),
      animeBinderLayoutByCharacter,
      animeCardTombstones: tombstonesAfterRemovingCards(s, removedCards),
      animeCharacterTombstones: charTombs,
    };
  });
},

addAnimeCharacterCardFromSearch: (
  characterId,
  result,
  gameId,
  gameSlug,
  gameName,
  quantity = 1
) => {
  const addQty = Math.max(1, Math.floor(quantity));
  const state = get();
  const actor = state.profile.displayName;
  const characterName =
    state.animeCharacters.find((c) => c.id === characterId)?.name ?? null;
  const existing = state.animeCharacterCards.find(
    (entry) =>
      entry.characterId === characterId &&
      entry.card.externalId === result.externalId &&
      entry.card.gameSlug === gameSlug
  );

  if (existing) {
    const before = snapshotAnimeCard(existing, characterName ?? undefined);
    set((s) => {
      const animeCharacterCards = s.animeCharacterCards.map((entry) =>
        entry.id === existing.id
          ? {
              ...entry,
              quantity: entry.quantity + addQty,
              card: {
                ...entry.card,
                marketPrice: result.price ?? entry.card.marketPrice,
                imageUrl: result.imageUrl ?? entry.card.imageUrl,
                rarity: result.rarity ?? entry.card.rarity,
                setName: result.setName ?? entry.card.setName,
                type:
                  yugiohTypeFromSearchMetadata(result.metadata) ??
                  entry.card.type ??
                  null,
                cardTraderBlueprintId:
                  cardTraderBlueprintFromSearch(
                    result.externalId,
                    result.imageUrl,
                    result.metadata?.catalogSource as string | undefined,
                    gameSlug,
                    result.metadata
                  ) ?? entry.card.cardTraderBlueprintId,
              },
            }
          : entry
      );
      const updated = animeCharacterCards.find((e) => e.id === existing.id)!;
      const touched = {
        ...updated,
        lastTouchedAt: new Date().toISOString(),
      };
      return {
        animeCharacterCards: animeCharacterCards.map((entry) =>
          entry.id === existing.id ? touched : entry
        ),
        animeCardTombstones: tombstonesAfterTouchingCard(s, touched),
        activityEvents: [
          makeDemoActivity(
            {
              collectionId: ANIME_ACTIVITY_COLLECTION_ID,
              action: "card_updated",
              ownedCardId: existing.id,
              cardName: existing.card.name,
              beforeState: before,
              afterState: snapshotAnimeCard(touched, characterName ?? undefined),
              meta: { source: "anime", characterId, characterName },
            },
            actor
          ),
          ...(s.activityEvents ?? []),
        ],
      };
    });
    return;
  }

  const cardId = generateId();
  const card: DemoCard = {
    id: cardId,
    gameId,
    gameSlug,
    gameName,
    externalId: result.externalId,
    name: result.name,
    setCode: result.setCode,
    setName: result.setName,
    collectorNumber: result.collectorNumber,
    rarity: result.rarity,
    imageUrl: result.imageUrl,
    marketPrice: result.price,
    type: yugiohTypeFromSearchMetadata(result.metadata),
    cardTraderBlueprintId: cardTraderBlueprintFromSearch(
      result.externalId,
      result.imageUrl,
      result.metadata?.catalogSource as string | undefined,
      gameSlug,
      result.metadata
    ),
  };
  const entry: AnimeCharacterCard = {
    id: generateId(),
    characterId,
    card,
    quantity: addQty,
    condition: "NM",
    language: "EN",
    isFoil: false,
    sortOrder: state.animeCharacterCards.filter((c) => c.characterId === characterId)
      .length,
    lastTouchedAt: new Date().toISOString(),
  };
  const layout = [...resolveAnimeBinderLayout(state, characterId), entry.id];
  const nextCards = [...state.animeCharacterCards, entry];
  set((s) => ({
    ...withSyncedAnimeBinderOrder(
      { ...s, animeCharacterCards: nextCards },
      characterId,
      layout
    ),
    animeCardTombstones: tombstonesAfterTouchingCard(s, entry),
    activityEvents: [
      makeDemoActivity(
        {
          collectionId: ANIME_ACTIVITY_COLLECTION_ID,
          action: "card_added",
          ownedCardId: entry.id,
          cardName: entry.card.name,
          beforeState: null,
          afterState: snapshotAnimeCard(entry, characterName ?? undefined),
          meta: { source: "anime", characterId, characterName },
        },
        actor
      ),
      ...(s.activityEvents ?? []),
    ],
  }));
},

removeAnimeCharacterCard: (id) => {
  set((s) => {
    const entry = s.animeCharacterCards.find((card) => card.id === id);
    const animeCharacterCards = s.animeCharacterCards.filter((card) => card.id !== id);
    if (!entry) return { animeCharacterCards };

    const characterName =
      s.animeCharacters.find((c) => c.id === entry.characterId)?.name ?? null;
    const nextState = { ...s, animeCharacterCards };
    const layout = resolveAnimeBinderLayout(nextState, entry.characterId);
    return {
      animeCharacterCards,
      animeBinderLayoutByCharacter: {
        ...(s.animeBinderLayoutByCharacter ?? {}),
        [entry.characterId]: layout,
      },
      animeCardTombstones: tombstonesAfterRemovingCards(s, [entry]),
      activityEvents: [
        makeDemoActivity(
          {
            collectionId: ANIME_ACTIVITY_COLLECTION_ID,
            action: "card_deleted",
            ownedCardId: entry.id,
            cardName: entry.card.name,
            beforeState: snapshotAnimeCard(entry, characterName ?? undefined),
            afterState: null,
            meta: {
              source: "anime",
              characterId: entry.characterId,
              characterName,
            },
          },
          s.profile.displayName
        ),
        ...(s.activityEvents ?? []),
      ],
    };
  });
},

updateAnimeCharacterCardQuantity: (id, quantity) => {
  if (quantity < 1) {
    get().removeAnimeCharacterCard(id);
    return;
  }
  set((s) => {
    const beforeEntry = s.animeCharacterCards.find((e) => e.id === id);
    if (!beforeEntry || beforeEntry.quantity === quantity) {
      return {
        animeCharacterCards: s.animeCharacterCards.map((entry) =>
          entry.id === id ? { ...entry, quantity } : entry
        ),
      };
    }
    const characterName =
      s.animeCharacters.find((c) => c.id === beforeEntry.characterId)?.name ?? null;
    const animeCharacterCards = s.animeCharacterCards.map((entry) =>
      entry.id === id
        ? { ...entry, quantity, lastTouchedAt: new Date().toISOString() }
        : entry
    );
    const afterEntry = animeCharacterCards.find((e) => e.id === id)!;
    return {
      animeCharacterCards,
      activityEvents: [
        makeDemoActivity(
          {
            collectionId: ANIME_ACTIVITY_COLLECTION_ID,
            action: "card_updated",
            ownedCardId: id,
            cardName: beforeEntry.card.name,
            beforeState: snapshotAnimeCard(beforeEntry, characterName ?? undefined),
            afterState: snapshotAnimeCard(afterEntry, characterName ?? undefined),
            meta: {
              source: "anime",
              characterId: beforeEntry.characterId,
              characterName,
            },
          },
          s.profile.displayName
        ),
        ...(s.activityEvents ?? []),
      ],
    };
  });
},

setAnimeCharacterCardsQuantityToOne: (characterId) => {
  const state = get();
  let changed = 0;
  const animeCharacterCards = state.animeCharacterCards.map((entry) => {
    if (entry.characterId !== characterId || entry.quantity === 1) return entry;
    changed++;
    return { ...entry, quantity: 1 };
  });
  if (changed > 0) set({ animeCharacterCards });
  return changed;
},

sortAnimeCharacterCards: (characterId, field, dir) => {
  const state = get();
  const cards = state.animeCharacterCards
    .filter((entry) => entry.characterId === characterId)
    .sort((a, b) => {
      if (field === "deck") {
        const ar = deckCategorySortRank(classifyYugiohDeckCategory(a.card.type));
        const br = deckCategorySortRank(classifyYugiohDeckCategory(b.card.type));
        if (ar !== br) return ar - br;
        return a.card.name.localeCompare(b.card.name);
      }
      let av: string | number = "";
      let bv: string | number = "";
      switch (field) {
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
        case "name":
        default:
          av = a.card.name;
          bv = b.card.name;
          break;
      }
      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv);
      }
      return (av as number) - (bv as number);
    });
  const ordered = dir === "desc" ? [...cards].reverse() : cards;
  const nextIds = ordered.map((entry) => entry.id);
  set((s) => ({
    ...withSyncedAnimeBinderOrder(s, characterId, nextIds),
  }));
},

updateAnimeCharacterCardSetName: (id, setName) => {
  const trimmed = setName?.trim() ?? "";
  set((s) => ({
    animeCharacterCards: s.animeCharacterCards.map((entry) =>
      entry.id === id
        ? { ...entry, card: { ...entry.card, setName: trimmed || null } }
        : entry
    ),
  }));
},

updateAnimeCharacterCard: (id, updates) => {
  set((s) => ({
    animeCharacterCards: s.animeCharacterCards.map((entry) => {
      if (entry.id !== id) return entry;
      const { card: cardUpdates, ...rest } = updates;
      const next: AnimeCharacterCard = {
        ...entry,
        ...rest,
        lastTouchedAt: new Date().toISOString(),
      };
      if (cardUpdates) {
        next.card = { ...entry.card, ...cardUpdates };
      }
      return next;
    }),
  }));
},

patchAnimeCharacterCardTypes: (updates) => {
  if (updates.length === 0) return;
  const byId = new Map(updates.map((row) => [row.id, row.type] as const));
  set((s) => ({
    animeCharacterCards: s.animeCharacterCards.map((entry) => {
      const type = byId.get(entry.id);
      if (!type || entry.card.type === type) return entry;
      return { ...entry, card: { ...entry.card, type } };
    }),
  }));
},

reorderAnimeCharacterCard: (characterId, draggedId, targetId) => {
  const state = get();
  const ids = characterCardIds(state, characterId);
  const nextIds = reorderIds(ids, draggedId, targetId);
  set((s) => ({
    ...withSyncedAnimeBinderOrder(s, characterId, nextIds),
  }));
},

reorderAnimeCharacterCardToIndex: (characterId, draggedId, targetIndex) => {
  const state = get();
  const ids = characterCardIds(state, characterId);
  const nextIds = reorderIdsToIndex(ids, draggedId, targetIndex);
  set((s) => ({
    ...withSyncedAnimeBinderOrder(s, characterId, nextIds),
  }));
},

moveAnimeCharacterCardToBinderSlot: (characterId, draggedId, targetIndex) => {
  const state = get();
  const layout = resolveAnimeBinderLayout(state, characterId);
  const next = moveCardToBinderSlot(layout, draggedId, targetIndex);
  set((s) => ({
    ...withSyncedAnimeBinderOrder(s, characterId, next),
  }));
},

moveAnimeCharacterCardsToBinderSlot: (characterId, cardIds, targetIndex) => {
  if (cardIds.length === 0) return;
  const state = get();
  const layout = resolveAnimeBinderLayout(state, characterId);
  const ordered = characterCardIds(state, characterId).filter((id) =>
    cardIds.includes(id)
  );
  const next = moveCardsToBinderSlotBatch(layout, ordered, targetIndex);
  set((s) => ({
    ...withSyncedAnimeBinderOrder(s, characterId, next),
  }));
},

moveAnimeCharacterCardsToBinderSpread: (
  characterId,
  cardIds,
  targetSpreadIndex,
  spreadSize
) => {
  if (cardIds.length === 0 || targetSpreadIndex < 0) return;
  const state = get();
  const layout = resolveAnimeBinderLayout(state, characterId);
  const ordered = characterCardIds(state, characterId).filter((id) =>
    cardIds.includes(id)
  );
  const next = moveCardsToBinderSpread(
    layout,
    ordered,
    targetSpreadIndex,
    spreadSize
  );
  set((s) => ({
    ...withSyncedAnimeBinderOrder(s, characterId, next),
  }));
},

transferAnimeCharacterCards: (fromCharacterId, toCharacterId, cardIds) => {
  if (fromCharacterId === toCharacterId || cardIds.length === 0) {
    return { moved: 0, merged: 0 };
  }

  const state = get();
  const idSet = new Set(cardIds);
  const toMove = state.animeCharacterCards
    .filter((c) => c.characterId === fromCharacterId && idSet.has(c.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (toMove.length === 0) return { moved: 0, merged: 0 };

  let cards = [...state.animeCharacterCards];
  let moved = 0;
  let merged = 0;
  const transferredIds: string[] = [];

  for (const source of toMove) {
    const duplicate = cards.find(
      (entry) =>
        entry.characterId === toCharacterId &&
        entry.card.externalId === source.card.externalId &&
        entry.card.gameSlug === source.card.gameSlug
    );

    if (duplicate) {
      cards = cards.map((entry) =>
        entry.id === duplicate.id
          ? { ...entry, quantity: entry.quantity + source.quantity }
          : entry
      );
      cards = cards.filter((entry) => entry.id !== source.id);
      merged++;
    } else {
      cards = cards.map((entry) =>
        entry.id === source.id
          ? { ...entry, characterId: toCharacterId }
          : entry
      );
      transferredIds.push(source.id);
      moved++;
    }
  }

  let animeCardTombstones = state.animeCardTombstones ?? [];
  const now = new Date().toISOString();
  for (const source of toMove) {
    // Leaving the source character slot is a removal for sync purposes.
    animeCardTombstones = upsertTombstone(
      animeCardTombstones,
      animeCardSyncKey(source),
      now
    );
    const destKey = animeCardSyncKey({
      characterId: toCharacterId,
      card: source.card,
    });
    animeCardTombstones = clearTombstone(animeCardTombstones, destKey);
  }

  const sourceLayout = removeIdsFromBinderLayout(
    mergeBinderLayout(
      state.animeBinderLayoutByCharacter?.[fromCharacterId] ??
        characterCardIds(state, fromCharacterId),
      cards
        .filter((c) => c.characterId === fromCharacterId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((c) => c.id)
    ),
    cardIds
  );

  const targetIds = cards
    .filter((c) => c.characterId === toCharacterId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => c.id);
  const targetSaved =
    state.animeBinderLayoutByCharacter?.[toCharacterId] ??
    targetIds.filter((id) => !transferredIds.includes(id));
  let targetLayout = mergeBinderLayout(targetSaved, targetIds);
  for (const id of transferredIds) {
    if (!targetLayout.includes(id)) {
      targetLayout = [...targetLayout, id];
    }
  }

  set((s) => {
    let mergedState = {
      ...s,
      animeCharacterCards: cards,
      animeCardTombstones,
    };
    const fromSynced = withSyncedAnimeBinderOrder(
      mergedState,
      fromCharacterId,
      sourceLayout
    );
    mergedState = { ...mergedState, ...fromSynced };
    const toSynced = withSyncedAnimeBinderOrder(
      mergedState,
      toCharacterId,
      targetLayout
    );
    return { ...mergedState, ...toSynced };
  });

  return { moved, merged };
},

  };
}
