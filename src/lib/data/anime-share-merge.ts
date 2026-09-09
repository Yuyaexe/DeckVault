import type { AnimeCharacter, AnimeSeries } from "@/features/anime-collection/types";
import type { AnimeCardTombstone, AnimeCharacterCard } from "@/lib/demo/types";

export type { AnimeCardTombstone };

/**
 * Product rules (anime share conflict resolution):
 * 1. If A removes a card and B still has a stale copy → removal wins.
 * 2. If B adds a new card (not in base) → addition wins.
 * 3. If B removes and A still has a stale copy → removal wins.
 * 4. Re-add after removal only counts as a fresh add (!inBase && present).
 * 5. Tombstones reinforce removals when a peer pushes a stale snapshot.
 */

export interface AnimeWorkspaceSnapshotState {
  animeSeries: AnimeSeries[];
  animeCharacters: AnimeCharacter[];
  animeCharacterCards: AnimeCharacterCard[];
  animeBinderLayoutByCharacter: Record<string, (string | null)[]>;
  animeCardTombstones?: AnimeCardTombstone[];
  /** Confirmed character deletions — key = animeCharacterSyncKey */
  animeCharacterTombstones?: AnimeCardTombstone[];
  /** Confirmed series deletions — key = animeSeriesSyncKey */
  animeSeriesTombstones?: AnimeCardTombstone[];
}

const TOMBSTONE_TTL_MS = 180 * 24 * 60 * 60 * 1000;

export function animeCardSyncKey(entry: {
  characterId: string;
  card: { gameSlug: string; externalId: string | null; name: string };
}): string {
  const external = entry.card.externalId?.trim() || entry.card.name.trim().toLowerCase();
  return `${entry.characterId}|${entry.card.gameSlug}|${external}`;
}

export function emptyAnimeSnapshot(): AnimeWorkspaceSnapshotState {
  return {
    animeSeries: [],
    animeCharacters: [],
    animeCharacterCards: [],
    animeBinderLayoutByCharacter: {},
    animeCardTombstones: [],
    animeCharacterTombstones: [],
    animeSeriesTombstones: [],
  };
}

export function normalizeAnimeSnapshot(
  state: AnimeWorkspaceSnapshotState | null | undefined
): AnimeWorkspaceSnapshotState {
  if (!state) return emptyAnimeSnapshot();
  return {
    animeSeries: state.animeSeries ?? [],
    animeCharacters: state.animeCharacters ?? [],
    animeCharacterCards: state.animeCharacterCards ?? [],
    animeBinderLayoutByCharacter: state.animeBinderLayoutByCharacter ?? {},
    animeCardTombstones: normalizeTombstones(state.animeCardTombstones),
    animeCharacterTombstones: normalizeTombstones(state.animeCharacterTombstones),
    animeSeriesTombstones: normalizeTombstones(state.animeSeriesTombstones),
  };
}

export function normalizeTombstones(
  list: AnimeCardTombstone[] | null | undefined
): AnimeCardTombstone[] {
  const byKey = new Map<string, AnimeCardTombstone>();
  for (const raw of list ?? []) {
    if (!raw?.key || !raw.deletedAt) continue;
    const prev = byKey.get(raw.key);
    if (!prev || raw.deletedAt > prev.deletedAt) {
      byKey.set(raw.key, { key: raw.key, deletedAt: raw.deletedAt });
    }
  }
  return [...byKey.values()];
}

export function upsertTombstone(
  list: AnimeCardTombstone[] | null | undefined,
  key: string,
  deletedAt: string = new Date().toISOString()
): AnimeCardTombstone[] {
  const next = normalizeTombstones(list).filter((t) => t.key !== key);
  next.push({ key, deletedAt });
  return next;
}

export function clearTombstone(
  list: AnimeCardTombstone[] | null | undefined,
  key: string
): AnimeCardTombstone[] {
  return normalizeTombstones(list).filter((t) => t.key !== key);
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) map.set(item.id, item);
  return [...map.values()];
}

/**
 * Remap local series/character UUIDs onto the canonical (cloud) IDs by slug + name.
 * Prevents 3-way merge from treating "same Yuya, different id" as delete+add,
 * which drops cards on the shared character and can push that wipe to the cloud.
 */
export function alignAnimeStateToCanonical(
  sourceInput: AnimeWorkspaceSnapshotState | null | undefined,
  canonicalInput: AnimeWorkspaceSnapshotState | null | undefined
): AnimeWorkspaceSnapshotState {
  const source = normalizeAnimeSnapshot(sourceInput);
  const canonical = normalizeAnimeSnapshot(canonicalInput);
  if (canonical.animeSeries.length === 0 && canonical.animeCharacters.length === 0) {
    return source;
  }

  const seriesIdMap = new Map<string, string>();
  const canonicalSeriesBySlug = new Map(
    canonical.animeSeries.map((s) => [s.slug.trim().toLowerCase(), s] as const)
  );
  const canonicalSeriesByName = new Map(
    canonical.animeSeries.map((s) => [s.name.trim().toLowerCase(), s] as const)
  );

  for (const series of source.animeSeries) {
    const match =
      canonicalSeriesBySlug.get(series.slug.trim().toLowerCase()) ??
      canonicalSeriesByName.get(series.name.trim().toLowerCase());
    if (match) seriesIdMap.set(series.id, match.id);
  }

  const charIdMap = new Map<string, string>();
  for (const character of source.animeCharacters) {
    const seriesId = seriesIdMap.get(character.seriesId) ?? character.seriesId;
    const match = canonical.animeCharacters.find(
      (c) =>
        c.seriesId === seriesId &&
        c.name.trim().toLowerCase() === character.name.trim().toLowerCase()
    );
    if (match) charIdMap.set(character.id, match.id);
  }

  if (seriesIdMap.size === 0 && charIdMap.size === 0) return source;

  const animeSeries = dedupeById(
    source.animeSeries.map((series) => {
      const id = seriesIdMap.get(series.id);
      if (!id) return series;
      const canon = canonical.animeSeries.find((s) => s.id === id);
      return canon
        ? {
            ...series,
            id: canon.id,
            slug: canon.slug,
          }
        : series;
    })
  );

  const animeCharacters = dedupeById(
    source.animeCharacters.map((character) => {
      const id = charIdMap.get(character.id) ?? character.id;
      const seriesId = seriesIdMap.get(character.seriesId) ?? character.seriesId;
      return { ...character, id, seriesId };
    })
  );

  const animeCharacterCards = dedupeAnimeCards(
    source.animeCharacterCards.map((entry) => {
      const characterId = charIdMap.get(entry.characterId) ?? entry.characterId;
      return characterId === entry.characterId ? entry : { ...entry, characterId };
    })
  );

  const animeBinderLayoutByCharacter: Record<string, (string | null)[]> = {};
  for (const [characterId, layout] of Object.entries(
    source.animeBinderLayoutByCharacter ?? {}
  )) {
    const nextId = charIdMap.get(characterId) ?? characterId;
    animeBinderLayoutByCharacter[nextId] = layout;
  }

  const animeCardTombstones = normalizeTombstones(source.animeCardTombstones).map((t) => {
    const parts = t.key.split("|");
    if (parts.length < 3) return t;
    const [oldCharId, ...rest] = parts;
    const nextCharId = charIdMap.get(oldCharId!) ?? oldCharId!;
    if (nextCharId === oldCharId) return t;
    return { ...t, key: [nextCharId, ...rest].join("|") };
  });

  return {
    animeSeries,
    animeCharacters,
    animeCharacterCards,
    animeBinderLayoutByCharacter,
    animeCardTombstones,
    // Character tombstones use seriesSlug::name — already stable across UUID remaps.
    animeCharacterTombstones: normalizeTombstones(source.animeCharacterTombstones),
    animeSeriesTombstones: normalizeTombstones(source.animeSeriesTombstones),
  };
}

export function mergeTombstoneLists(
  ...lists: Array<AnimeCardTombstone[] | null | undefined>
): AnimeCardTombstone[] {
  const byKey = new Map<string, AnimeCardTombstone>();
  for (const list of lists) {
    for (const t of normalizeTombstones(list)) {
      const prev = byKey.get(t.key);
      if (!prev || t.deletedAt > prev.deletedAt) byKey.set(t.key, t);
    }
  }
  return [...byKey.values()];
}

function pruneTombstones(
  tombstones: AnimeCardTombstone[],
  liveKeys: Set<string>,
  nowMs: number = Date.now()
): AnimeCardTombstone[] {
  return tombstones.filter((t) => {
    if (liveKeys.has(t.key)) return false;
    const deletedMs = Date.parse(t.deletedAt);
    if (!Number.isFinite(deletedMs)) return true;
    return nowMs - deletedMs <= TOMBSTONE_TTL_MS;
  });
}

function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function indexCards(cards: AnimeCharacterCard[]): Map<string, AnimeCharacterCard> {
  const map = new Map<string, AnimeCharacterCard>();
  for (const card of cards) {
    const key = animeCardSyncKey(card);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, card);
      continue;
    }
    // Same logical card twice (e.g. after ID align) — keep richer row.
    const qty = Math.max(prev.quantity, card.quantity);
    const touched = [prev.lastTouchedAt, card.lastTouchedAt].filter(Boolean).sort().at(-1);
    map.set(key, {
      ...prev,
      ...card,
      id: prev.id,
      quantity: qty,
      lastTouchedAt: touched,
      card: {
        ...prev.card,
        ...card.card,
        imageUrl: card.card.imageUrl ?? prev.card.imageUrl,
        rarity: card.card.rarity ?? prev.card.rarity,
        setName: card.card.setName ?? prev.card.setName,
        type: card.card.type ?? prev.card.type,
        cardTraderBlueprintId:
          card.card.cardTraderBlueprintId ?? prev.card.cardTraderBlueprintId,
      },
    });
  }
  return map;
}

/** Collapse duplicate sync-keys after character-id remapping. */
export function dedupeAnimeCards(cards: AnimeCharacterCard[]): AnimeCharacterCard[] {
  return [...indexCards(cards).values()];
}

/**
 * True when pushing `candidate` would drop cloud cards without a matching tombstone.
 * Blocks the classic wipe where a peer push erases the owner's cards.
 */
export function wouldWipeRemoteCards(
  candidate: AnimeWorkspaceSnapshotState,
  remote: AnimeWorkspaceSnapshotState
): boolean {
  const cand = normalizeAnimeSnapshot(candidate);
  const rem = normalizeAnimeSnapshot(remote);
  const candKeys = new Set(cand.animeCharacterCards.map((c) => animeCardSyncKey(c)));
  const tombs = new Set((cand.animeCardTombstones ?? []).map((t) => t.key));
  for (const card of rem.animeCharacterCards) {
    const key = animeCardSyncKey(card);
    if (!candKeys.has(key) && !tombs.has(key)) return true;
  }
  return false;
}

export function animeSeriesSyncKey(series: AnimeSeries): string {
  const slug = series.slug.trim().toLowerCase();
  if (slug) return `slug:${slug}`;
  return `name:${series.name.trim().toLowerCase()}`;
}

export function animeCharacterSyncKey(
  character: Pick<AnimeCharacter, "seriesId" | "name">,
  seriesById: Map<string, AnimeSeries>
): string {
  const series = seriesById.get(character.seriesId);
  const seriesPart = series
    ? animeSeriesSyncKey(series)
    : `id:${character.seriesId}`;
  return `${seriesPart}::${character.name.trim().toLowerCase()}`;
}

/**
 * Re-attach local-only series / characters / cards onto a remote snapshot.
 * Used when we fall back to "prefer remote" so local-only characters are not wiped.
 */
export function unionLocalOnlyAnimeOnto(
  remoteInput: AnimeWorkspaceSnapshotState,
  localInput: AnimeWorkspaceSnapshotState
): AnimeWorkspaceSnapshotState {
  const remote = normalizeAnimeSnapshot(remoteInput);
  const local = alignAnimeStateToCanonical(normalizeAnimeSnapshot(localInput), remote);

  const animeCharacterTombstones = mergeTombstoneLists(
    remote.animeCharacterTombstones,
    local.animeCharacterTombstones
  );
  const animeSeriesTombstones = mergeTombstoneLists(
    remote.animeSeriesTombstones,
    local.animeSeriesTombstones
  );
  const charTombKeys = new Set(animeCharacterTombstones.map((t) => t.key));
  const seriesTombKeys = new Set(animeSeriesTombstones.map((t) => t.key));

  const remoteSeriesKeys = new Set(remote.animeSeries.map(animeSeriesSyncKey));
  const animeSeries = dedupeById([
    ...remote.animeSeries.filter((s) => !seriesTombKeys.has(animeSeriesSyncKey(s))),
    ...local.animeSeries.filter((s) => {
      const key = animeSeriesSyncKey(s);
      if (seriesTombKeys.has(key)) return false;
      return !remoteSeriesKeys.has(key);
    }),
  ]);
  const seriesById = new Map(animeSeries.map((s) => [s.id, s] as const));
  const remoteSeriesById = new Map(remote.animeSeries.map((s) => [s.id, s] as const));

  const remoteCharKeys = new Set(
    remote.animeCharacters.map((c) => animeCharacterSyncKey(c, remoteSeriesById))
  );
  const animeCharacters = dedupeById([
    ...remote.animeCharacters.filter(
      (c) => !charTombKeys.has(animeCharacterSyncKey(c, remoteSeriesById))
    ),
    ...local.animeCharacters.filter((c) => {
      if (!seriesById.has(c.seriesId)) return false;
      const key = animeCharacterSyncKey(c, seriesById);
      if (charTombKeys.has(key)) return false;
      return !remoteCharKeys.has(key);
    }),
  ]);
  const characterIds = new Set(animeCharacters.map((c) => c.id));

  const remoteCardKeys = new Set(remote.animeCharacterCards.map((c) => animeCardSyncKey(c)));
  const animeCharacterCards = dedupeAnimeCards([
    ...remote.animeCharacterCards,
    ...local.animeCharacterCards.filter(
      (c) => characterIds.has(c.characterId) && !remoteCardKeys.has(animeCardSyncKey(c))
    ),
  ]);

  const animeBinderLayoutByCharacter: Record<string, (string | null)[]> = {
    ...remote.animeBinderLayoutByCharacter,
  };
  for (const [characterId, layout] of Object.entries(local.animeBinderLayoutByCharacter)) {
    if (!characterIds.has(characterId)) continue;
    if (!animeBinderLayoutByCharacter[characterId]?.length) {
      animeBinderLayoutByCharacter[characterId] = layout;
    }
  }

  return {
    animeSeries,
    animeCharacters,
    animeCharacterCards,
    animeBinderLayoutByCharacter,
    animeCardTombstones: mergeTombstoneLists(
      remote.animeCardTombstones,
      local.animeCardTombstones
    ),
    animeCharacterTombstones,
    animeSeriesTombstones,
  };
}

/** True when local has series, characters, or cards the remote snapshot lacks. */
export function hasLocalOnlyAnimeContent(
  localInput: AnimeWorkspaceSnapshotState,
  remoteInput: AnimeWorkspaceSnapshotState
): boolean {
  const remote = normalizeAnimeSnapshot(remoteInput);
  const local = alignAnimeStateToCanonical(normalizeAnimeSnapshot(localInput), remote);

  const remoteSeriesKeys = new Set(remote.animeSeries.map(animeSeriesSyncKey));
  if (local.animeSeries.some((s) => !remoteSeriesKeys.has(animeSeriesSyncKey(s)))) {
    return true;
  }

  const remoteSeriesById = new Map(remote.animeSeries.map((s) => [s.id, s] as const));
  const localSeriesById = new Map(local.animeSeries.map((s) => [s.id, s] as const));
  const remoteCharKeys = new Set(
    remote.animeCharacters.map((c) => animeCharacterSyncKey(c, remoteSeriesById))
  );
  if (
    local.animeCharacters.some(
      (c) => !remoteCharKeys.has(animeCharacterSyncKey(c, localSeriesById))
    )
  ) {
    return true;
  }

  const remoteCardKeys = new Set(remote.animeCharacterCards.map((c) => animeCardSyncKey(c)));
  return local.animeCharacterCards.some((c) => !remoteCardKeys.has(animeCardSyncKey(c)));
}

/** True when local confirmed character/series deletes that still appear on remote. */
export function hasPendingCharacterDeletes(
  localInput: AnimeWorkspaceSnapshotState,
  remoteInput: AnimeWorkspaceSnapshotState
): boolean {
  const remote = normalizeAnimeSnapshot(remoteInput);
  const local = normalizeAnimeSnapshot(localInput);

  const charTombs = local.animeCharacterTombstones ?? [];
  if (charTombs.length > 0) {
    const remoteSeriesById = new Map(remote.animeSeries.map((s) => [s.id, s] as const));
    const remoteKeys = new Set(
      remote.animeCharacters.map((c) => animeCharacterSyncKey(c, remoteSeriesById))
    );
    if (charTombs.some((t) => remoteKeys.has(t.key))) return true;
  }

  const seriesTombs = local.animeSeriesTombstones ?? [];
  if (seriesTombs.length > 0) {
    const remoteKeys = new Set(remote.animeSeries.map(animeSeriesSyncKey));
    if (seriesTombs.some((t) => remoteKeys.has(t.key))) return true;
  }

  return false;
}

/** True when local card tombstones still match cards present on remote. */
export function hasPendingCardDeletes(
  localInput: AnimeWorkspaceSnapshotState,
  remoteInput: AnimeWorkspaceSnapshotState
): boolean {
  const remote = normalizeAnimeSnapshot(remoteInput);
  const local = normalizeAnimeSnapshot(localInput);
  const tombs = local.animeCardTombstones ?? [];
  if (tombs.length === 0) return false;
  const remoteKeys = new Set(remote.animeCharacterCards.map((c) => animeCardSyncKey(c)));
  return tombs.some((t) => remoteKeys.has(t.key));
}

/** Any confirmed delete (card / character / series) still pending against remote. */
export function hasPendingConfirmedDeletes(
  localInput: AnimeWorkspaceSnapshotState,
  remoteInput: AnimeWorkspaceSnapshotState
): boolean {
  return (
    hasPendingCardDeletes(localInput, remoteInput) ||
    hasPendingCharacterDeletes(localInput, remoteInput)
  );
}

/** Classic 3-way presence for entities keyed by id. */
function threeWayEntities<T extends { id: string }>(
  base: T[],
  cloud: T[],
  local: T[],
  mergeBoth: (baseItem: T | undefined, cloudItem: T, localItem: T) => T
): T[] {
  const bMap = indexById(base);
  const cMap = indexById(cloud);
  const lMap = indexById(local);
  const keys = new Set([...bMap.keys(), ...cMap.keys(), ...lMap.keys()]);
  const out: T[] = [];

  for (const id of keys) {
    const b = bMap.get(id);
    const c = cMap.get(id);
    const l = lMap.get(id);

    if (b && c && l) {
      out.push(mergeBoth(b, c, l));
    } else if (b && c && !l) {
      // local removed
    } else if (b && !c && l) {
      // cloud removed
    } else if (b && !c && !l) {
      // both removed
    } else if (!b && c && l) {
      out.push(mergeBoth(undefined, c, l));
    } else if (!b && c && !l) {
      out.push(c);
    } else if (!b && !c && l) {
      out.push(l);
    }
  }

  return out;
}

function mergeSeriesFields(
  baseItem: AnimeSeries | undefined,
  cloudItem: AnimeSeries,
  localItem: AnimeSeries
): AnimeSeries {
  if (!baseItem) {
    return {
      ...cloudItem,
      name: localItem.name || cloudItem.name,
      coverImageUrl: localItem.coverImageUrl ?? cloudItem.coverImageUrl,
      coverColor: localItem.coverColor ?? cloudItem.coverColor,
    };
  }
  return {
    ...cloudItem,
    name:
      localItem.name !== baseItem.name
        ? localItem.name
        : cloudItem.name !== baseItem.name
          ? cloudItem.name
          : localItem.name,
    coverImageUrl: pickChanged(
      baseItem.coverImageUrl,
      cloudItem.coverImageUrl,
      localItem.coverImageUrl
    ),
    coverColor: pickChanged(baseItem.coverColor, cloudItem.coverColor, localItem.coverColor),
    sortOrder: pickChanged(baseItem.sortOrder, cloudItem.sortOrder, localItem.sortOrder) ?? 0,
  };
}

function mergeCharacterFields(
  baseItem: AnimeCharacter | undefined,
  cloudItem: AnimeCharacter,
  localItem: AnimeCharacter
): AnimeCharacter {
  if (!baseItem) {
    return {
      ...cloudItem,
      name: localItem.name || cloudItem.name,
      imageUrl: localItem.imageUrl ?? cloudItem.imageUrl,
      accentColor: localItem.accentColor ?? cloudItem.accentColor,
    };
  }
  return {
    ...cloudItem,
    seriesId:
      localItem.seriesId !== baseItem.seriesId
        ? localItem.seriesId
        : cloudItem.seriesId !== baseItem.seriesId
          ? cloudItem.seriesId
          : localItem.seriesId,
    name:
      localItem.name !== baseItem.name
        ? localItem.name
        : cloudItem.name !== baseItem.name
          ? cloudItem.name
          : localItem.name,
    imageUrl: pickChanged(baseItem.imageUrl, cloudItem.imageUrl, localItem.imageUrl),
    accentColor: pickChanged(
      baseItem.accentColor,
      cloudItem.accentColor,
      localItem.accentColor
    ),
    sortOrder: pickChanged(baseItem.sortOrder, cloudItem.sortOrder, localItem.sortOrder) ?? 0,
  };
}

function pickChanged<T>(base: T, cloud: T, local: T): T {
  if (local !== base && cloud === base) return local;
  if (cloud !== base && local === base) return cloud;
  if (local !== base) return local;
  return cloud;
}

function mergeCardFields(
  baseItem: AnimeCharacterCard | undefined,
  cloudItem: AnimeCharacterCard,
  localItem: AnimeCharacterCard
): AnimeCharacterCard {
  const touched = [cloudItem.lastTouchedAt, localItem.lastTouchedAt]
    .filter(Boolean)
    .sort()
    .at(-1);

  if (!baseItem) {
    // Same logical card on both sides with no shared base (cold boot / align).
    // Never SUM — that doubles every card (1+1→2) on each empty-base merge.
    // Concurrent independent adds of the same print are rare; max is the safe rule.
    return {
      ...cloudItem,
      quantity: Math.max(cloudItem.quantity, localItem.quantity),
      condition: localItem.condition || cloudItem.condition,
      language: localItem.language || cloudItem.language,
      isFoil: localItem.isFoil || cloudItem.isFoil,
      lastTouchedAt: touched,
      card: {
        ...cloudItem.card,
        imageUrl: localItem.card.imageUrl ?? cloudItem.card.imageUrl,
        rarity: localItem.card.rarity ?? cloudItem.card.rarity,
        setName: localItem.card.setName ?? cloudItem.card.setName,
        type: localItem.card.type ?? cloudItem.card.type,
        cardTraderBlueprintId:
          localItem.card.cardTraderBlueprintId ?? cloudItem.card.cardTraderBlueprintId,
      },
    };
  }

  let quantity = baseItem.quantity;
  const cloudChanged = cloudItem.quantity !== baseItem.quantity;
  const localChanged = localItem.quantity !== baseItem.quantity;
  if (cloudChanged && localChanged) quantity = Math.max(cloudItem.quantity, localItem.quantity);
  else if (localChanged) quantity = localItem.quantity;
  else if (cloudChanged) quantity = cloudItem.quantity;

  return {
    ...cloudItem,
    id: cloudItem.id,
    quantity: Math.max(1, quantity),
    condition: pickChanged(baseItem.condition, cloudItem.condition, localItem.condition),
    language: pickChanged(baseItem.language, cloudItem.language, localItem.language),
    isFoil: pickChanged(baseItem.isFoil, cloudItem.isFoil, localItem.isFoil),
    sortOrder: pickChanged(baseItem.sortOrder, cloudItem.sortOrder, localItem.sortOrder),
    lastTouchedAt: touched ?? baseItem.lastTouchedAt,
    card: {
      ...cloudItem.card,
      name: pickChanged(baseItem.card.name, cloudItem.card.name, localItem.card.name),
      imageUrl: pickChanged(
        baseItem.card.imageUrl,
        cloudItem.card.imageUrl,
        localItem.card.imageUrl
      ),
      rarity: pickChanged(baseItem.card.rarity, cloudItem.card.rarity, localItem.card.rarity),
      setName: pickChanged(
        baseItem.card.setName,
        cloudItem.card.setName,
        localItem.card.setName
      ),
      type: pickChanged(baseItem.card.type, cloudItem.card.type, localItem.card.type),
      cardTraderBlueprintId: pickChanged(
        baseItem.card.cardTraderBlueprintId,
        cloudItem.card.cardTraderBlueprintId,
        localItem.card.cardTraderBlueprintId
      ),
    },
  };
}

function threeWayCards(
  base: AnimeCharacterCard[],
  cloud: AnimeCharacterCard[],
  local: AnimeCharacterCard[],
  tombstones: AnimeCardTombstone[]
): { cards: AnimeCharacterCard[]; removedKeys: string[] } {
  const bMap = indexCards(base);
  const cMap = indexCards(cloud);
  const lMap = indexCards(local);
  const tombByKey = new Map(tombstones.map((t) => [t.key, t]));
  const keys = new Set([...bMap.keys(), ...cMap.keys(), ...lMap.keys(), ...tombByKey.keys()]);
  const cards: AnimeCharacterCard[] = [];
  const removedKeys: string[] = [];

  for (const key of keys) {
    const b = bMap.get(key);
    const c = cMap.get(key);
    const l = lMap.get(key);
    const tomb = tombByKey.get(key);

    let keep: AnimeCharacterCard | null = null;

    if (b && c && l) {
      keep = mergeCardFields(b, c, l);
    } else if (b && c && !l) {
      keep = null;
      removedKeys.push(key);
    } else if (b && !c && l) {
      keep = null;
      removedKeys.push(key);
    } else if (b && !c && !l) {
      keep = null;
      removedKeys.push(key);
    } else if (!b && c && l) {
      keep = mergeCardFields(undefined, c, l);
    } else if (!b && c && !l) {
      keep = c;
    } else if (!b && !c && l) {
      keep = l;
    }

    // Tombstone = confirmed delete. Wins over cloud/base presence.
    // Only a LOCAL re-add (card still present locally, touched after the tomb) revives it.
    if (tomb) {
      const localTouched = l?.lastTouchedAt;
      if (l && localTouched && localTouched > tomb.deletedAt) {
        keep = keep ?? l;
      } else {
        keep = null;
        removedKeys.push(key);
      }
    }

    if (keep) cards.push(keep);
  }

  return { cards, removedKeys };
}

function mergeBinderLayouts(
  base: Record<string, (string | null)[]>,
  cloud: Record<string, (string | null)[]>,
  local: Record<string, (string | null)[]>,
  cards: AnimeCharacterCard[]
): Record<string, (string | null)[]> {
  const byCharacter = new Map<string, string[]>();
  for (const card of cards) {
    const list = byCharacter.get(card.characterId) ?? [];
    list.push(card.id);
    byCharacter.set(card.characterId, list);
  }

  const characterIds = new Set([
    ...Object.keys(base),
    ...Object.keys(cloud),
    ...Object.keys(local),
    ...byCharacter.keys(),
  ]);

  const out: Record<string, (string | null)[]> = {};
  for (const characterId of characterIds) {
    const surviving = new Set(byCharacter.get(characterId) ?? []);
    if (surviving.size === 0) continue;

    const baseLayout = base[characterId] ?? [];
    const cloudLayout = cloud[characterId] ?? [];
    const localLayout = local[characterId] ?? [];

    const baseSameAsCloud =
      JSON.stringify(baseLayout) === JSON.stringify(cloudLayout);
    const preferred = !baseSameAsCloud
      ? cloudLayout
      : JSON.stringify(baseLayout) !== JSON.stringify(localLayout)
        ? localLayout
        : cloudLayout.length
          ? cloudLayout
          : localLayout;

    const merged: (string | null)[] = [];
    const placed = new Set<string>();
    for (const slot of preferred) {
      if (slot == null) {
        merged.push(null);
        continue;
      }
      if (surviving.has(slot) && !placed.has(slot)) {
        merged.push(slot);
        placed.add(slot);
      }
    }
    for (const id of surviving) {
      if (!placed.has(id)) merged.push(id);
    }
    out[characterId] = merged;
  }
  return out;
}

/**
 * 3-way merge of anime workspace snapshots with card tombstones.
 * `base` = last commonly acknowledged snapshot (last successful sync).
 */
export function threeWayMergeAnimeState(
  baseInput: AnimeWorkspaceSnapshotState | null | undefined,
  cloudInput: AnimeWorkspaceSnapshotState | null | undefined,
  localInput: AnimeWorkspaceSnapshotState | null | undefined
): AnimeWorkspaceSnapshotState {
  const cloud = normalizeAnimeSnapshot(cloudInput);
  // Align UUIDs to cloud so "Yuya" locally !== "Yuya" remotely doesn't wipe cards.
  const base = alignAnimeStateToCanonical(normalizeAnimeSnapshot(baseInput), cloud);
  const local = alignAnimeStateToCanonical(normalizeAnimeSnapshot(localInput), cloud);

  const mergedTombstones = mergeTombstoneLists(
    base.animeCardTombstones,
    cloud.animeCardTombstones,
    local.animeCardTombstones
  );
  const mergedCharTombstones = mergeTombstoneLists(
    base.animeCharacterTombstones,
    cloud.animeCharacterTombstones,
    local.animeCharacterTombstones
  );
  const mergedSeriesTombstones = mergeTombstoneLists(
    base.animeSeriesTombstones,
    cloud.animeSeriesTombstones,
    local.animeSeriesTombstones
  );

  const localSeriesKeys = new Set(local.animeSeries.map(animeSeriesSyncKey));
  let animeSeries = threeWayEntities(
    base.animeSeries,
    cloud.animeSeries,
    local.animeSeries,
    mergeSeriesFields
  );
  const clearedSeriesTombs = new Set<string>();
  animeSeries = animeSeries.filter((s) => {
    const key = animeSeriesSyncKey(s);
    const tomb = mergedSeriesTombstones.find((t) => t.key === key);
    if (!tomb) return true;
    if (localSeriesKeys.has(key)) {
      clearedSeriesTombs.add(key);
      return true;
    }
    return false;
  });
  const seriesIds = new Set(animeSeries.map((s) => s.id));
  const seriesById = new Map(animeSeries.map((s) => [s.id, s] as const));
  const localSeriesById = new Map(local.animeSeries.map((s) => [s.id, s] as const));
  const localCharKeys = new Set(
    local.animeCharacters.map((c) => animeCharacterSyncKey(c, localSeriesById))
  );

  let animeCharacters = threeWayEntities(
    base.animeCharacters,
    cloud.animeCharacters,
    local.animeCharacters,
    mergeCharacterFields
  ).filter((c) => seriesIds.has(c.seriesId));

  // Confirmed character deletes win over cloud reappearance (unless locally re-added).
  const clearedCharTombs = new Set<string>();
  animeCharacters = animeCharacters.filter((c) => {
    const key = animeCharacterSyncKey(c, seriesById);
    const tomb = mergedCharTombstones.find((t) => t.key === key);
    if (!tomb) return true;
    if (localCharKeys.has(key)) {
      clearedCharTombs.add(key);
      return true;
    }
    return false;
  });
  const characterIds = new Set(animeCharacters.map((c) => c.id));

  const { cards: mergedCards, removedKeys } = threeWayCards(
    base.animeCharacterCards,
    cloud.animeCharacterCards,
    local.animeCharacterCards,
    mergedTombstones
  );
  const animeCharacterCards = dedupeAnimeCards(
    mergedCards.filter((c) => characterIds.has(c.characterId))
  );

  const liveKeys = new Set(animeCharacterCards.map((c) => animeCardSyncKey(c)));
  const now = new Date().toISOString();
  let animeCardTombstones = pruneTombstones(mergedTombstones, liveKeys);
  for (const key of removedKeys) {
    if (!liveKeys.has(key)) {
      animeCardTombstones = upsertTombstone(animeCardTombstones, key, now);
    }
  }
  animeCardTombstones = pruneTombstones(animeCardTombstones, liveKeys);

  const liveCharKeys = new Set(
    animeCharacters.map((c) => animeCharacterSyncKey(c, seriesById))
  );
  const animeCharacterTombstones = pruneTombstones(
    mergedCharTombstones.filter((t) => !clearedCharTombs.has(t.key)),
    liveCharKeys
  );
  const liveSeriesKeys = new Set(animeSeries.map(animeSeriesSyncKey));
  const animeSeriesTombstones = pruneTombstones(
    mergedSeriesTombstones.filter((t) => !clearedSeriesTombs.has(t.key)),
    liveSeriesKeys
  );

  const animeBinderLayoutByCharacter = mergeBinderLayouts(
    base.animeBinderLayoutByCharacter,
    cloud.animeBinderLayoutByCharacter,
    local.animeBinderLayoutByCharacter,
    animeCharacterCards
  );

  return {
    animeSeries,
    animeCharacters,
    animeCharacterCards,
    animeBinderLayoutByCharacter,
    animeCardTombstones,
    animeCharacterTombstones,
    animeSeriesTombstones,
  };
}
