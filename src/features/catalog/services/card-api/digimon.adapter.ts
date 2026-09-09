import type { CardApiAdapter, CardDetail, CardSearchResult, CatalogSearchOptions } from "./types";
import { stripNestedPrintMetadata } from "@/features/catalog/services/serialize-search-results";
import {
  buildDigimonCollectorNumber,
  digimonVariantKey,
  normalizeDigimonDeckCardId,
  parseDigimonVariant,
  resolveDigimonCardTraderRarity,
  splitDigimonCardId,
} from "./digimon.utils";

const API = "https://digimoncard.io/api-public";
const HEADERS = { Accept: "application/json", "User-Agent": "DeckVault/0.2" };
const DIGIMON_CARD_ID = /^[A-Za-z][A-Za-z0-9]*-\d+(?:[-_][A-Za-z0-9]+)*$/i;

interface DigimonCard {
  name: string;
  id: string;
  type: string;
  rarity: string;
  stage: string;
  color: string;
  set_name?: string[];
  tcgplayer_id?: number | null;
  tcgplayer_name?: string | null;
}

const NON_DIGIMON_SET = /dragon ball|fusion world|one piece|pokemon|magic the gathering|yu-gi-oh|lorcana/i;

const DIGIMON_SEARCH_LIMIT = 200;
/** Max unique card numbers (BT3-031, etc.) returned — matches digimoncard.io-style breadth. */
const DIGIMON_RESULT_CAP = 200;

/** digimoncard.io returns 400 when the query contains ":" — use space instead in API calls. */
function normalizeDigimonQuery(query: string): string {
  return query
    .replace(/:/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildDigimonTextQueries(query: string): string[] {
  const trimmed = query.trim();
  const out = new Set<string>();

  const normalized = normalizeDigimonQuery(trimmed);
  if (normalized) out.add(normalized);

  const withoutTrailingColon = trimmed.replace(/:+\s*$/, "").trim();
  const normalizedNoTrail = normalizeDigimonQuery(withoutTrailingColon);
  if (normalizedNoTrail) out.add(normalizedNoTrail);

  return [...out];
}

function digimonCombinedSearchPath(nameQuery: string): string {
  const params = new URLSearchParams({
    n: nameQuery,
    desc: nameQuery,
    limit: String(DIGIMON_SEARCH_LIMIT),
    series: "Digimon Card Game",
    sort: "name",
    sortdirection: "asc",
  });
  return `/search?${params.toString()}`;
}

function digimonImageUrl(cardId: string): string {
  return `https://images.digimoncard.io/images/cards/${cardId}.jpg`;
}

function isDigimonGameCard(card: DigimonCard): boolean {
  const sets = card.set_name ?? [];
  if (sets.some((s) => NON_DIGIMON_SET.test(s))) return false;
  if (!card.id || !/^[A-Za-z][A-Za-z0-9]*-\d/.test(card.id)) return false;
  return true;
}

function mapDigimonCard(card: DigimonCard): CardSearchResult {
  const variant = parseDigimonVariant(card.id, card.tcgplayer_name);
  const collectorNumber = buildDigimonCollectorNumber(card.id, variant.collectorSuffix);
  const setName = card.set_name?.[0] ?? null;

  return {
    externalId: card.tcgplayer_id != null ? String(card.tcgplayer_id) : collectorNumber,
    name: card.name,
    setCode: card.id.split("-")[0] ?? null,
    setName,
    collectorNumber,
    rarity: card.rarity,
    edition: variant.label ?? card.stage ?? null,
    imageUrl: digimonImageUrl(card.id),
    price: null,
    metadata: {
      type: card.type,
      color: card.color,
      cardId: card.id,
      tcgplayer_id: card.tcgplayer_id,
      tcgplayer_name: card.tcgplayer_name,
      variantLabel: variant.label,
      cardTraderRarityHint: resolveDigimonCardTraderRarity(card.rarity, variant),
      sets: card.set_name,
    },
  };
}

function digimonPrintRefs(prints: CardSearchResult[]): CardSearchResult[] {
  return prints.map((print) => ({
    ...print,
    metadata: stripNestedPrintMetadata(print.metadata),
  }));
}

function groupDigimonSearchResults(cards: DigimonCard[]): CardSearchResult[] {
  const byCardId = new Map<string, CardSearchResult[]>();

  for (const card of cards) {
    const mapped = mapDigimonCard(card);
    const groupKey = card.id.toUpperCase();
    const group = byCardId.get(groupKey) ?? [];
    group.push(mapped);
    byCardId.set(groupKey, group);
  }

  const results: CardSearchResult[] = [];
  for (const prints of byCardId.values()) {
    const primary = prints[0]!;
    if (prints.length > 1) {
      primary.metadata = {
        ...primary.metadata,
        digimonPrints: digimonPrintRefs(prints),
      };
    }
    results.push(primary);
  }

  return results;
}

function pickDigimonPrint(
  prints: CardSearchResult[],
  externalId: string
): CardSearchResult {
  if (/^\d+$/.test(externalId)) {
    const byTcg = prints.find((print) => print.externalId === externalId);
    if (byTcg) return byTcg;
  }

  const { lookupId } = normalizeDigimonDeckCardId(externalId);
  const normalized = externalId.toLowerCase();
  const byCollector = prints.find(
    (print) =>
      print.collectorNumber?.toLowerCase() === normalized ||
      print.collectorNumber?.toUpperCase() === lookupId
  );
  if (byCollector) return byCollector;

  const { suffix } = splitDigimonCardId(externalId);
  if (suffix) {
    const bySuffix = prints.find((print) =>
      print.collectorNumber?.toLowerCase().endsWith(suffix)
    );
    if (bySuffix) return bySuffix;
  }

  return prints[0];
}

async function fetchDigimonCards(path: string): Promise<DigimonCard[]> {
  const res = await fetch(`${API}${path}`, { headers: HEADERS });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? (data as DigimonCard[]) : [];
}

export const digimonAdapter: CardApiAdapter = {
  gameSlug: "digimon",

  async search(query: string, _options?: CatalogSearchOptions): Promise<CardSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const collected: DigimonCard[] = [];
    const seen = new Set<string>();

    const addCards = (cards: DigimonCard[]) => {
      for (const card of cards) {
        if (!isDigimonGameCard(card)) continue;
        const key = digimonVariantKey(card);
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push(card);
      }
    };

    if (DIGIMON_CARD_ID.test(trimmed)) {
      const { lookupId } = normalizeDigimonDeckCardId(trimmed);
      const { baseId } = splitDigimonCardId(lookupId);
      addCards(await fetchDigimonCards(`/search?card=${encodeURIComponent(baseId)}`));
      return groupDigimonSearchResults(collected).slice(0, DIGIMON_RESULT_CAP);
    }

    for (const textQuery of buildDigimonTextQueries(trimmed)) {
      if (textQuery.length < 2) continue;
      addCards(await fetchDigimonCards(digimonCombinedSearchPath(textQuery)));
    }

    return groupDigimonSearchResults(collected).slice(0, DIGIMON_RESULT_CAP);
  },

  async getById(externalId: string): Promise<CardDetail | null> {
    const { lookupId } = normalizeDigimonDeckCardId(externalId);
    const lookupCard = DIGIMON_CARD_ID.test(lookupId)
      ? splitDigimonCardId(lookupId).baseId
      : lookupId;

    const cards = await fetchDigimonCards(`/search?card=${encodeURIComponent(lookupCard)}`);
    const valid = cards.filter(isDigimonGameCard);
    if (valid.length === 0) return null;

    const prints = valid.map(mapDigimonCard);
    const primary = pickDigimonPrint(prints, externalId);

    if (prints.length > 1) {
      primary.metadata = {
        ...primary.metadata,
        digimonPrints: digimonPrintRefs(prints),
      };
    }

    return { ...primary, gameSlug: "digimon" };
  },
};
