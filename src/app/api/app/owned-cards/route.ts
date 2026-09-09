import { NextRequest, NextResponse } from "next/server";
import {
  getDataContext,
  requireSupabase,
  requireUserId,
} from "@/lib/data/server/data-context";
import {
  addSupabaseCardFromSearch,
  deleteSupabaseOwnedCards,
  importSupabaseFromSearchResults,
  importSupabaseRows,
  updateSupabaseOwnedCard,
} from "@/lib/data/server/supabase-service";
import { appendActivityEvent, resolveActorDisplayName } from "@/lib/data/server/activity-service";
import {
  fetchOwnedById,
  toSnapshot,
} from "@/lib/data/server/activity-undo";
import { snapshotOwnedCard } from "@/lib/activity/types";
import {
  CollectionRequiredError,
  requireCollectionId,
} from "@/lib/data/collection-requirements";
import type { CardSearchResult } from "@/features/catalog/services/card-api/types";
import type { CardCondition, CardLanguage, Currency } from "@/types/tcg";

function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Operation failed";
  if (message === "Authentication required") return { status: 401, message };
  if (error instanceof CollectionRequiredError || message === "Collection required") {
    return { status: 400, message: "Collection required" };
  }
  return { status: 500, message };
}

export async function POST(request: NextRequest) {
  const ctx = await getDataContext();
  if (ctx.mode === "demo") {
    return NextResponse.json({ error: "Not in server mode" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const action = body.action as string;
    const supabase = requireSupabase(ctx);
    const userId = requireUserId(ctx);
    const actorName = await resolveActorDisplayName(supabase, userId);

    if (action === "add-from-search") {
      const collectionId = requireCollectionId(body.collectionId);
      const { result, gameId, gameSlug } = body as {
        result: CardSearchResult;
        gameId: string;
        gameSlug: string;
      };

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("currency")
        .eq("user_id", userId)
        .maybeSingle();

      const currency = (profileRow?.currency as Currency | undefined) ?? "USD";

      let beforeQty: number | null = null;
      let beforeId: string | null = null;
      if (result.externalId) {
        const { data: existingOwned } = await supabase
          .from("owned_cards")
          .select("id, quantity, cards!inner(external_id, game_id)")
          .eq("collection_id", collectionId);
        const match = (existingOwned ?? []).find((row) => {
          const card = row.cards as unknown as {
            external_id: string | null;
            game_id: string;
          };
          return card.external_id === result.externalId && card.game_id === gameId;
        });
        if (match) {
          beforeQty = match.quantity;
          beforeId = match.id;
        }
      }

      const owned = await addSupabaseCardFromSearch(
        supabase,
        collectionId,
        result,
        gameId,
        gameSlug,
        currency
      );

      if (beforeId && beforeQty != null) {
        const before = await fetchOwnedById(supabase, beforeId);
        await appendActivityEvent(supabase, {
          collectionId,
          actorUserId: userId,
          actorDisplayName: actorName,
          action: "card_updated",
          ownedCardId: owned.id,
          cardName: owned.card.name,
          beforeState: before
            ? { ...toSnapshot(before), quantity: beforeQty }
            : {
                id: owned.id,
                collectionId,
                cardId: owned.cardId,
                quantity: beforeQty,
                condition: owned.condition,
                language: owned.language,
                isFoil: owned.isFoil,
                purchasePrice: owned.purchasePrice,
                notes: owned.notes,
                cardName: owned.card.name,
              },
          afterState: snapshotOwnedCard(owned),
        });
      } else {
        await appendActivityEvent(supabase, {
          collectionId,
          actorUserId: userId,
          actorDisplayName: actorName,
          action: "card_added",
          ownedCardId: owned.id,
          cardName: owned.card.name,
          beforeState: null,
          afterState: snapshotOwnedCard(owned),
        });
      }

      return NextResponse.json({ ok: true, ownedCard: owned });
    }

    if (action === "import-deck") {
      const collectionId = requireCollectionId(body.collectionId);
      const { items, mergeDuplicates } = body as {
        items: Array<{
          result: CardSearchResult;
          quantity: number;
          gameId: string;
          gameSlug: string;
        }>;
        mergeDuplicates: boolean;
      };

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("currency")
        .eq("user_id", userId)
        .maybeSingle();

      const currency = (profileRow?.currency as Currency | undefined) ?? "USD";

      const count = await importSupabaseFromSearchResults(
        supabase,
        collectionId,
        items,
        mergeDuplicates,
        currency
      );

      await appendActivityEvent(supabase, {
        collectionId,
        actorUserId: userId,
        actorDisplayName: actorName,
        action: "import",
        meta: { imported: count, source: "deck" },
      });

      return NextResponse.json({ imported: count });
    }

    if (action === "import") {
      const collectionId = requireCollectionId(body.collectionId);
      const { rows, mergeDuplicates } = body as {
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
        }>;
        mergeDuplicates: boolean;
      };
      const count = await importSupabaseRows(
        supabase,
        collectionId,
        rows,
        mergeDuplicates
      );

      await appendActivityEvent(supabase, {
        collectionId,
        actorUserId: userId,
        actorDisplayName: actorName,
        action: "import",
        meta: { imported: count, source: "csv" },
      });

      return NextResponse.json({ imported: count });
    }

    if (action === "halve-quantities" || action === "set-quantities-to-one") {
      const collectionId = requireCollectionId(body.collectionId);
      const { data: rows, error: fetchErr } = await supabase
        .from("owned_cards")
        .select("id, quantity")
        .eq("collection_id", collectionId);
      if (fetchErr) throw fetchErr;

      const updates = (rows ?? [])
        .map((row) => {
          const qty = Number(row.quantity) || 1;
          const next =
            action === "set-quantities-to-one"
              ? 1
              : Math.max(1, Math.floor(qty / 2));
          return { id: row.id as string, quantity: next, prev: qty };
        })
        .filter((u) => u.quantity !== u.prev);

      for (const u of updates) {
        const { error } = await supabase
          .from("owned_cards")
          .update({ quantity: u.quantity, updated_at: new Date().toISOString() })
          .eq("id", u.id);
        if (error) throw error;
      }

      await appendActivityEvent(supabase, {
        collectionId,
        actorUserId: userId,
        actorDisplayName: actorName,
        action: "import",
        meta: {
          imported: updates.length,
          source: action === "set-quantities-to-one" ? "set-qty-one" : "halve-qty",
        },
      });

      return NextResponse.json({ changed: updates.length });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/app/owned-cards", error);
    const { status, message } = apiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  const ctx = await getDataContext();
  if (ctx.mode === "demo") {
    return NextResponse.json({ error: "Not in server mode" }, { status: 503 });
  }

  try {
    const { id, updates } = (await request.json()) as {
      id: string;
      updates: Parameters<typeof updateSupabaseOwnedCard>[2];
    };
    if (typeof id !== "string" || !id.trim()) {
      return NextResponse.json({ error: "Card id required" }, { status: 400 });
    }
    const supabase = requireSupabase(ctx);
    const userId = requireUserId(ctx);
    const actorName = await resolveActorDisplayName(supabase, userId);

    const before = await fetchOwnedById(supabase, id);
    if (!before) {
      return NextResponse.json({ error: "Owned card not found" }, { status: 404 });
    }

    await updateSupabaseOwnedCard(supabase, id, updates);
    const after = await fetchOwnedById(supabase, id);

    if (after) {
      await appendActivityEvent(supabase, {
        collectionId: after.collectionId,
        actorUserId: userId,
        actorDisplayName: actorName,
        action: "card_updated",
        ownedCardId: after.id,
        cardName: after.card.name,
        beforeState: toSnapshot(before),
        afterState: toSnapshot(after),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/app/owned-cards", error);
    const { status, message } = apiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const ctx = await getDataContext();
  if (ctx.mode === "demo") {
    return NextResponse.json({ error: "Not in server mode" }, { status: 503 });
  }

  try {
    const { ids } = (await request.json()) as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Card ids required" }, { status: 400 });
    }
    const supabase = requireSupabase(ctx);
    const userId = requireUserId(ctx);
    const actorName = await resolveActorDisplayName(supabase, userId);

    const snapshots = [];
    for (const id of ids) {
      const oc = await fetchOwnedById(supabase, id);
      if (oc) snapshots.push(toSnapshot(oc));
    }

    await deleteSupabaseOwnedCards(supabase, ids);

    if (snapshots.length === 1) {
      const snap = snapshots[0]!;
      await appendActivityEvent(supabase, {
        collectionId: snap.collectionId,
        actorUserId: userId,
        actorDisplayName: actorName,
        action: "card_deleted",
        ownedCardId: snap.id,
        cardName: snap.cardName,
        beforeState: snap,
        afterState: null,
      });
    } else if (snapshots.length > 1) {
      await appendActivityEvent(supabase, {
        collectionId: snapshots[0]!.collectionId,
        actorUserId: userId,
        actorDisplayName: actorName,
        action: "cards_bulk_deleted",
        cardName: `${snapshots.length} cards`,
        beforeState: snapshots,
        afterState: null,
        meta: { count: snapshots.length },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/app/owned-cards", error);
    const { status, message } = apiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
