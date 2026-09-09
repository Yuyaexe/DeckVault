import type { SupabaseClient } from "@supabase/supabase-js";
import {
  appendActivityEvent,
  mapActivityRow,
  resolveActorDisplayName,
} from "@/lib/data/server/activity-service";
import {
  ownedSnapshotsEqual,
  type OwnedCardSnapshot,
} from "@/lib/activity/types";
import type { DemoOwnedCard } from "@/lib/demo/types";
import { toDemoOwnedCard } from "@/lib/data/mappers";

type CardJoin = {
  id: string;
  game_id: string;
  external_id: string | null;
  name: string;
  set_code: string | null;
  set_name: string | null;
  collector_number: string | null;
  rarity: string | null;
  image_url: string | null;
  metadata: Record<string, unknown> | null;
  games: { id: string; slug: string; name: string };
};

type OwnedJoin = {
  id: string;
  collection_id: string;
  card_id: string;
  quantity: number;
  condition: string;
  language: string;
  is_foil: boolean;
  purchase_price: string | null;
  notes: string | null;
  cards: CardJoin;
};

const OWNED_SELECT =
  "id, collection_id, card_id, quantity, condition, language, is_foil, purchase_price, notes, cards(id, game_id, external_id, name, set_code, set_name, collector_number, rarity, image_url, metadata, games(id, slug, name))";

function mapOwned(row: OwnedJoin): DemoOwnedCard {
  const card = row.cards;
  return toDemoOwnedCard(
    {
      id: row.id,
      collectionId: row.collection_id,
      cardId: row.card_id,
      quantity: row.quantity,
      condition: row.condition,
      language: row.language,
      isFoil: row.is_foil,
      purchasePrice: row.purchase_price,
      notes: row.notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: card.id,
      gameId: card.game_id,
      externalId: card.external_id,
      name: card.name,
      setCode: card.set_code,
      setName: card.set_name,
      collectorNumber: card.collector_number,
      rarity: card.rarity,
      imageUrl: card.image_url,
      metadata: card.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    { id: card.games.id, slug: card.games.slug, name: card.games.name, createdAt: new Date() }
  );
}

function toSnapshot(oc: DemoOwnedCard): OwnedCardSnapshot {
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

export class ActivityUndoConflictError extends Error {
  constructor(message = "Card was changed after this event") {
    super(message);
    this.name = "ActivityUndoConflictError";
  }
}

export class ActivityUndoNotAllowedError extends Error {
  constructor(message = "This event cannot be undone") {
    super(message);
    this.name = "ActivityUndoNotAllowedError";
  }
}

async function fetchOwnedById(
  supabase: SupabaseClient,
  id: string
): Promise<DemoOwnedCard | null> {
  const { data, error } = await supabase
    .from("owned_cards")
    .select(OWNED_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapOwned(data as unknown as OwnedJoin);
}

export async function undoActivityEvent(
  supabase: SupabaseClient,
  userId: string,
  eventId: string
) {
  const { data: row, error } = await supabase
    .from("collection_activity")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("Activity event not found");

  const event = mapActivityRow(row);
  if (event.undoneAt) {
    throw new ActivityUndoNotAllowedError("Event already undone");
  }

  const actorName = await resolveActorDisplayName(supabase, userId);

  if (event.action === "card_added") {
    const after = event.afterState as OwnedCardSnapshot | null;
    if (!after) throw new ActivityUndoNotAllowedError();
    const current = await fetchOwnedById(supabase, after.id);
    if (!current) {
      // Already gone — mark undone
    } else if (!ownedSnapshotsEqual(after, current)) {
      throw new ActivityUndoConflictError();
    } else {
      const { error: delErr } = await supabase
        .from("owned_cards")
        .delete()
        .eq("id", after.id);
      if (delErr) throw delErr;
    }
  } else if (event.action === "card_updated") {
    const before = event.beforeState as OwnedCardSnapshot | null;
    const after = event.afterState as OwnedCardSnapshot | null;
    if (!before || !after) throw new ActivityUndoNotAllowedError();
    const current = await fetchOwnedById(supabase, after.id);
    if (!current) throw new ActivityUndoConflictError("Card no longer exists");
    if (!ownedSnapshotsEqual(after, current)) {
      throw new ActivityUndoConflictError();
    }
    const { error: updErr } = await supabase
      .from("owned_cards")
      .update({
        quantity: before.quantity,
        condition: before.condition,
        language: before.language,
        is_foil: before.isFoil,
        purchase_price: before.purchasePrice,
        notes: before.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", before.id);
    if (updErr) throw updErr;
  } else if (event.action === "card_deleted") {
    const before = event.beforeState as OwnedCardSnapshot | null;
    if (!before) throw new ActivityUndoNotAllowedError();
    const existing = await fetchOwnedById(supabase, before.id);
    if (existing) throw new ActivityUndoConflictError("Card already exists again");
    const { error: insErr } = await supabase.from("owned_cards").insert({
      id: before.id,
      collection_id: before.collectionId,
      card_id: before.cardId,
      quantity: before.quantity,
      condition: before.condition,
      language: before.language,
      is_foil: before.isFoil,
      purchase_price: before.purchasePrice,
      notes: before.notes,
    });
    if (insErr) throw insErr;
  } else if (event.action === "cards_bulk_deleted") {
    const before = event.beforeState as OwnedCardSnapshot[] | null;
    if (!Array.isArray(before) || before.length === 0) {
      throw new ActivityUndoNotAllowedError();
    }
    for (const snap of before) {
      const existing = await fetchOwnedById(supabase, snap.id);
      if (existing) {
        throw new ActivityUndoConflictError(
          "Some cards already exist again — cannot undo bulk delete"
        );
      }
    }
    const { error: insErr } = await supabase.from("owned_cards").insert(
      before.map((snap) => ({
        id: snap.id,
        collection_id: snap.collectionId,
        card_id: snap.cardId,
        quantity: snap.quantity,
        condition: snap.condition,
        language: snap.language,
        is_foil: snap.isFoil,
        purchase_price: snap.purchasePrice,
        notes: snap.notes,
      }))
    );
    if (insErr) throw insErr;
  } else {
    throw new ActivityUndoNotAllowedError();
  }

  const { error: markErr } = await supabase
    .from("collection_activity")
    .update({
      undone_at: new Date().toISOString(),
      undone_by: userId,
    })
    .eq("id", eventId);
  if (markErr) throw markErr;

  await appendActivityEvent(supabase, {
    collectionId: event.collectionId,
    actorUserId: userId,
    actorDisplayName: actorName,
    action: "undo",
    ownedCardId: event.ownedCardId,
    cardName: event.cardName,
    beforeState: event.afterState,
    afterState: event.beforeState,
    meta: { undoneEventId: eventId, originalAction: event.action },
  });

  return { ok: true as const };
}

export { toSnapshot, fetchOwnedById, mapOwned, OWNED_SELECT };
