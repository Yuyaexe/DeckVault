export const CARD_CONDITIONS = ["NM", "LP", "MP", "HP", "DMG"] as const;
export type CardCondition = (typeof CARD_CONDITIONS)[number];

export const CARD_LANGUAGES = ["EN", "JP", "PT", "DE", "FR", "ES", "IT", "KO", "ZH"] as const;
export type CardLanguage = (typeof CARD_LANGUAGES)[number];

export const CURRENCIES = ["USD", "BRL"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const GAME_SLUGS = ["yugioh", "pokemon", "digimon"] as const;
export type GameSlug = (typeof GAME_SLUGS)[number];

export const CONDITION_LABELS: Record<CardCondition, string> = {
  NM: "Near Mint",
  LP: "Lightly Played",
  MP: "Moderately Played",
  HP: "Heavily Played",
  DMG: "Damaged",
};

export interface CollectionFilters {
  search: string;
  gameId: string | null;
  setCode: string | null;
  rarity: string | null;
  language: CardLanguage | null;
  condition: CardCondition | null;
  tagIds: string[];
  priceMin: number | null;
  priceMax: number | null;
  isFoil: boolean | null;
  minQuantity: number | null;
}

export const DEFAULT_FILTERS: CollectionFilters = {
  search: "",
  gameId: null,
  setCode: null,
  rarity: null,
  language: null,
  condition: null,
  tagIds: [],
  priceMin: null,
  priceMax: null,
  isFoil: null,
  minQuantity: null,
};
