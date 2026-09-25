import type { AnimeCharacterCard, DemoActivityEvent, DemoCard, DemoOwnedCard } from "./types";
import { createInitialDemoState, DEFAULT_COLLECTION_ID } from "./types";
import type { DemoStore, StoreGet, StoreSet } from "./store-types";
import { ANIME_ACTIVITY_COLLECTION_ID, snapshotOwnedCard } from "@/lib/activity/types";
import { resolveAnimeBackupFields } from "@/features/import/services/backup-export";
import { animeCardSyncKey } from "@/lib/data/anime-share-merge";
import { yugiohTypeFromSearchMetadata } from "@/lib/yugioh/deck-category";
import { cardTraderBlueprintFromSearch } from "./repair-card";
import { generateId, makeDemoActivity, snapshotAnimeCard } from "./store-helpers";

export type CollectionActions = Pick<DemoStore,
  | "addCardFromSearch" | "updateOwnedCard" | "deleteOwnedCards"
  | "importRows" | "importFromSearchResults"
  | "halveOwnedCardQuantities" | "setOwnedCardQuantitiesToOne"
  | "updateProfile" | "recordAnimeShareRemoteDiff"
  | "addCollection" | "renameCollection" | "deleteCollection"
  | "toggleCollectionFavorite" | "restoreFromBackup"
  | "restoreAnimeCollectionFromBackup"
>;

export function createCollectionActions(set: StoreSet, get: StoreGet): CollectionActions {
  return {
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


  };
}
