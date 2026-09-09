import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCatalogWriteClient } from "@/lib/data/server/catalog-client";
import { toDemoCard, toDemoCollection, toDemoOwnedCard, toDemoProfile, marketPriceMetadata } from "@/lib/data/mappers";
import type { DemoCollection, DemoOwnedCard, DemoProfile } from "@/lib/demo/types";
import type { CardSearchResult } from "@/features/catalog/services/card-api/types";
import type { CardCondition, CardLanguage, Currency } from "@/types/tcg";

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

export async function getSupabaseAppState(supabase: SupabaseClient, userId: string) {
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: collectionRows, error: colErr } = await supabase
    .from("collections")
    .select("*")
    .order("name");
  if (colErr) throw colErr;

  const collectionIds = (collectionRows ?? []).map((c) => c.id);
  let ownedRows: DemoOwnedCard[] = [];

  if (collectionIds.length > 0) {
    const { data: owned, error: ownedErr } = await supabase
      .from("owned_cards")
      .select(
        "id, collection_id, card_id, quantity, condition, language, is_foil, purchase_price, notes, cards(id, game_id, external_id, name, set_code, set_name, collector_number, rarity, image_url, metadata, games(id, slug, name))"
      )
      .in("collection_id", collectionIds);
    if (ownedErr) throw ownedErr;
    ownedRows = ((owned ?? []) as unknown as OwnedJoin[]).map(mapOwned);
  }

  const profile: DemoProfile = profileRow
    ? toDemoProfile({
        userId: profileRow.user_id,
        displayName: profileRow.display_name,
        avatarUrl: profileRow.avatar_url,
        defaultGameId: profileRow.default_game_id,
        currency: profileRow.currency,
        theme: profileRow.theme,
        createdAt: new Date(profileRow.created_at),
        updatedAt: new Date(profileRow.updated_at),
      })
    : {
        displayName: "Collector",
        currency: "USD",
        theme: "dark",
        defaultGameId: null,
      };

  const collections: DemoCollection[] = (collectionRows ?? []).map((c) =>
    toDemoCollection({
      id: c.id,
      userId: c.user_id,
      name: c.name,
      isDefault: c.is_default,
      isFavorite: c.is_favorite ?? false,
      coverImageUrl: c.cover_image_url ?? null,
      createdAt: new Date(c.created_at),
      updatedAt: new Date(c.updated_at),
    })
  );

  const memberByCollection = new Map<
    string,
    { role: "owner" | "editor" | "viewer"; count: number }
  >();

  if (collectionIds.length > 0) {
    const { data: memberRows } = await supabase
      .from("collection_members")
      .select("collection_id, user_id, role")
      .in("collection_id", collectionIds);

    const counts = new Map<string, number>();
    for (const m of memberRows ?? []) {
      counts.set(m.collection_id, (counts.get(m.collection_id) ?? 0) + 1);
      if (m.user_id === userId) {
        memberByCollection.set(m.collection_id, {
          role: m.role as "owner" | "editor" | "viewer",
          count: 0,
        });
      }
    }
    for (const [cid, count] of counts) {
      const existing = memberByCollection.get(cid);
      if (existing) existing.count = count;
      else memberByCollection.set(cid, { role: "viewer", count });
    }
  }

  const enrichedCollections = collections.map((col) => {
    const row = (collectionRows ?? []).find((c) => c.id === col.id);
    const ownerUserId = row?.user_id as string | undefined;
    const isOwner = ownerUserId === userId;
    const membership = memberByCollection.get(col.id);
    const memberCount = membership?.count ?? 0;
    return {
      ...col,
      ownerUserId,
      memberRole: isOwner
        ? ("owner" as const)
        : membership?.role ?? ("viewer" as const),
      isShared: !isOwner || memberCount > 0,
    };
  });

  return {
    profile,
    collections: enrichedCollections,
    ownedCards: ownedRows,
    tags: [] as { id: string; name: string; color: string }[],
  };
}

export async function updateSupabaseProfile(
  supabase: SupabaseClient,
  userId: string,
  updates: Partial<DemoProfile>
) {
  const { error } = await supabase.from("profiles").upsert({
    user_id: userId,
    display_name: updates.displayName,
    currency: updates.currency,
    theme: updates.theme,
    default_game_id: updates.defaultGameId,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function createSupabaseCollection(
  supabase: SupabaseClient,
  userId: string,
  name: string
) {
  type CollectionRow = {
    id: string;
    user_id: string;
    name: string;
    is_default: boolean;
    created_at: string;
    updated_at: string;
  };

  const trimmed = name.trim();

  function mapRow(data: CollectionRow) {
    return toDemoCollection({
      id: data.id,
      userId: data.user_id,
      name: data.name,
      isDefault: data.is_default,
      isFavorite: false,
      coverImageUrl: null,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    });
  }

  // 1) Service role (reliable on Vercel — set SUPABASE_SERVICE_ROLE_KEY)
  const admin = getSupabaseAdmin();
  if (admin) {
    const { data, error } = await admin
      .from("collections")
      .insert({ user_id: userId, name: trimmed, is_default: false })
      .select("id, user_id, name, is_default, created_at, updated_at")
      .single();
    if (error) throw error;
    return mapRow(data);
  }

  const { data, error } = await supabase
    .from("collections")
    .insert({ user_id: userId, name: trimmed, is_default: false })
    .select("id, user_id, name, is_default, created_at, updated_at")
    .single();
  if (error) {
    if (error.message.includes("row-level security")) {
      throw new Error(
        "Sem permissão para criar coleção. Adicione SUPABASE_SERVICE_ROLE_KEY no Vercel."
      );
    }
    throw error;
  }

  return mapRow(data);
}

export async function toggleSupabaseCollectionFavorite(
  supabase: SupabaseClient,
  id: string
) {
  const { data: existing } = await supabase
    .from("collections")
    .select("is_favorite")
    .eq("id", id)
    .single();
  if (!existing) throw new Error("Collection not found");

  const { error } = await supabase
    .from("collections")
    .update({ is_favorite: !existing.is_favorite, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function renameSupabaseCollection(
  supabase: SupabaseClient,
  id: string,
  name: string
) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Collection name is required");

  const { data, error } = await supabase
    .from("collections")
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, user_id, name, is_default, is_favorite, cover_image_url, created_at, updated_at")
    .single();

  if (error) throw error;
  if (!data) throw new Error("Collection not found");

  return toDemoCollection({
    id: data.id,
    userId: data.user_id,
    name: data.name,
    isDefault: data.is_default,
    isFavorite: data.is_favorite ?? false,
    coverImageUrl: data.cover_image_url,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  });
}

export async function deleteSupabaseCollection(
  supabase: SupabaseClient,
  userId: string,
  id: string
) {
  const { data: existing } = await supabase
    .from("collections")
    .select("is_default, user_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing) throw new Error("Collection not found");
  if (existing.is_default) throw new Error("A coleção padrão não pode ser excluída");
  if (existing.user_id !== userId) throw new Error("Only the collection owner can delete");

  const admin = getSupabaseAdmin();
  const client = admin ?? supabase;

  const { error } = await client.from("collections").delete().eq("id", id);
  if (error) throw error;
}

async function resolveStoredMarketPrice(
  _gameSlug: string,
  result: CardSearchResult,
  _currency: Currency
) {
  return {
    price: result.price ?? null,
    metadata: marketPriceMetadata(result.price),
  };
}

async function findOrCreateSupabaseCard(
  supabase: SupabaseClient,
  gameId: string,
  result: CardSearchResult,
  gameSlug: string,
  currency: Currency
): Promise<string> {
  const catalog = getCatalogWriteClient(supabase);
  const { metadata } = await resolveStoredMarketPrice(gameSlug, result, currency);

  if (result.externalId) {
    const { data: existing } = await catalog
      .from("cards")
      .select("id")
      .eq("game_id", gameId)
      .eq("external_id", result.externalId)
      .maybeSingle();
    if (existing) {
      await catalog
        .from("cards")
        .update({
          name: result.name,
          set_code: result.setCode,
          set_name: result.setName,
          collector_number: result.collectorNumber,
          rarity: result.rarity,
          image_url: result.imageUrl,
          metadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      return existing.id;
    }
  }

  const { data: inserted, error } = await catalog
    .from("cards")
    .insert({
      game_id: gameId,
      external_id: result.externalId,
      name: result.name,
      set_code: result.setCode,
      set_name: result.setName,
      collector_number: result.collectorNumber,
      rarity: result.rarity,
      image_url: result.imageUrl,
      metadata,
    })
    .select("id")
    .single();
  if (error) throw error;
  return inserted.id;
}

export async function addSupabaseCardFromSearch(
  supabase: SupabaseClient,
  collectionId: string,
  result: CardSearchResult,
  gameId: string,
  gameSlug: string,
  currency: Currency
): Promise<DemoOwnedCard> {
  const cardId = await findOrCreateSupabaseCard(
    supabase,
    gameId,
    result,
    gameSlug,
    currency
  );

  const ownedSelect =
    "id, collection_id, card_id, quantity, condition, language, is_foil, purchase_price, notes, cards(id, game_id, external_id, name, set_code, set_name, collector_number, rarity, image_url, metadata, games(id, slug, name))";

  if (result.externalId) {
    const { data: existingOwned } = await supabase
      .from("owned_cards")
      .select("id, quantity, cards!inner(external_id, game_id)")
      .eq("collection_id", collectionId);

    const match = (existingOwned ?? []).find((row) => {
      const card = row.cards as unknown as { external_id: string | null; game_id: string };
      return card.external_id === result.externalId && card.game_id === gameId;
    });

    if (match) {
      const nextQty = match.quantity + 1;
      await supabase
        .from("owned_cards")
        .update({
          quantity: nextQty,
          updated_at: new Date().toISOString(),
        })
        .eq("id", match.id);

      const { data: updated, error: fetchErr } = await supabase
        .from("owned_cards")
        .select(ownedSelect)
        .eq("id", match.id)
        .single();
      if (fetchErr) throw fetchErr;
      return mapOwned(updated as unknown as OwnedJoin);
    }
  }

  const { data: inserted, error } = await supabase
    .from("owned_cards")
    .insert({
      collection_id: collectionId,
      card_id: cardId,
      quantity: 1,
      condition: "NM",
      language: "EN",
      is_foil: false,
    })
    .select(ownedSelect)
    .single();
  if (error) throw error;
  return mapOwned(inserted as unknown as OwnedJoin);
}

export async function updateSupabaseOwnedCard(
  supabase: SupabaseClient,
  id: string,
  updates: {
    quantity?: number;
    condition?: CardCondition;
    language?: CardLanguage;
    isFoil?: boolean;
    purchasePrice?: number | null;
    notes?: string | null;
    card?: {
      marketPrice?: number | null;
      rarity?: string | null;
      setName?: string | null;
      setCode?: string | null;
      collectorNumber?: string | null;
      imageUrl?: string | null;
      externalId?: string | null;
    };
  }
) {
  const { data: ownedRow, error: ownedFetchError } = await supabase
    .from("owned_cards")
    .select("id, card_id")
    .eq("id", id)
    .maybeSingle();
  if (ownedFetchError) throw ownedFetchError;
  if (!ownedRow) throw new Error("Owned card not found");

  const ownedPayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.quantity !== undefined) ownedPayload.quantity = updates.quantity;
  if (updates.condition !== undefined) ownedPayload.condition = updates.condition;
  if (updates.language !== undefined) ownedPayload.language = updates.language;
  if (updates.isFoil !== undefined) ownedPayload.is_foil = updates.isFoil;
  if (updates.purchasePrice !== undefined) ownedPayload.purchase_price = updates.purchasePrice;
  if (updates.notes !== undefined) ownedPayload.notes = updates.notes;

  const hasOwnedFieldUpdates = Object.keys(ownedPayload).length > 1;
  if (hasOwnedFieldUpdates || updates.card) {
    const { error } = await supabase.from("owned_cards").update(ownedPayload).eq("id", id);
    if (error) throw error;
  }

  if (updates.card?.marketPrice !== undefined) {
    const catalog = getCatalogWriteClient(supabase);
    const { error } = await catalog
      .from("cards")
      .update({
        metadata: marketPriceMetadata(updates.card.marketPrice),
        updated_at: new Date().toISOString(),
      })
      .eq("id", ownedRow.card_id);
    if (error) throw error;
  }

  const cardPayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.card?.rarity !== undefined) cardPayload.rarity = updates.card.rarity;
  if (updates.card?.setName !== undefined) cardPayload.set_name = updates.card.setName;
  if (updates.card?.setCode !== undefined) cardPayload.set_code = updates.card.setCode;
  if (updates.card?.collectorNumber !== undefined) {
    cardPayload.collector_number = updates.card.collectorNumber;
  }
  if (updates.card?.imageUrl !== undefined) cardPayload.image_url = updates.card.imageUrl;

  if (!updates.card || Object.keys(cardPayload).length <= 1) return;

  const catalog = getCatalogWriteClient(supabase);
  let targetCardId = ownedRow.card_id;

  if (updates.card.externalId !== undefined) {
    const { data: currentCard, error: currentCardError } = await catalog
      .from("cards")
      .select("game_id")
      .eq("id", targetCardId)
      .maybeSingle();
    if (currentCardError) throw currentCardError;

    if (currentCard) {
      const { data: existingCard, error: existingError } = await catalog
        .from("cards")
        .select("id")
        .eq("game_id", currentCard.game_id)
        .eq("external_id", updates.card.externalId)
        .maybeSingle();
      if (existingError) throw existingError;

      if (existingCard && existingCard.id !== targetCardId) {
        targetCardId = existingCard.id;
        const { error: relinkError } = await supabase
          .from("owned_cards")
          .update({ card_id: existingCard.id, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (relinkError) throw relinkError;
      } else {
        cardPayload.external_id = updates.card.externalId;
      }
    }
  }

  const { error: cardUpdateError } = await catalog
    .from("cards")
    .update(cardPayload)
    .eq("id", targetCardId);
  if (cardUpdateError) throw cardUpdateError;
}

export async function deleteSupabaseOwnedCards(supabase: SupabaseClient, ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabase.from("owned_cards").delete().in("id", ids);
  if (error) throw error;
}

export async function importSupabaseFromSearchResults(
  supabase: SupabaseClient,
  collectionId: string,
  items: Array<{
    result: CardSearchResult;
    quantity: number;
    gameId: string;
    gameSlug: string;
  }>,
  mergeDuplicates: boolean,
  currency: Currency
) {
  let imported = 0;

  for (const item of items) {
    const { result, quantity, gameId, gameSlug } = item;
    const cardId = await findOrCreateSupabaseCard(
      supabase,
      gameId,
      result,
      gameSlug,
      currency
    );

    if (mergeDuplicates) {
      const { data: existingOwned } = await supabase
        .from("owned_cards")
        .select("id, quantity, card_id")
        .eq("collection_id", collectionId)
        .eq("card_id", cardId)
        .maybeSingle();

      if (existingOwned) {
        await supabase
          .from("owned_cards")
          .update({
            quantity: existingOwned.quantity + quantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingOwned.id);
        imported += quantity;
        continue;
      }
    }

    const { error } = await supabase.from("owned_cards").insert({
      collection_id: collectionId,
      card_id: cardId,
      quantity,
      condition: "NM",
      language: "EN",
      is_foil: false,
    });
    if (error) throw error;
    imported += quantity;
  }

  return imported;
}

export async function importSupabaseRows(
  supabase: SupabaseClient,
  collectionId: string,
  rows: Array<{
    name: string;
    set?: string;
    quantity: number;
    condition: CardCondition;
    language: CardLanguage;
    gameId: string;
    isFoil?: boolean;
    purchasePrice?: number;
  }>,
  mergeDuplicates: boolean
) {
  let imported = 0;
  for (const row of rows) {
    if (mergeDuplicates) {
      const { data: existing } = await supabase
        .from("owned_cards")
        .select("id, quantity, cards!inner(name, set_name, game_id)")
        .eq("collection_id", collectionId)
        .eq("cards.game_id", row.gameId);

      const dup = (existing ?? []).find((e) => {
          const card = e.cards as unknown as { name: string; set_name: string | null };
          return (
            card.name.toLowerCase() === row.name.toLowerCase() &&
            (card.set_name ?? "").toLowerCase() === (row.set ?? "").toLowerCase()
          );
        });

      if (dup) {
        await supabase
          .from("owned_cards")
          .update({ quantity: dup.quantity + row.quantity })
          .eq("id", dup.id);
        imported++;
        continue;
      }
    }

    const catalog = getCatalogWriteClient(supabase);
    const { data: cardRow, error: cardErr } = await catalog
      .from("cards")
      .insert({ game_id: row.gameId, name: row.name, set_name: row.set ?? null })
      .select("id")
      .single();
    if (cardErr) throw cardErr;

    const { error } = await supabase.from("owned_cards").insert({
      collection_id: collectionId,
      card_id: cardRow.id,
      quantity: row.quantity,
      condition: row.condition,
      language: row.language,
      is_foil: row.isFoil ?? false,
      purchase_price: row.purchasePrice,
    });
    if (error) throw error;
    imported++;
  }
  return imported;
}
