import type { CardCondition, CardLanguage, Currency } from "@/types/tcg";
import type {
  AnimeCharacter,
  AnimeSeries,
} from "@/features/anime-collection/types";

export interface AnimeCardTombstone {
  /** Stable identity: characterId|gameSlug|externalId */
  key: string;
  deletedAt: string;
}

export interface DemoCard {
  id: string;
  gameId: string;
  gameSlug: string;
  gameName: string;
  externalId: string | null;
  name: string;
  setCode: string | null;
  setName: string | null;
  collectorNumber: string | null;
  rarity: string | null;
  imageUrl: string | null;
  marketPrice: number | null;
  /** YGOPRODeck card type string (e.g. "Effect Monster", "Spell Card"). */
  type?: string | null;
  /** CardTrader catalog blueprint id — separate from Yu-Gi-Oh passcode in externalId */
  cardTraderBlueprintId?: string | null;
}

export interface DemoOwnedCard {
  id: string;
  collectionId: string;
  cardId: string;
  card: DemoCard;
  quantity: number;
  condition: CardCondition;
  language: CardLanguage;
  isFoil: boolean;
  purchasePrice: number | null;
  notes: string | null;
  tagIds: string[];
}

export interface DemoCollection {
  id: string;
  name: string;
  isDefault: boolean;
  isFavorite: boolean;
  coverImageUrl: string | null;
  /** Cloud only: true when others are members or this user is a guest member. */
  isShared?: boolean;
  /** Cloud only: role of the current user on this collection. */
  memberRole?: "owner" | "editor" | "viewer";
  /** Cloud only: owning account user id. */
  ownerUserId?: string;
}

export interface DemoProfile {
  displayName: string;
  currency: Currency;
  theme: string;
  defaultGameId: string | null;
}

export interface DemoTag {
  id: string;
  name: string;
  color: string;
}

export interface AnimeCharacterCard {
  id: string;
  characterId: string;
  card: DemoCard;
  quantity: number;
  condition: CardCondition;
  language: CardLanguage;
  isFoil: boolean;
  sortOrder: number;
  /** ISO time of last local add/edit — used with share tombstones. */
  lastTouchedAt?: string;
}

export interface DemoActivityEvent {
  id: string;
  collectionId: string;
  actorUserId: string;
  actorDisplayName: string;
  action: string;
  ownedCardId: string | null;
  cardName: string | null;
  beforeState: unknown;
  afterState: unknown;
  meta: Record<string, unknown>;
  createdAt: string;
  undoneAt: string | null;
  undoneBy: string | null;
}

export interface DemoState {
  profile: DemoProfile;
  collections: DemoCollection[];
  ownedCards: DemoOwnedCard[];
  tags: DemoTag[];
  animeSeries: AnimeSeries[];
  animeCharacters: AnimeCharacter[];
  animeCharacterCards: AnimeCharacterCard[];
  /** Sparse binder slot layouts keyed by character id (null = empty pocket). */
  animeBinderLayoutByCharacter: Record<string, (string | null)[]>;
  /** Cloud-share deletion markers (anime card sync keys). */
  animeCardTombstones: AnimeCardTombstone[];
  /** Confirmed character deletions (seriesKey::name) — win over cloud reappearance. */
  animeCharacterTombstones: AnimeCardTombstone[];
  /** Confirmed series deletions (series sync key) — win over cloud reappearance. */
  animeSeriesTombstones: AnimeCardTombstone[];
  activityEvents: DemoActivityEvent[];
}

export const DEMO_GAMES = [
  { id: "a0000000-0000-4000-8000-000000000001", slug: "yugioh", name: "Yu-Gi-Oh!" },
  { id: "a0000000-0000-4000-8000-000000000002", slug: "pokemon", name: "Pokemon" },
  { id: "a0000000-0000-4000-8000-000000000003", slug: "digimon", name: "Digimon" },
] as const;

export const DEFAULT_COLLECTION_ID = "demo-collection-1";

export function createInitialDemoState(): DemoState {
  return {
    profile: {
      displayName: "Collector",
      currency: "USD",
      theme: "dark",
      defaultGameId: DEMO_GAMES[0].id,
    },
    collections: [
      {
        id: DEFAULT_COLLECTION_ID,
        name: "My Collection",
        isDefault: true,
        isFavorite: true,
        coverImageUrl: null,
      },
    ],
    ownedCards: [],
    tags: [],
    animeSeries: [],
    animeCharacters: [],
    animeCharacterCards: [],
    animeBinderLayoutByCharacter: {},
    animeCardTombstones: [],
    animeCharacterTombstones: [],
    animeSeriesTombstones: [],
    activityEvents: [],
  };
}
