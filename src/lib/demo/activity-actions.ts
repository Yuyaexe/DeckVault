import type { DemoCard } from "./types";
import type { DemoStore, StoreGet, StoreSet } from "./store-types";
import { ownedSnapshotsEqual, type OwnedCardSnapshot } from "@/lib/activity/types";
import { pruneExpiredActivityEvents } from "@/lib/activity/retention";
import { makeDemoActivity } from "./store-helpers";

export type ActivityActions = Pick<DemoStore, "pruneActivityHistory" | "undoActivityEvent">;

export function createActivityActions(set: StoreSet, get: StoreGet): ActivityActions {
  return {
pruneActivityHistory: () => {
  const current = get().activityEvents ?? [];
  const retained = pruneExpiredActivityEvents(current);
  if (retained.length !== current.length) {
    set({ activityEvents: retained });
  }
  return current.length - retained.length;
},

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


  };
}
