import type { DemoOwnedCard } from "@/lib/demo/types";
import type { CardCondition, CardLanguage } from "@/types/tcg";

export type ActivityAction =
  | "card_added"
  | "card_updated"
  | "card_deleted"
  | "cards_bulk_deleted"
  | "import"
  | "invite_sent"
  | "member_joined"
  | "member_removed"
  | "undo";

/** Pseudo collection id for anime-side activity (always local). */
export const ANIME_ACTIVITY_COLLECTION_ID = "anime-collection";

/** Filter value: all TCG collections + anime. */
export const ALL_ACTIVITY_SCOPE_ID = "__all__";

export type CollectionMemberRole = "owner" | "editor" | "viewer";

export interface OwnedCardSnapshot {
  id: string;
  collectionId: string;
  cardId: string;
  quantity: number;
  condition: CardCondition;
  language: CardLanguage;
  isFoil: boolean;
  purchasePrice: number | null;
  notes: string | null;
  cardName: string;
  cardExternalId?: string | null;
  cardSetCode?: string | null;
  cardRarity?: string | null;
  cardImageUrl?: string | null;
}

export interface ActivityEvent {
  id: string;
  collectionId: string;
  actorUserId: string;
  actorDisplayName: string;
  action: ActivityAction;
  ownedCardId: string | null;
  cardName: string | null;
  beforeState: OwnedCardSnapshot | OwnedCardSnapshot[] | null;
  afterState: OwnedCardSnapshot | OwnedCardSnapshot[] | null;
  meta: Record<string, unknown>;
  createdAt: string;
  undoneAt: string | null;
  undoneBy: string | null;
}

export const UNDOABLE_ACTIONS: ReadonlySet<ActivityAction> = new Set([
  "card_added",
  "card_updated",
  "card_deleted",
  "cards_bulk_deleted",
]);

export function isUndoableEvent(event: Pick<ActivityEvent, "action" | "undoneAt" | "collectionId">): boolean {
  if (event.undoneAt != null) return false;
  if (event.collectionId === ANIME_ACTIVITY_COLLECTION_ID) return false;
  return UNDOABLE_ACTIONS.has(event.action);
}

export function snapshotOwnedCard(oc: DemoOwnedCard): OwnedCardSnapshot {
  return {
    id: oc.id,
    collectionId: oc.collectionId,
    cardId: oc.cardId,
    quantity: oc.quantity,
    condition: oc.condition,
    language: oc.language,
    isFoil: oc.isFoil,
    purchasePrice: oc.purchasePrice,
    notes: oc.notes,
    cardName: oc.card.name,
    cardExternalId: oc.card.externalId,
    cardSetCode: oc.card.setCode,
    cardRarity: oc.card.rarity,
    cardImageUrl: oc.card.imageUrl,
  };
}

export function ownedSnapshotsEqual(
  a: OwnedCardSnapshot,
  b: Pick<
    OwnedCardSnapshot,
    "quantity" | "condition" | "language" | "isFoil" | "notes" | "purchasePrice"
  >
): boolean {
  return (
    a.quantity === b.quantity &&
    a.condition === b.condition &&
    a.language === b.language &&
    a.isFoil === b.isFoil &&
    (a.notes ?? null) === (b.notes ?? null) &&
    (a.purchasePrice ?? null) === (b.purchasePrice ?? null)
  );
}
