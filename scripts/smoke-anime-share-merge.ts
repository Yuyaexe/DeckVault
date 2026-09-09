/**
 * Smoke checks for anime share 3-way merge (qty Math.max + character tombstones).
 * Run: npx tsx scripts/smoke-anime-share-merge.ts
 */
import {
  animeCardSyncKey,
  animeCharacterSyncKey,
  animeSeriesSyncKey,
  hasPendingCardDeletes,
  threeWayMergeAnimeState,
  type AnimeWorkspaceSnapshotState,
} from "../src/lib/data/anime-share-merge";
import type { AnimeCharacter, AnimeSeries } from "../src/features/anime-collection/types";
import type { AnimeCharacterCard } from "../src/lib/demo/types";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  OK  ${label}`);
  } else {
    failed++;
    console.log(` FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const series: AnimeSeries = {
  id: "s1",
  name: "Yu-Gi-Oh!",
  slug: "yu-gi-oh",
  coverImageUrl: null,
  coverColor: null,
  isSeeded: true,
  sortOrder: 0,
};

const character: AnimeCharacter = {
  id: "c1",
  seriesId: "s1",
  name: "Yugi",
  imageUrl: null,
  accentColor: null,
  isSeeded: true,
  sortOrder: 0,
};

function card(qty: number, id = "card1"): AnimeCharacterCard {
  return {
    id,
    characterId: "c1",
    card: {
      id: `demo-${id}`,
      gameId: "ygo",
      gameSlug: "yu-gi-oh",
      gameName: "Yu-Gi-Oh!",
      externalId: "46986414",
      name: "Dark Magician",
      setCode: null,
      setName: null,
      collectorNumber: null,
      rarity: null,
      imageUrl: null,
      marketPrice: null,
    },
    quantity: qty,
    condition: "NM",
    language: "EN",
    isFoil: false,
    sortOrder: 0,
    lastTouchedAt: "2026-01-01T00:00:00.000Z",
  };
}

function snapshot(partial: Partial<AnimeWorkspaceSnapshotState>): AnimeWorkspaceSnapshotState {
  return {
    animeSeries: [series],
    animeCharacters: [character],
    animeCharacterCards: [],
    animeBinderLayoutByCharacter: {},
    animeCardTombstones: [],
    animeCharacterTombstones: [],
    animeSeriesTombstones: [],
    ...partial,
  };
}

const baseCard = card(1);
const base = snapshot({ animeCharacterCards: [baseCard] });

// 1) Both sides raised qty after base → Math.max wins (no 1+1=2)
{
  const cloud = snapshot({ animeCharacterCards: [card(2)] });
  const local = snapshot({ animeCharacterCards: [card(3)] });
  const merged = threeWayMergeAnimeState(base, cloud, local);
  const qty = merged.animeCharacterCards[0]?.quantity;
  assert("qty conflict uses Math.max (not sum)", qty === 3, `got ${qty}`);
}

// 2) Character tombstone on local keeps delete over cloud reappearance
{
  const seriesById = new Map([[series.id, series]]);
  const charKey = animeCharacterSyncKey(character, seriesById);
  const cloud = snapshot({
    animeCharacters: [character],
    animeCharacterCards: [card(1)],
  });
  const local = snapshot({
    animeCharacters: [],
    animeCharacterCards: [],
    animeCharacterTombstones: [{ key: charKey, deletedAt: "2026-06-01T00:00:00.000Z" }],
  });
  const merged = threeWayMergeAnimeState(base, cloud, local);
  assert(
    "character tombstone wins over cloud character",
    merged.animeCharacters.length === 0,
    `chars=${merged.animeCharacters.length}`
  );
  assert(
    "cards of tombstoned character are dropped",
    merged.animeCharacterCards.length === 0,
    `cards=${merged.animeCharacterCards.length}`
  );
}

// 3) Card tombstone beats cloud card even if cloud lastTouchedAt is newer
{
  const tombAt = "2026-06-01T00:00:00.000Z";
  const cloudNewer = card(1);
  cloudNewer.lastTouchedAt = "2026-07-01T00:00:00.000Z";
  const cloud = snapshot({ animeCharacterCards: [cloudNewer] });
  const local = snapshot({
    animeCharacterCards: [],
    animeCardTombstones: [{ key: animeCardSyncKey(baseCard), deletedAt: tombAt }],
  });
  const merged = threeWayMergeAnimeState(base, cloud, local);
  assert(
    "card tombstone wins over newer cloud touch",
    merged.animeCharacterCards.length === 0,
    `cards=${merged.animeCharacterCards.length}`
  );
  assert(
    "hasPendingCardDeletes detects remote still has card",
    hasPendingCardDeletes(local, cloud) === true
  );
}

// 4) Sync keys stay stable for fixtures
{
  assert(
    "series sync key",
    animeSeriesSyncKey(series) === "slug:yu-gi-oh"
  );
  assert(
    "card sync key includes character + passcode",
    animeCardSyncKey(baseCard) === "c1|yu-gi-oh|46986414"
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
