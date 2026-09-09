import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

/** Avoid main-thread stalls: large collections stringify slowly on every edit. */
function createDebouncedLocalStorage(delayMs = 400): StateStorage {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const pending = new Map<string, string>();
  let unloadBound = false;

  const flushPending = () => {
    for (const [name, value] of pending) {
      localStorage.setItem(name, value);
    }
    pending.clear();
  };

  const bindUnload = () => {
    if (unloadBound || typeof window === "undefined") return;
    unloadBound = true;
    window.addEventListener("beforeunload", flushPending);
  };

  return {
    getItem: (name) => {
      if (typeof localStorage === "undefined") return null;
      return localStorage.getItem(name);
    },
    setItem: (name, value) => {
      if (typeof localStorage === "undefined") return;
      bindUnload();
      pending.set(name, value);
      const prev = timers.get(name);
      if (prev) clearTimeout(prev);
      timers.set(
        name,
        setTimeout(() => {
          timers.delete(name);
          pending.delete(name);
          localStorage.setItem(name, value);
        }, delayMs)
      );
    },
    removeItem: (name) => {
      if (typeof localStorage === "undefined") return;
      const prev = timers.get(name);
      if (prev) clearTimeout(prev);
      timers.delete(name);
      pending.delete(name);
      localStorage.removeItem(name);
    },
  };
}
import {
  createInitialDemoState,
  DEFAULT_COLLECTION_ID,
  type AnimeCharacterCard,
  type DemoActivityEvent,
  type DemoCard,
  type DemoCollection,
  type DemoOwnedCard,
  type DemoState,
} from "./types";
import { snapshotOwnedCard, ownedSnapshotsEqual, type OwnedCardSnapshot, ANIME_ACTIVITY_COLLECTION_ID } from "@/lib/activity/types";
import type { AnimeCharacter, AnimeSeries } from "@/features/anime-collection/types";
import type { CardCondition, CardLanguage } from "@/types/tcg";
import type { CardSearchResult } from "@/features/catalog/services/card-api/types";
import {
  resolveAnimeBackupFields,
  type DeckVaultBackup,
} from "@/features/import/services/backup-export";
import { reorderIds, reorderIdsToIndex } from "@/lib/collections/card-order";
import {
  compactBinderLayout,
  mergeBinderLayout,
  moveCardToBinderSlot,
  moveCardsToBinderSlotBatch,
  moveCardsToBinderSpread,
  removeIdsFromBinderLayout,
} from "@/lib/collections/binder-layout";
import { slugifyAnimeName } from "@/features/anime-collection/utils/slugify-anime-name";
import {
  classifyYugiohDeckCategory,
  deckCategorySortRank,
  yugiohTypeFromSearchMetadata,
} from "@/lib/yugioh/deck-category";
import {
  cardTraderBlueprintFromSearch,
  repairDemoCard,
} from "./repair-card";
import {
  animeCardSyncKey,
  animeCharacterSyncKey,
  animeSeriesSyncKey,
  clearTombstone,
  upsertTombstone,
} from "@/lib/data/anime-share-merge";

function characterTombstoneKey(state: DemoState, character: { seriesId: string; name: string }): string {
  const seriesById = new Map((state.animeSeries ?? []).map((s) => [s.id, s] as const));
  return animeCharacterSyncKey(character, seriesById);
}

function characterCardIds(state: DemoState, characterId: string): string[] {
  return state.animeCharacterCards
    .filter((card) => card.characterId === characterId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((card) => card.id);
}

function tombstonesAfterRemovingCards(
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

function tombstonesAfterTouchingCard(
  state: DemoState,
  entry: Pick<AnimeCharacterCard, "characterId" | "card">
): DemoState["animeCardTombstones"] {
  return clearTombstone(state.animeCardTombstones ?? [], animeCardSyncKey(entry));
}

function resolveAnimeBinderLayout(
  state: DemoState,
  characterId: string
): (string | null)[] {
  const ids = characterCardIds(state, characterId);
  const saved = state.animeBinderLayoutByCharacter?.[characterId] ?? ids;
  return mergeBinderLayout(saved, ids);
}

function withSyncedAnimeBinderOrder(
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

function generateId(): string {
  return crypto.randomUUID();
}

function stripSeededAnime(state: DemoState): DemoState {
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

function makeDemoActivity(
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

function snapshotAnimeCard(
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

interface DemoStore extends DemoState {
  activeCollectionId: string;
  setActiveCollection: (id: string) => void;
  undoActivityEvent: (eventId: string) => { ok: true } | { error: string; status: number };
  addCardFromSearch: (
    result: CardSearchResult,
    gameId: string,
    gameSlug: string,
    gameName: string,
    collectionId?: string
  ) => void;
  updateOwnedCard: (
    id: string,
    updates: Partial<Omit<DemoOwnedCard, "card">> & { card?: Partial<DemoCard> }
  ) => void;
  deleteOwnedCards: (ids: string[]) => void;
  importRows: (
    rows: Array<{
      name: string;
      set?: string;
      quantity: number;
      condition: CardCondition;
      language: CardLanguage;
      gameId: string;
      gameSlug: string;
      gameName: string;
      isFoil?: boolean;
      purchasePrice?: number;
    }>,
    mergeDuplicates: boolean
  ) => number;
  importFromSearchResults: (
    items: Array<{
      result: CardSearchResult;
      quantity: number;
      gameId: string;
      gameSlug: string;
      gameName: string;
    }>,
    mergeDuplicates: boolean
  ) => number;
  /** Undo accidental qty doubling (qty → floor(qty/2), min 1). */
  halveOwnedCardQuantities: (collectionId: string) => number;
  setOwnedCardQuantitiesToOne: (collectionId: string) => number;
  updateProfile: (updates: Partial<DemoState["profile"]>) => void;
  /** Record Activity rows for peer anime share diffs (add/remove). */
  recordAnimeShareRemoteDiff: (
    beforeCards: AnimeCharacterCard[],
    afterCards: AnimeCharacterCard[],
    actor: { displayName: string; userId?: string | null },
    characterNames?: Array<{ id: string; name: string }>
  ) => { added: number; removed: number };
  addCollection: (name: string) => DemoCollection;
  renameCollection: (id: string, name: string) => void;
  deleteCollection: (id: string) => void;
  toggleCollectionFavorite: (id: string) => void;
  restoreFromBackup: (backup: DeckVaultBackup) => void;
  /** Anime Collection lives in localStorage even in Supabase mode. */
  restoreAnimeCollectionFromBackup: (
    backup: Pick<
      DeckVaultBackup,
      "animeSeries" | "animeCharacters" | "animeCharacterCards"
    >
  ) => void;
  addAnimeSeries: (input: {
    name: string;
    coverImageUrl?: string | null;
    coverColor?: string | null;
  }) => AnimeSeries;
  renameAnimeSeries: (id: string, name: string) => void;
  updateAnimeSeriesCover: (id: string, coverImageUrl: string | null) => void;
  deleteAnimeSeries: (id: string) => void;
  addAnimeCharacter: (input: {
    seriesId: string;
    name: string;
    imageUrl?: string | null;
    accentColor?: string | null;
  }) => AnimeCharacter;
  addAnimeCharactersBatch: (input: {
    seriesId: string;
    names: string[];
  }) => AnimeCharacter[];
  renameAnimeCharacter: (id: string, name: string) => void;
  updateAnimeCharacterImage: (id: string, imageUrl: string | null) => void;
  deleteAnimeCharacter: (id: string) => void;
  addAnimeCharacterCardFromSearch: (
    characterId: string,
    result: CardSearchResult,
    gameId: string,
    gameSlug: string,
    gameName: string,
    quantity?: number
  ) => void;
  removeAnimeCharacterCard: (id: string) => void;
  updateAnimeCharacterCardQuantity: (id: string, quantity: number) => void;
  setAnimeCharacterCardsQuantityToOne: (characterId: string) => number;
  sortAnimeCharacterCards: (
    characterId: string,
    field: "name" | "quantity" | "set" | "rarity" | "deck",
    dir: "asc" | "desc"
  ) => void;
  updateAnimeCharacterCardSetName: (id: string, setName: string | null) => void;
  updateAnimeCharacterCard: (
    id: string,
    updates: Partial<Omit<AnimeCharacterCard, "card">> & { card?: Partial<DemoCard> }
  ) => void;
  patchAnimeCharacterCardTypes: (updates: Array<{ id: string; type: string }>) => void;
  reorderAnimeCharacterCard: (
    characterId: string,
    draggedId: string,
    targetId: string | null
  ) => void;
  reorderAnimeCharacterCardToIndex: (
    characterId: string,
    draggedId: string,
    targetIndex: number
  ) => void;
  moveAnimeCharacterCardToBinderSlot: (
    characterId: string,
    draggedId: string,
    targetIndex: number
  ) => void;
  moveAnimeCharacterCardsToBinderSlot: (
    characterId: string,
    cardIds: string[],
    targetIndex: number
  ) => void;
  moveAnimeCharacterCardsToBinderSpread: (
    characterId: string,
    cardIds: string[],
    targetSpreadIndex: number,
    spreadSize: number
  ) => void;
  transferAnimeCharacterCards: (
    fromCharacterId: string,
    toCharacterId: string,
    cardIds: string[]
  ) => { moved: number; merged: number };
}

export const useDemoStore = create<DemoStore>()(
  persist(
    (set, get) => ({
      ...createInitialDemoState(),
      activeCollectionId: DEFAULT_COLLECTION_ID,

      setActiveCollection: (id) => set({ activeCollectionId: id }),

      undoActivityEvent: (eventId) => {
        const state = get();
        const event = (state.activityEvents ?? []).find((e) => e.id === eventId);
        if (!event) return { error: "Activity event not found", status: 404 };
        if (event.undoneAt) return { error: "Event already undone", status: 400 };

        if (event.action === "card_added") {
          const after = event.afterState as OwnedCardSnapshot | null;
          if (!after) return { error: "This event cannot be undone", status: 400 };
          const current = state.ownedCards.find((oc) => oc.id === after.id);
          if (current && !ownedSnapshotsEqual(after, current)) {
            return { error: "Card was changed after this event", status: 409 };
          }
          set((s) => ({
            ownedCards: s.ownedCards.filter((oc) => oc.id !== after.id),
            activityEvents: [
              makeDemoActivity(
                {
                  collectionId: event.collectionId,
                  action: "undo",
                  ownedCardId: event.ownedCardId,
                  cardName: event.cardName,
                  beforeState: event.afterState,
                  afterState: event.beforeState,
                  meta: { undoneEventId: eventId, originalAction: event.action },
                },
                s.profile.displayName
              ),
              ...(s.activityEvents ?? []).map((e) =>
                e.id === eventId
                  ? { ...e, undoneAt: new Date().toISOString(), undoneBy: "demo-local" }
                  : e
              ),
            ],
          }));
          return { ok: true as const };
        }

        if (event.action === "card_updated") {
          const before = event.beforeState as OwnedCardSnapshot | null;
          const after = event.afterState as OwnedCardSnapshot | null;
          if (!before || !after) return { error: "This event cannot be undone", status: 400 };
          const current = state.ownedCards.find((oc) => oc.id === after.id);
          if (!current) return { error: "Card was changed after this event", status: 409 };
          if (!ownedSnapshotsEqual(after, current)) {
            return { error: "Card was changed after this event", status: 409 };
          }
          set((s) => ({
            ownedCards: s.ownedCards.map((oc) =>
              oc.id === before.id
                ? {
                    ...oc,
                    quantity: before.quantity,
                    condition: before.condition,
                    language: before.language,
                    isFoil: before.isFoil,
                    purchasePrice: before.purchasePrice,
                    notes: before.notes,
                  }
                : oc
            ),
            activityEvents: [
              makeDemoActivity(
                {
                  collectionId: event.collectionId,
                  action: "undo",
                  ownedCardId: event.ownedCardId,
                  cardName: event.cardName,
                  beforeState: event.afterState,
                  afterState: event.beforeState,
                  meta: { undoneEventId: eventId, originalAction: event.action },
                },
                s.profile.displayName
              ),
              ...(s.activityEvents ?? []).map((e) =>
                e.id === eventId
                  ? { ...e, undoneAt: new Date().toISOString(), undoneBy: "demo-local" }
                  : e
              ),
            ],
          }));
          return { ok: true as const };
        }

        if (event.action === "card_deleted") {
          const before = event.beforeState as OwnedCardSnapshot | null;
          if (!before) return { error: "This event cannot be undone", status: 400 };
          if (state.ownedCards.some((oc) => oc.id === before.id)) {
            return { error: "Card already exists again", status: 409 };
          }
          const card: DemoCard = {
            id: before.cardId,
            gameId: "",
            gameSlug: "yugioh",
            gameName: "Yu-Gi-Oh!",
            externalId: before.cardExternalId ?? null,
            name: before.cardName,
            setCode: before.cardSetCode ?? null,
            setName: null,
            collectorNumber: null,
            rarity: before.cardRarity ?? null,
            imageUrl: before.cardImageUrl ?? null,
            marketPrice: null,
          };
          set((s) => ({
            ownedCards: [
              ...s.ownedCards,
              {
                id: before.id,
                collectionId: before.collectionId,
                cardId: before.cardId,
                card,
                quantity: before.quantity,
                condition: before.condition,
                language: before.language,
                isFoil: before.isFoil,
                purchasePrice: before.purchasePrice,
                notes: before.notes,
                tagIds: [],
              },
            ],
            activityEvents: [
              makeDemoActivity(
                {
                  collectionId: event.collectionId,
                  action: "undo",
                  ownedCardId: event.ownedCardId,
                  cardName: event.cardName,
                  beforeState: event.afterState,
                  afterState: event.beforeState,
                  meta: { undoneEventId: eventId, originalAction: event.action },
                },
                s.profile.displayName
              ),
              ...(s.activityEvents ?? []).map((e) =>
                e.id === eventId
                  ? { ...e, undoneAt: new Date().toISOString(), undoneBy: "demo-local" }
                  : e
              ),
            ],
          }));
          return { ok: true as const };
        }

        if (event.action === "cards_bulk_deleted") {
          const before = event.beforeState as OwnedCardSnapshot[] | null;
          if (!Array.isArray(before) || before.length === 0) {
            return { error: "This event cannot be undone", status: 400 };
          }
          if (before.some((snap) => state.ownedCards.some((oc) => oc.id === snap.id))) {
            return { error: "Some cards already exist again", status: 409 };
          }
          set((s) => ({
            ownedCards: [
              ...s.ownedCards,
              ...before.map((snap) => ({
                id: snap.id,
                collectionId: snap.collectionId,
                cardId: snap.cardId,
                card: {
                  id: snap.cardId,
                  gameId: "",
                  gameSlug: "yugioh",
                  gameName: "Yu-Gi-Oh!",
                  externalId: snap.cardExternalId ?? null,
                  name: snap.cardName,
                  setCode: snap.cardSetCode ?? null,
                  setName: null,
                  collectorNumber: null,
                  rarity: snap.cardRarity ?? null,
                  imageUrl: snap.cardImageUrl ?? null,
                  marketPrice: null,
                } satisfies DemoCard,
                quantity: snap.quantity,
                condition: snap.condition,
                language: snap.language,
                isFoil: snap.isFoil,
                purchasePrice: snap.purchasePrice,
                notes: snap.notes,
                tagIds: [],
              })),
            ],
            activityEvents: [
              makeDemoActivity(
                {
                  collectionId: event.collectionId,
                  action: "undo",
                  ownedCardId: event.ownedCardId,
                  cardName: event.cardName,
                  beforeState: event.afterState,
                  afterState: event.beforeState,
                  meta: { undoneEventId: eventId, originalAction: event.action },
                },
                s.profile.displayName
              ),
              ...(s.activityEvents ?? []).map((e) =>
                e.id === eventId
                  ? { ...e, undoneAt: new Date().toISOString(), undoneBy: "demo-local" }
                  : e
              ),
            ],
          }));
          return { ok: true as const };
        }

        return { error: "This event cannot be undone", status: 400 };
      },

      addCardFromSearch: (result, gameId, gameSlug, gameName, collectionId) => {
        const state = get();
        const targetCollectionId = collectionId ?? state.activeCollectionId;
        const actor = state.profile.displayName;
        const existing = state.ownedCards.find(
          (oc) =>
            oc.collectionId === targetCollectionId &&
            oc.card.externalId === result.externalId &&
            oc.card.gameSlug === gameSlug
        );

        if (existing) {
          const before = snapshotOwnedCard(existing);
          set((s) => {
            const nextOwned = s.ownedCards.map((oc) =>
              oc.id === existing.id
                ? {
                    ...oc,
                    quantity: oc.quantity + 1,
                    card: {
                      ...oc.card,
                      marketPrice: result.price ?? oc.card.marketPrice,
                      imageUrl: result.imageUrl ?? oc.card.imageUrl,
                      rarity: result.rarity ?? oc.card.rarity,
                      setName: result.setName ?? oc.card.setName,
                      type:
                        yugiohTypeFromSearchMetadata(result.metadata) ?? oc.card.type ?? null,
                      cardTraderBlueprintId:
                        cardTraderBlueprintFromSearch(
                          result.externalId,
                          result.imageUrl,
                          result.metadata?.catalogSource as string | undefined,
                          gameSlug,
                          result.metadata
                        ) ?? oc.card.cardTraderBlueprintId,
                    },
                  }
                : oc
            );
            const updated = nextOwned.find((oc) => oc.id === existing.id)!;
            return {
              ownedCards: nextOwned,
              activityEvents: [
                makeDemoActivity(
                  {
                    collectionId: targetCollectionId,
                    action: "card_updated",
                    ownedCardId: existing.id,
                    cardName: existing.card.name,
                    beforeState: before,
                    afterState: snapshotOwnedCard(updated),
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
        const owned: DemoOwnedCard = {
          id: generateId(),
          collectionId: targetCollectionId,
          cardId,
          card,
          quantity: 1,
          condition: "NM",
          language: "EN",
          isFoil: false,
          purchasePrice: null,
          notes: null,
          tagIds: [],
        };
        set((s) => ({
          ownedCards: [...s.ownedCards, owned],
          activityEvents: [
            makeDemoActivity(
              {
                collectionId: targetCollectionId,
                action: "card_added",
                ownedCardId: owned.id,
                cardName: owned.card.name,
                beforeState: null,
                afterState: snapshotOwnedCard(owned),
              },
              actor
            ),
            ...(s.activityEvents ?? []),
          ],
        }));
      },

      updateOwnedCard: (id, updates) =>
        set((s) => {
          const beforeOc = s.ownedCards.find((oc) => oc.id === id);
          const ownedCards = s.ownedCards.map((oc) => {
            if (oc.id !== id) return oc;
            const { card: cardUpdates, ...ownedUpdates } = updates;
            const next: DemoOwnedCard = { ...oc, ...ownedUpdates };
            if (cardUpdates) {
              next.card = { ...oc.card, ...cardUpdates };
            }
            return next;
          });
          const afterOc = ownedCards.find((oc) => oc.id === id);
          if (!beforeOc || !afterOc) return { ownedCards };
          return {
            ownedCards,
            activityEvents: [
              makeDemoActivity(
                {
                  collectionId: afterOc.collectionId,
                  action: "card_updated",
                  ownedCardId: afterOc.id,
                  cardName: afterOc.card.name,
                  beforeState: snapshotOwnedCard(beforeOc),
                  afterState: snapshotOwnedCard(afterOc),
                },
                s.profile.displayName
              ),
              ...(s.activityEvents ?? []),
            ],
          };
        }),

      deleteOwnedCards: (ids) =>
        set((s) => {
          const removed = s.ownedCards.filter((oc) => ids.includes(oc.id));
          if (removed.length === 0) {
            return { ownedCards: s.ownedCards.filter((oc) => !ids.includes(oc.id)) };
          }
          const snapshots = removed.map(snapshotOwnedCard);
          const event =
            snapshots.length === 1
              ? makeDemoActivity(
                  {
                    collectionId: snapshots[0]!.collectionId,
                    action: "card_deleted",
                    ownedCardId: snapshots[0]!.id,
                    cardName: snapshots[0]!.cardName,
                    beforeState: snapshots[0],
                    afterState: null,
                  },
                  s.profile.displayName
                )
              : makeDemoActivity(
                  {
                    collectionId: snapshots[0]!.collectionId,
                    action: "cards_bulk_deleted",
                    ownedCardId: null,
                    cardName: `${snapshots.length} cards`,
                    beforeState: snapshots,
                    afterState: null,
                    meta: { count: snapshots.length },
                  },
                  s.profile.displayName
                );
          return {
            ownedCards: s.ownedCards.filter((oc) => !ids.includes(oc.id)),
            activityEvents: [event, ...(s.activityEvents ?? [])],
          };
        }),

      importRows: (rows, mergeDuplicates) => {
        let imported = 0;
        const state = get();
        const newOwned = [...state.ownedCards];

        for (const row of rows) {
          const existing = mergeDuplicates
            ? newOwned.find(
                (oc) =>
                  oc.collectionId === state.activeCollectionId &&
                  oc.card.name.toLowerCase() === row.name.toLowerCase() &&
                  (oc.card.setName ?? "").toLowerCase() === (row.set ?? "").toLowerCase()
              )
            : undefined;

          if (existing) {
            existing.quantity += row.quantity;
            imported++;
            continue;
          }

          const cardId = generateId();
          const card: DemoCard = {
            id: cardId,
            gameId: row.gameId,
            gameSlug: row.gameSlug,
            gameName: row.gameName,
            externalId: null,
            name: row.name,
            setCode: null,
            setName: row.set ?? null,
            collectorNumber: null,
            rarity: null,
            imageUrl: null,
            marketPrice: null,
          };
          newOwned.push({
            id: generateId(),
            collectionId: state.activeCollectionId,
            cardId,
            card,
            quantity: row.quantity,
            condition: row.condition,
            language: row.language,
            isFoil: row.isFoil ?? false,
            purchasePrice: row.purchasePrice ?? null,
            notes: null,
            tagIds: [],
          });
          imported++;
        }

        set((s) => ({
          ownedCards: newOwned,
          activityEvents: [
            makeDemoActivity(
              {
                collectionId: state.activeCollectionId,
                action: "import",
                ownedCardId: null,
                cardName: null,
                beforeState: null,
                afterState: null,
                meta: { imported, source: "csv" },
              },
              s.profile.displayName
            ),
            ...(s.activityEvents ?? []),
          ],
        }));
        return imported;
      },

      importFromSearchResults: (items, mergeDuplicates) => {
        let imported = 0;
        const state = get();
        const newOwned = [...state.ownedCards];

        for (const item of items) {
          const { result, quantity, gameId, gameSlug, gameName } = item;
          const existing = mergeDuplicates
            ? newOwned.find((oc) => {
                if (oc.collectionId !== state.activeCollectionId) return false;
                if (oc.card.gameSlug !== gameSlug) return false;
                if (result.externalId) {
                  return oc.card.externalId === result.externalId;
                }
                return (
                  oc.card.name.toLowerCase() === result.name.toLowerCase() &&
                  (oc.card.setName ?? "").toLowerCase() === (result.setName ?? "").toLowerCase()
                );
              })
            : undefined;

          if (existing) {
            existing.quantity += quantity;
            existing.card = {
              ...existing.card,
              marketPrice: result.price ?? existing.card.marketPrice,
              imageUrl: result.imageUrl ?? existing.card.imageUrl,
              rarity: result.rarity ?? existing.card.rarity,
              setName: result.setName ?? existing.card.setName,
              setCode: result.setCode ?? existing.card.setCode,
              collectorNumber: result.collectorNumber ?? existing.card.collectorNumber,
              externalId: result.externalId ?? existing.card.externalId,
              type:
                yugiohTypeFromSearchMetadata(result.metadata) ?? existing.card.type ?? null,
              cardTraderBlueprintId:
                cardTraderBlueprintFromSearch(
                  result.externalId,
                  result.imageUrl,
                  result.metadata?.catalogSource as string | undefined,
                  gameSlug,
                  result.metadata
                ) ?? existing.card.cardTraderBlueprintId,
            };
            imported += quantity;
            continue;
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
          newOwned.push({
            id: generateId(),
            collectionId: state.activeCollectionId,
            cardId,
            card,
            quantity,
            condition: "NM",
            language: "EN",
            isFoil: false,
            purchasePrice: null,
            notes: null,
            tagIds: [],
          });
          imported += quantity;
        }

        set((s) => ({
          ownedCards: newOwned,
          activityEvents: [
            makeDemoActivity(
              {
                collectionId: state.activeCollectionId,
                action: "import",
                ownedCardId: null,
                cardName: null,
                beforeState: null,
                afterState: null,
                meta: { imported, source: "deck" },
              },
              s.profile.displayName
            ),
            ...(s.activityEvents ?? []),
          ],
        }));
        return imported;
      },

      halveOwnedCardQuantities: (collectionId) => {
        let changed = 0;
        set((s) => {
          const ownedCards = s.ownedCards.map((oc) => {
            if (oc.collectionId !== collectionId) return oc;
            const next = Math.max(1, Math.floor(oc.quantity / 2));
            if (next === oc.quantity) return oc;
            changed++;
            return { ...oc, quantity: next };
          });
          if (changed === 0) return s;
          return {
            ownedCards,
            activityEvents: [
              makeDemoActivity(
                {
                  collectionId,
                  action: "import",
                  ownedCardId: null,
                  cardName: null,
                  beforeState: null,
                  afterState: null,
                  meta: { imported: changed, source: "halve-qty" },
                },
                s.profile.displayName
              ),
              ...(s.activityEvents ?? []),
            ],
          };
        });
        return changed;
      },

      setOwnedCardQuantitiesToOne: (collectionId) => {
        let changed = 0;
        set((s) => {
          const ownedCards = s.ownedCards.map((oc) => {
            if (oc.collectionId !== collectionId || oc.quantity === 1) return oc;
            changed++;
            return { ...oc, quantity: 1 };
          });
          if (changed === 0) return s;
          return {
            ownedCards,
            activityEvents: [
              makeDemoActivity(
                {
                  collectionId,
                  action: "import",
                  ownedCardId: null,
                  cardName: null,
                  beforeState: null,
                  afterState: null,
                  meta: { imported: changed, source: "set-qty-one" },
                },
                s.profile.displayName
              ),
              ...(s.activityEvents ?? []),
            ],
          };
        });
        return changed;
      },

      updateProfile: (updates) =>
        set((s) => ({ profile: { ...s.profile, ...updates } })),

      recordAnimeShareRemoteDiff: (beforeCards, afterCards, actor, characterNames) => {
        const beforeByKey = new Map(
          beforeCards.map((c) => [animeCardSyncKey(c), c] as const)
        );
        const afterByKey = new Map(
          afterCards.map((c) => [animeCardSyncKey(c), c] as const)
        );
        const removed: AnimeCharacterCard[] = [];
        const added: AnimeCharacterCard[] = [];
        for (const [key, card] of beforeByKey) {
          if (!afterByKey.has(key)) removed.push(card);
        }
        for (const [key, card] of afterByKey) {
          if (!beforeByKey.has(key)) added.push(card);
        }
        if (removed.length === 0 && added.length === 0) {
          return { added: 0, removed: 0 };
        }

        const displayName = actor.displayName.trim() || "Collector";
        const characterNameById = new Map(
          (characterNames ?? get().animeCharacters).map((c) => [c.id, c.name] as const)
        );
        const MAX_EVENTS = 40;
        const events: DemoActivityEvent[] = [];

        for (const entry of removed.slice(0, MAX_EVENTS)) {
          const characterName = characterNameById.get(entry.characterId) ?? null;
          events.push(
            makeDemoActivity(
              {
                collectionId: ANIME_ACTIVITY_COLLECTION_ID,
                action: "card_deleted",
                ownedCardId: entry.id,
                cardName: entry.card.name,
                beforeState: snapshotAnimeCard(entry, characterName ?? undefined),
                afterState: null,
                actorDisplayName: displayName,
                meta: {
                  source: "anime",
                  characterId: entry.characterId,
                  characterName,
                  remoteShare: true,
                  actorUserId: actor.userId ?? null,
                },
              },
              displayName
            )
          );
        }

        const remaining = Math.max(0, MAX_EVENTS - events.length);
        for (const entry of added.slice(0, remaining)) {
          const characterName = characterNameById.get(entry.characterId) ?? null;
          events.push(
            makeDemoActivity(
              {
                collectionId: ANIME_ACTIVITY_COLLECTION_ID,
                action: "card_added",
                ownedCardId: entry.id,
                cardName: entry.card.name,
                beforeState: null,
                afterState: snapshotAnimeCard(entry, characterName ?? undefined),
                actorDisplayName: displayName,
                meta: {
                  source: "anime",
                  characterId: entry.characterId,
                  characterName,
                  remoteShare: true,
                  actorUserId: actor.userId ?? null,
                },
              },
              displayName
            )
          );
        }

        if (events.length > 0) {
          set((s) => ({
            activityEvents: [...events, ...(s.activityEvents ?? [])],
          }));
        }
        return { added: added.length, removed: removed.length };
      },

      addCollection: (name) => {
        const newCollection = {
          id: generateId(),
          name,
          isDefault: false,
          isFavorite: false,
          coverImageUrl: null,
        };
        set((s) => ({
          collections: [...s.collections, newCollection],
          activeCollectionId: newCollection.id,
        }));
        return newCollection;
      },

      renameCollection: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({
          collections: s.collections.map((c) =>
            c.id === id ? { ...c, name: trimmed } : c
          ),
        }));
      },

      deleteCollection: (id) => {
        const state = get();
        const target = state.collections.find((c) => c.id === id);
        if (!target || target.isDefault) return;

        const collections = state.collections.filter((c) => c.id !== id);
        const ownedCards = state.ownedCards.filter((oc) => oc.collectionId !== id);
        let activeCollectionId = state.activeCollectionId;
        if (activeCollectionId === id) {
          activeCollectionId =
            collections.find((c) => c.isDefault)?.id ??
            collections[0]?.id ??
            DEFAULT_COLLECTION_ID;
        }
        set({ collections, ownedCards, activeCollectionId });
      },

      toggleCollectionFavorite: (id) =>
        set((s) => ({
          collections: s.collections.map((c) =>
            c.id === id ? { ...c, isFavorite: !c.isFavorite } : c
          ),
        })),

      restoreFromBackup: (backup) => {
        const defaultCol =
          backup.collections.find((c) => c.isDefault) ?? backup.collections[0];
        const anime = resolveAnimeBackupFields(backup);
        set({
          profile: backup.profile,
          collections: backup.collections.length
            ? backup.collections
            : createInitialDemoState().collections,
          ownedCards: backup.ownedCards,
          tags: backup.tags ?? [],
          activeCollectionId: defaultCol?.id ?? DEFAULT_COLLECTION_ID,
          animeSeries: anime.animeSeries,
          animeCharacters: anime.animeCharacters,
          animeCharacterCards: anime.animeCharacterCards,
          animeCardTombstones: [],
          animeCharacterTombstones: [],
          animeSeriesTombstones: [],
        });
      },

      restoreAnimeCollectionFromBackup: (backup) => {
        const anime = resolveAnimeBackupFields(backup);
        set({
          animeSeries: anime.animeSeries,
          animeCharacters: anime.animeCharacters,
          animeCharacterCards: anime.animeCharacterCards,
          animeCardTombstones: [],
          animeCharacterTombstones: [],
          animeSeriesTombstones: [],
        });
      },

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
    }),
    {
      name: "deckvault-demo",
      version: 14,
      storage: createJSONStorage(() => createDebouncedLocalStorage()),
      migrate: (persisted, version) => {
        let state = persisted as DemoState;
        if (version < 2 && state.ownedCards) {
          state = {
            ...state,
            ownedCards: state.ownedCards.map((oc) => ({
              ...oc,
              card: repairDemoCard(oc.card),
            })),
          };
        }
        if (version < 3) {
          state = {
            ...state,
            animeSeries: state.animeSeries ?? [],
            animeCharacters: state.animeCharacters ?? [],
          };
        }
        if (version < 4) {
          state = {
            ...state,
            animeCharacterCards: state.animeCharacterCards ?? [],
          };
        }
        if (version < 5) {
          state = {
            ...state,
            animeCharacterCards: (state.animeCharacterCards ?? []).map((entry) => ({
              ...entry,
              condition: entry.condition ?? "NM",
              language: entry.language ?? "EN",
              isFoil: entry.isFoil ?? false,
            })),
          };
        }
        if (version < 6) {
          const byCharacter = new Map<string, number>();
          state = {
            ...state,
            animeCharacterCards: (state.animeCharacterCards ?? []).map((entry) => {
              const order = byCharacter.get(entry.characterId) ?? 0;
              byCharacter.set(entry.characterId, order + 1);
              return { ...entry, sortOrder: entry.sortOrder ?? order };
            }),
          };
        }
        if (version < 9) {
          state = stripSeededAnime(state);
        }
        if (version < 10) {
          state = {
            ...state,
            animeBinderLayoutByCharacter: state.animeBinderLayoutByCharacter ?? {},
          };
        }
        if (version < 11) {
          state = {
            ...state,
            activityEvents: state.activityEvents ?? [],
          };
        }
        if (version < 12) {
          state = {
            ...state,
            animeCardTombstones: state.animeCardTombstones ?? [],
          };
        }
        if (version < 13) {
          state = {
            ...state,
            animeCharacterTombstones: state.animeCharacterTombstones ?? [],
          };
        }
        if (version < 14) {
          state = {
            ...state,
            animeSeriesTombstones: state.animeSeriesTombstones ?? [],
          };
        }
        return state;
      },
    }
  )
);
