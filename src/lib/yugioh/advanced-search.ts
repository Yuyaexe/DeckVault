import type { CatalogSearchLocale } from "@/features/catalog/services/card-api/types";
import {
  matchesYgoCardTypeKey,
  matchesYgoCategory,
  type YugiohCardTypeKey,
  type YugiohFilterLogic,
  type YugiohSearchCategory,
  type YugiohSearchField,
} from "./advanced-search.constants";
import { normalizeYugiohSearchQuery } from "./search-query";

export interface YugiohAdvancedSearchFilters {
  keyword: string;
  searchField: YugiohSearchField;
  category: YugiohSearchCategory;
  attributes: string[];
  spellTrapRaces: string[];
  monsterRaces: string[];
  cardTypes: YugiohCardTypeKey[];
  cardTypesLogic: YugiohFilterLogic;
  excludeTypes: YugiohCardTypeKey[];
  levels: number[];
  scales: number[];
  linkValues: number[];
  linkMarkers: string[];
  linkMarkersLogic: YugiohFilterLogic;
  atkMin: number | null;
  atkMax: number | null;
  defMin: number | null;
  defMax: number | null;
  startDate: string | null;
  endDate: string | null;
  cardSets: string[];
  sort: "name" | "atk" | "def" | "level" | "new";
}

export const EMPTY_YGO_ADVANCED_FILTERS: YugiohAdvancedSearchFilters = {
  keyword: "",
  searchField: "name",
  category: "all",
  attributes: [],
  spellTrapRaces: [],
  monsterRaces: [],
  cardTypes: [],
  cardTypesLogic: "or",
  excludeTypes: [],
  levels: [],
  scales: [],
  linkValues: [],
  linkMarkers: [],
  linkMarkersLogic: "or",
  atkMin: null,
  atkMax: null,
  defMin: null,
  defMax: null,
  startDate: null,
  endDate: null,
  cardSets: [],
  sort: "name",
};

export interface YgoRawCard {
  id: number;
  name: string;
  type: string;
  atk?: number;
  def?: number;
  level?: number;
  race?: string;
  attribute?: string;
  scale?: number;
  linkval?: number;
  linkmarkers?: string[];
  card_sets?: { set_name: string; set_code: string; set_rarity: string; set_rarity_code: string; set_price: string }[];
  card_prices?: { tcgplayer_price: string; cardmarket_price: string; ebay_price: string }[];
  card_images?: { image_url: string; image_url_small: string }[];
}

function formatStatFilter(min: number | null, max: number | null): string | null {
  if (min != null && max == null) return `gte${min}`;
  if (max != null && min == null) return `lte${max}`;
  return null;
}

function buildCategoryTypeParam(category: YugiohSearchCategory): string | null {
  if (category === "spell") return "Spell Card";
  if (category === "trap") return "Trap Card";
  return null;
}

function buildRaceParam(filters: YugiohAdvancedSearchFilters): string | null {
  const races = [...filters.monsterRaces, ...filters.spellTrapRaces];
  if (races.length === 0) return null;
  return races.map((r) => r.toLowerCase()).join(",");
}

export function hasActiveYgoAdvancedFilters(filters: YugiohAdvancedSearchFilters): boolean {
  return (
    filters.keyword.trim().length > 0 ||
    filters.attributes.length > 0 ||
    filters.spellTrapRaces.length > 0 ||
    filters.monsterRaces.length > 0 ||
    filters.cardTypes.length > 0 ||
    filters.excludeTypes.length > 0 ||
    filters.levels.length > 0 ||
    filters.scales.length > 0 ||
    filters.linkValues.length > 0 ||
    filters.linkMarkers.length > 0 ||
    filters.atkMin != null ||
    filters.atkMax != null ||
    filters.defMin != null ||
    filters.defMax != null ||
    filters.startDate != null ||
    filters.endDate != null ||
    filters.cardSets.length > 0 ||
    filters.category !== "all"
  );
}

/** Build YGOPRODeck cardinfo.php query string (single request). */
export function buildYgoAdvancedSearchParams(
  filters: YugiohAdvancedSearchFilters,
  options?: { locale?: CatalogSearchLocale; cardSet?: string | null }
): string {
  const params = new URLSearchParams();
  const keyword = filters.keyword.trim();
  const collapsedKeyword = normalizeYugiohSearchQuery(keyword);

  if (keyword) {
    if (filters.searchField === "exact") {
      params.set("name", keyword);
    } else if (filters.searchField === "archetype") {
      params.set("archetype", collapsedKeyword || keyword);
    } else {
      params.set("fname", collapsedKeyword || keyword);
    }
  }

  if (options?.locale === "pt") {
    params.set("language", "pt");
  }

  const categoryType = buildCategoryTypeParam(filters.category);
  if (categoryType) {
    params.set("type", categoryType);
  }

  if (filters.attributes.length > 0) {
    params.set("attribute", filters.attributes.map((a) => a.toLowerCase()).join(","));
  }

  const race = buildRaceParam(filters);
  if (race) params.set("race", race);

  if (filters.cardTypes.length > 0 && filters.cardTypesLogic === "or" && !categoryType) {
    // OR logic with simplified keys — rely on client filter when category locked
  }

  if (filters.levels.length > 0) {
    params.set("level", filters.levels.join(","));
  }

  if (filters.scales.length > 0) {
    params.set("scale", filters.scales.join(","));
  }

  if (filters.linkValues.length > 0) {
    params.set("link", filters.linkValues.join(","));
  }

  if (filters.linkMarkers.length > 0) {
    params.set(
      "linkmarker",
      filters.linkMarkers.map((m) => m.toLowerCase()).join(",")
    );
  }

  const atk = formatStatFilter(filters.atkMin, filters.atkMax);
  if (atk) params.set("atk", atk);

  const def = formatStatFilter(filters.defMin, filters.defMax);
  if (def) params.set("def", def);

  if (filters.startDate) params.set("startdate", filters.startDate);
  if (filters.endDate) params.set("enddate", filters.endDate);
  if (filters.startDate || filters.endDate) params.set("dateregion", "tcg");

  const cardSet = options?.cardSet ?? filters.cardSets[0] ?? null;
  if (cardSet) params.set("cardset", cardSet);

  if (filters.sort) params.set("sort", filters.sort);

  return params.toString();
}

function cardTypeMatches(
  type: string,
  keys: YugiohCardTypeKey[],
  logic: YugiohFilterLogic
): boolean {
  if (keys.length === 0) return true;
  const checks = keys.map((key) => matchesYgoCardTypeKey(type, key));
  return logic === "and" ? checks.every(Boolean) : checks.some(Boolean);
}

function linkMarkersMatch(
  markers: string[] | undefined,
  selected: string[],
  logic: YugiohFilterLogic
): boolean {
  if (selected.length === 0) return true;
  const cardMarkers = (markers ?? []).map((m) => m.toLowerCase());
  const wanted = selected.map((m) => m.toLowerCase());
  if (logic === "and") {
    return wanted.every((m) => cardMarkers.includes(m));
  }
  return wanted.some((m) => cardMarkers.includes(m));
}

function cardInSets(
  card: YgoRawCard,
  setNames: string[]
): boolean {
  if (setNames.length === 0) return true;
  const names = new Set(setNames.map((s) => s.toLowerCase()));
  return (card.card_sets ?? []).some((s) => names.has(s.set_name.toLowerCase()));
}

/** Client-side refinement for filters the API cannot combine in one request. */
export function applyYgoAdvancedClientFilters(
  cards: YgoRawCard[],
  filters: YugiohAdvancedSearchFilters
): YgoRawCard[] {
  return cards.filter((card) => {
    if (!matchesYgoCategory(card.type, filters.category)) return false;

    if (filters.cardTypes.length > 0) {
      if (!cardTypeMatches(card.type, filters.cardTypes, filters.cardTypesLogic)) return false;
    }

    if (filters.excludeTypes.length > 0) {
      if (cardTypeMatches(card.type, filters.excludeTypes, "or")) return false;
    }

    if (filters.cardSets.length > 1 && !cardInSets(card, filters.cardSets)) return false;

    if (filters.linkMarkers.length > 0) {
      if (!linkMarkersMatch(card.linkmarkers, filters.linkMarkers, filters.linkMarkersLogic)) {
        return false;
      }
    }

    if (filters.monsterRaces.length > 0 && filters.category !== "spell" && filters.category !== "trap") {
      const race = card.race?.toLowerCase() ?? "";
      if (!filters.monsterRaces.some((r) => race === r.toLowerCase())) return false;
    }

    if (filters.atkMin != null && (card.atk ?? -1) < filters.atkMin) return false;
    if (filters.atkMax != null && (card.atk ?? Number.MAX_SAFE_INTEGER) > filters.atkMax) return false;
    if (filters.defMin != null && (card.def ?? -1) < filters.defMin) return false;
    if (filters.defMax != null && (card.def ?? Number.MAX_SAFE_INTEGER) > filters.defMax) return false;

    return true;
  });
}

export function countActiveYgoAdvancedFilters(filters: YugiohAdvancedSearchFilters): number {
  let count = 0;
  if (filters.keyword.trim()) count++;
  if (filters.category !== "all") count++;
  count += filters.attributes.length;
  count += filters.spellTrapRaces.length;
  count += filters.monsterRaces.length;
  count += filters.cardTypes.length;
  count += filters.excludeTypes.length;
  count += filters.levels.length;
  count += filters.scales.length;
  count += filters.linkValues.length;
  count += filters.linkMarkers.length;
  if (filters.atkMin != null || filters.atkMax != null) count++;
  if (filters.defMin != null || filters.defMax != null) count++;
  if (filters.startDate || filters.endDate) count++;
  count += filters.cardSets.length;
  return count;
}
