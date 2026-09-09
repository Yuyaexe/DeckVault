import type { CardSearchResult } from "@/features/catalog/services/card-api/types";
import { getCardAdapter, isApiSupported } from "@/features/catalog/services/card-api";
import { pickExactNameMatch } from "@/features/catalog/services/pick-exact-name-match";
import { splitDigimonCardId, normalizeDigimonDeckCardId, digimonNamesMatch } from "@/features/catalog/services/card-api/digimon.utils";
import type { DecklistGameSlug, ParsedDeckEntry, ResolvedDeckEntry } from "@/features/import/types";

const YGO_API = "https://db.ygoprodeck.com/api/v7";
const YGO_HEADERS = { Accept: "application/json", "User-Agent": "DeckVault/0.2" };

interface YgoCard {
  id: number;
  name: string;
  card_sets?: { set_name: string; set_code: string; set_rarity: string; set_price: string }[];
  card_prices?: { tcgplayer_price: string }[];
  card_images?: { image_url: string; image_url_small: string }[];
}

function mapYgoCard(card: YgoCard): CardSearchResult {
  const primarySet = card.card_sets?.[0];
  const prices = card.card_prices?.[0];
  const tcgPrice = prices?.tcgplayer_price ? parseFloat(prices.tcgplayer_price) : null;
  const image =
    card.card_images?.[0]?.image_url_small ??
    card.card_images?.[0]?.image_url ??
    `https://images.ygoprodeck.com/images/cards/${card.id}.jpg`;

  return {
    externalId: String(card.id),
    name: card.name,
    setCode: primarySet?.set_code ?? null,
    setName: primarySet?.set_name ?? null,
    collectorNumber: primarySet?.set_code ?? null,
    rarity: primarySet?.set_rarity ?? null,
    edition: null,
    imageUrl: image,
    price: tcgPrice,
    metadata: { sets: card.card_sets },
  };
}

async function fetchYugiohPasscodes(passcodes: number[]): Promise<Map<number, CardSearchResult>> {
  const unique = [...new Set(passcodes.filter(Boolean))];
  const map = new Map<number, CardSearchResult>();
  if (unique.length === 0) return map;

  const chunkSize = 50;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const res = await fetch(`${YGO_API}/cardinfo.php?id=${chunk.join(",")}`, {
      headers: YGO_HEADERS,
    });
    if (!res.ok) continue;
    const data = await res.json();
    for (const card of (data.data as YgoCard[] | undefined) ?? []) {
      map.set(card.id, mapYgoCard(card));
    }
  }

  return map;
}

function pickDigimonPrintFromGroup(
  prints: CardSearchResult[],
  entry: ParsedDeckEntry,
  lookupId: string
): CardSearchResult | null {
  const matching = prints.filter((print) => {
    const cardId = String(print.metadata?.cardId ?? print.collectorNumber ?? "").toUpperCase();
    return (
      cardId === lookupId ||
      print.collectorNumber?.toUpperCase() === lookupId ||
      print.externalId?.toUpperCase() === lookupId
    );
  });

  if (matching.length === 0) return null;
  if (matching.length === 1) return matching[0];

  const byName = matching.filter((print) => digimonNamesMatch(print.name, entry.name));
  const pool = byName.length > 0 ? byName : matching;

  const deckSuffix = entry.setCode
    ? normalizeDigimonDeckCardId(entry.setCode).deckSuffix
    : null;
  if (deckSuffix?.startsWith("_p")) {
    const nonAlt = pool.find(
      (print) =>
        !String(print.metadata?.tcgplayer_name ?? "")
          .toLowerCase()
          .includes("alternate")
    );
    if (nonAlt) return nonAlt;
  }

  return pool[0];
}

function pickDigimonMatch(results: CardSearchResult[], entry: ParsedDeckEntry): CardSearchResult | null {
  if (entry.setCode) {
    const normalizedEntry = entry.setCode.toLowerCase();
    const { lookupId, deckSuffix } = normalizeDigimonDeckCardId(entry.setCode);
    const { baseId, suffix } = splitDigimonCardId(entry.setCode);

    for (const result of results) {
      const prints =
        (result.metadata?.digimonPrints as CardSearchResult[] | undefined) ?? [result];

      const fromGroup = pickDigimonPrintFromGroup(prints, entry, lookupId);
      if (fromGroup) return fromGroup;

      for (const print of prints) {
        const collector = print.collectorNumber?.toLowerCase();
        if (collector === normalizedEntry) return print;
        if (print.externalId?.toLowerCase() === normalizedEntry) return print;
        if (suffix && collector === `${baseId.toLowerCase()}${suffix}`) return print;
      }
    }

    const byId = results.find(
      (result) =>
        result.externalId?.toLowerCase() === normalizedEntry ||
        result.collectorNumber?.toLowerCase() === normalizedEntry ||
        result.collectorNumber?.toUpperCase() === lookupId
    );
    if (byId) return byId;

    if (deckSuffix === "errata") {
      for (const result of results) {
        const prints =
          (result.metadata?.digimonPrints as CardSearchResult[] | undefined) ?? [result];
        const errataPrint = pickDigimonPrintFromGroup(prints, entry, lookupId);
        if (errataPrint) return errataPrint;
      }
    }
  }
  return pickExactNameMatch(results, entry.name);
}

async function resolveEntry(
  entry: ParsedDeckEntry,
  gameSlug: DecklistGameSlug,
  ygoPasscodeMap: Map<number, CardSearchResult>
): Promise<ResolvedDeckEntry> {
  if (gameSlug === "yugioh") {
    if (entry.passcode) {
      const result = ygoPasscodeMap.get(entry.passcode) ?? null;
      return result
        ? { entry, result }
        : { entry, result: null, error: `Passcode ${entry.passcode} not found` };
    }

    const adapter = getCardAdapter("yugioh");
    if (!adapter) {
      return { entry, result: null, error: "Yu-Gi-Oh catalog unavailable" };
    }
    const results = await adapter.search(entry.name);
    const result = pickExactNameMatch(results, entry.name);
    return result
      ? { entry, result }
      : { entry, result: null, error: `"${entry.name}" not found` };
  }

  if (gameSlug === "digimon") {
    const adapter = getCardAdapter("digimon");
    if (!adapter) {
      return { entry, result: null, error: "Digimon catalog unavailable" };
    }

    const cardId = entry.setCode?.trim().toUpperCase() ?? null;
    const lookupId = cardId ? normalizeDigimonDeckCardId(cardId).lookupId : null;

    if (lookupId && isApiSupported("digimon")) {
      const byId = await adapter.getById(cardId!);
      if (byId) return { entry, result: byId };
    }

    const results = await adapter.search(entry.name);
    const result = pickDigimonMatch(results, { ...entry, setCode: cardId });
    return result
      ? { entry, result }
      : { entry, result: null, error: `"${entry.name}"${cardId ? ` (${cardId})` : ""} not found` };
  }

  return {
    entry,
    result: {
      externalId: entry.setCode ?? entry.name,
      name: entry.name,
      setCode: entry.setCode?.split("-")[0] ?? null,
      setName: null,
      collectorNumber: entry.setCode,
      rarity: null,
      edition: null,
      imageUrl: null,
      price: null,
      metadata: { importSource: "decklist-text" },
    },
  };
}

export async function resolveDeckEntries(
  entries: ParsedDeckEntry[],
  gameSlug: DecklistGameSlug
): Promise<ResolvedDeckEntry[]> {
  const ygoPasscodes =
    gameSlug === "yugioh"
      ? entries.map((entry) => entry.passcode).filter((code): code is number => code != null)
      : [];

  const ygoPasscodeMap = await fetchYugiohPasscodes(ygoPasscodes);
  const resolved: ResolvedDeckEntry[] = [];

  for (const entry of entries) {
    resolved.push(await resolveEntry(entry, gameSlug, ygoPasscodeMap));
  }

  return resolved;
}
