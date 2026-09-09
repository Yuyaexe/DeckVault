export interface CardSearchResult {
  externalId: string;
  name: string;
  setCode: string | null;
  setName: string | null;
  collectorNumber: string | null;
  rarity: string | null;
  edition: string | null;
  imageUrl: string | null;
  price: number | null;
  metadata: Record<string, unknown>;
}

/** YGOPRODeck cardinfo.php language codes (English = omit param). */
export type CatalogSearchLocale = "en" | "pt";

export interface CatalogSearchOptions {
  locale?: CatalogSearchLocale;
}

export interface CardDetail extends CardSearchResult {
  gameSlug: string;
}

export interface CardApiAdapter {
  gameSlug: string;
  search(query: string, options?: CatalogSearchOptions): Promise<CardSearchResult[]>;
  getById(externalId: string): Promise<CardDetail | null>;
}

export interface YugiohCardApiAdapter extends CardApiAdapter {
  searchByNameOnly(query: string, options?: CatalogSearchOptions): Promise<CardSearchResult[]>;
  getBySetNumber(setNumber: string): Promise<CardDetail | null>;
  advancedSearch(
    filters: import("@/lib/yugioh/advanced-search").YugiohAdvancedSearchFilters,
    options?: CatalogSearchOptions
  ): Promise<CardSearchResult[]>;
}
