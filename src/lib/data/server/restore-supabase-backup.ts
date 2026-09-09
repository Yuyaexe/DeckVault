import type { SupabaseClient } from "@supabase/supabase-js";
import { marketPriceMetadata } from "@/lib/data/mappers";
import type { DeckVaultBackup } from "@/features/import/services/backup-export";
import type { DemoCard } from "@/lib/demo/types";
import {
  createSupabaseCollection,
  updateSupabaseProfile,
} from "@/lib/data/server/supabase-service";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  RestoreStepError,
  runRestoreStage,
} from "@/features/import/services/restore-debug";

const CARD_RESOLVE_CONCURRENCY = 8;
const OWNED_INSERT_CHUNK = 100;

/** Prefer service role for bulk restore writes (bypasses RLS safely on server). */
function restoreWriteClient(supabase: SupabaseClient): SupabaseClient {
  return getSupabaseAdmin() ?? supabase;
}

async function resolveSupabaseCardId(
  supabase: SupabaseClient,
  card: DemoCard
): Promise<string> {
  const db = restoreWriteClient(supabase);

  if (card.externalId) {
    const { data, error } = await db
      .from("cards")
      .upsert(
        {
          game_id: card.gameId,
          external_id: card.externalId,
          name: card.name,
          set_code: card.setCode,
          set_name: card.setName,
          collector_number: card.collectorNumber,
          rarity: card.rarity,
          image_url: card.imageUrl,
          metadata: marketPriceMetadata(card.marketPrice),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "game_id,external_id" }
      )
      .select("id")
      .single();
    if (error) {
      throw new RestoreStepError(
        "resolve_cards",
        error,
        `upsert "${card.name}" (id ${card.externalId})`
      );
    }
    return data.id;
  }

  const { data: existing } = await db
    .from("cards")
    .select("id")
    .eq("game_id", card.gameId)
    .eq("name", card.name)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: inserted, error } = await db
    .from("cards")
    .insert({
      game_id: card.gameId,
      external_id: card.externalId,
      name: card.name,
      set_code: card.setCode,
      set_name: card.setName,
      collector_number: card.collectorNumber,
      rarity: card.rarity,
      image_url: card.imageUrl,
      metadata: marketPriceMetadata(card.marketPrice),
    })
    .select("id")
    .single();
  if (error) {
    throw new RestoreStepError("resolve_cards", error, `insert "${card.name}"`);
  }
  return inserted.id;
}

function catalogKey(card: DemoCard): string {
  return `${card.gameId}:${card.externalId ?? card.name}`;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

export async function restoreSupabaseBackup(
  supabase: SupabaseClient,
  userId: string,
  backup: DeckVaultBackup
) {
  await runRestoreStage("profile", () =>
    updateSupabaseProfile(supabase, userId, {
      displayName: backup.profile.displayName,
      currency: backup.profile.currency,
      defaultGameId: backup.profile.defaultGameId,
    })
  );

  const { data: userCollections, error: colErr } = await runRestoreStage(
    "load_collections",
    () =>
      supabase
        .from("collections")
        .select("id, name, is_default")
        .eq("user_id", userId)
  );
  if (colErr) throw new RestoreStepError("load_collections", colErr);

  const userHasDefault = (userCollections ?? []).some((c) => c.is_default);
  const collectionMap = new Map<string, string>();

  for (const bc of backup.collections) {
    const match = (userCollections ?? []).find((c) => c.name === bc.name);
    if (match) {
      collectionMap.set(bc.id, match.id);
    } else {
      const created = await runRestoreStage("create_collections", async () => {
        const col = await createSupabaseCollection(supabase, userId, bc.name);

        const patch: Record<string, boolean> = {};
        if (bc.isDefault && !userHasDefault) patch.is_default = true;
        if (bc.isFavorite) patch.is_favorite = true;

        if (Object.keys(patch).length > 0) {
          const db = restoreWriteClient(supabase);
          const { error: patchErr } = await db
            .from("collections")
            .update({ ...patch, updated_at: new Date().toISOString() })
            .eq("id", col.id);
          if (patchErr) {
            throw new RestoreStepError(
              "create_collections",
              patchErr,
              `atualizar "${bc.name}"`
            );
          }
        }

        return col;
      });

      collectionMap.set(bc.id, created.id);
    }
  }

  const uniqueCards = new Map<string, DemoCard>();
  for (const oc of backup.ownedCards) {
    const key = catalogKey(oc.card);
    if (!uniqueCards.has(key)) uniqueCards.set(key, oc.card);
  }

  const catalogEntries = [...uniqueCards.entries()];
  const resolvedIds = await runRestoreStage("resolve_cards", () =>
    mapWithConcurrency(catalogEntries, CARD_RESOLVE_CONCURRENCY, async ([, card]) =>
      resolveSupabaseCardId(supabase, card)
    )
  );

  const catalogIdByKey = new Map<string, string>();
  catalogEntries.forEach(([key], i) => {
    catalogIdByKey.set(key, resolvedIds[i]!);
  });

  type AggregatedOwned = {
    collectionId: string;
    cardId: string;
    quantity: number;
    condition: string;
    language: string;
    isFoil: boolean;
    purchasePrice: number | null;
    notes: string | null;
  };

  const aggregated = new Map<string, AggregatedOwned>();

  for (const oc of backup.ownedCards) {
    const collectionId = collectionMap.get(oc.collectionId);
    const cardId = catalogIdByKey.get(catalogKey(oc.card));
    if (!collectionId || !cardId) continue;

    const aggKey = `${collectionId}:${cardId}`;
    const existing = aggregated.get(aggKey);
    if (existing) {
      existing.quantity += oc.quantity;
      continue;
    }

    aggregated.set(aggKey, {
      collectionId,
      cardId,
      quantity: oc.quantity,
      condition: oc.condition,
      language: oc.language,
      isFoil: oc.isFoil,
      purchasePrice: oc.purchasePrice,
      notes: oc.notes,
    });
  }

  const rows = [...aggregated.values()];
  const targetCollectionIds = [...new Set(rows.map((r) => r.collectionId))];
  const db = restoreWriteClient(supabase);

  const { data: existingOwned, error: ownedFetchErr } = await runRestoreStage("fetch_owned", () =>
    db
      .from("owned_cards")
      .select("id, collection_id, card_id, quantity")
      .in("collection_id", targetCollectionIds)
  );
  if (ownedFetchErr) throw new RestoreStepError("fetch_owned", ownedFetchErr);

  const existingByKey = new Map<string, { id: string; quantity: number }>();
  for (const row of existingOwned ?? []) {
    existingByKey.set(`${row.collection_id}:${row.card_id}`, {
      id: row.id,
      quantity: row.quantity,
    });
  }

  const toInsert: Array<{
    collection_id: string;
    card_id: string;
    quantity: number;
    condition: string;
    language: string;
    is_foil: boolean;
    purchase_price: number | null;
    notes: string | null;
  }> = [];

  const quantityUpdates: Array<{ id: string; quantity: number }> = [];

  for (const row of rows) {
    const key = `${row.collectionId}:${row.cardId}`;
    const existing = existingByKey.get(key);
    if (existing) {
      quantityUpdates.push({
        id: existing.id,
        quantity: existing.quantity + row.quantity,
      });
    } else {
      toInsert.push({
        collection_id: row.collectionId,
        card_id: row.cardId,
        quantity: row.quantity,
        condition: row.condition,
        language: row.language,
        is_foil: row.isFoil,
        purchase_price: row.purchasePrice,
        notes: row.notes,
      });
    }
  }

  for (let i = 0; i < toInsert.length; i += OWNED_INSERT_CHUNK) {
    const chunk = toInsert.slice(i, i + OWNED_INSERT_CHUNK);
    const chunkIndex = Math.floor(i / OWNED_INSERT_CHUNK) + 1;
    const chunkTotal = Math.ceil(toInsert.length / OWNED_INSERT_CHUNK);
    const { error } = await runRestoreStage("insert_owned", () =>
      db.from("owned_cards").insert(chunk)
    );
    if (error) {
      throw new RestoreStepError(
        "insert_owned",
        error,
        `lote ${chunkIndex}/${chunkTotal} (${chunk.length} linhas)`
      );
    }
  }

  await runRestoreStage("update_quantities", () =>
    mapWithConcurrency(quantityUpdates, 12, async (update) => {
      const { error } = await db
        .from("owned_cards")
        .update({
          quantity: update.quantity,
          updated_at: new Date().toISOString(),
        })
        .eq("id", update.id);
      if (error) {
        throw new RestoreStepError("update_quantities", error, `owned_card ${update.id}`);
      }
    })
  );

  return {
    importedCards: rows.length,
    collections: backup.collections.length,
  };
}
