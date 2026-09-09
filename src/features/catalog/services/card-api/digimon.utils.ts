/** Shared Digimon catalog helpers for adapter, variants, and CardTrader matching. */

export interface DigimonVariantInfo {
  label: string | null;
  collectorSuffix: string;
  cardTraderRarityHint: string | null;
}

const VARIANT_PATTERNS: Array<{ pattern: RegExp; label: string; suffix: string }> = [
  { pattern: /\(alternate art\)/i, label: "Alternate Art", suffix: "a" },
  { pattern: /\(foil\)/i, label: "Foil", suffix: "f" },
  { pattern: /\(textured\)/i, label: "Textured", suffix: "t" },
  { pattern: /\(sp\)/i, label: "SP", suffix: "sp" },
  { pattern: /\(rare pull\)/i, label: "Rare Pull", suffix: "p" },
  { pattern: /\(ultimate cup/i, label: "Ultimate Cup", suffix: "u" },
  { pattern: /\(promo\)/i, label: "Promo", suffix: "pr" },
];

export function digimonVariantKey(card: {
  id: string;
  tcgplayer_id?: number | null;
  tcgplayer_name?: string | null;
}): string {
  if (card.tcgplayer_id != null) return `tcg:${card.tcgplayer_id}`;
  const variant = parseDigimonVariant(card.id, card.tcgplayer_name);
  return `${card.id.toUpperCase()}:${variant.collectorSuffix || "base"}`;
}

export function parseDigimonVariant(
  cardId: string,
  tcgplayerName?: string | null
): DigimonVariantInfo {
  const name = tcgplayerName?.trim() ?? "";
  for (const { pattern, label, suffix } of VARIANT_PATTERNS) {
    if (pattern.test(name)) {
      return {
        label,
        collectorSuffix: suffix,
        cardTraderRarityHint: buildCardTraderRarityHint(label),
      };
    }
  }
  return { label: null, collectorSuffix: "", cardTraderRarityHint: null };
}

function buildCardTraderRarityHint(variantLabel: string): string {
  if (variantLabel === "Alternate Art") return "Alternate Art";
  return variantLabel;
}

export function splitDigimonCardId(id: string): { baseId: string; suffix: string } {
  const { lookupId, deckSuffix } = normalizeDigimonDeckCardId(id);
  const match = lookupId.match(/^([A-Za-z][A-Za-z0-9]*-\d+)([a-z]+)?$/i);
  const letterSuffix = match?.[2]?.toLowerCase() ?? "";
  const promoSuffix = deckSuffix?.replace(/^_/, "").toLowerCase() ?? "";
  return {
    baseId: match?.[1] ?? lookupId,
    suffix: promoSuffix || letterSuffix,
  };
}

/**
 * DigimonCard.io deck suffixes (_P1, -Errata) are not digimoncard.io API ids.
 * Returns the base card id used for catalog lookup.
 */
export function normalizeDigimonDeckCardId(cardId: string): {
  lookupId: string;
  deckSuffix: string | null;
} {
  const upper = cardId.trim().toUpperCase();

  const errata = upper.match(/^([A-Z][A-Z0-9]*-\d+)-ERRATA$/);
  if (errata) return { lookupId: errata[1], deckSuffix: "errata" };

  const promo = upper.match(/^([A-Z][A-Z0-9]*-\d+)(_[A-Z0-9]+)$/);
  if (promo) return { lookupId: promo[1], deckSuffix: promo[2].toLowerCase() };

  return { lookupId: upper, deckSuffix: null };
}

export function buildDigimonCollectorNumber(cardId: string, suffix: string): string {
  if (!suffix) return cardId;
  return `${cardId}${suffix}`;
}

/** Normalize set codes for cross-source matching (AD1, ad01, BT8). */
export function normalizeDigimonSetCode(code: string | null | undefined): string | null {
  if (!code?.trim()) return null;
  const trimmed = code.trim();
  const match = trimmed.match(/^([a-z]+)-?(\d+)/i);
  if (match) {
    return `${match[1].toLowerCase()}${parseInt(match[2], 10)}`;
  }
  return trimmed.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function resolveDigimonCardTraderRarity(
  baseRarity: string,
  variant: DigimonVariantInfo
): string {
  if (!variant.label) return baseRarity;
  if (variant.label === "Alternate Art") {
    const code = baseRarity.toUpperCase();
    if (code === "SEC" || code === "SR") return "Alternate Art Super Rare";
    return `Alternate Art ${baseRarity}`;
  }
  return variant.cardTraderRarityHint ?? baseRarity;
}

/** Compare card names ignoring colon spacing differences. */
export function digimonNamesMatch(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/:/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const na = norm(a);
  const nb = norm(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

export function isDigimonTcgPlayerExternalId(
  externalId: string | null | undefined,
  gameSlug?: string
): boolean {
  if (gameSlug !== "digimon" || !externalId) return false;
  return /^\d{5,9}$/.test(externalId);
}

export function digimonTcgPlayerIdFromResult(
  externalId: string | null | undefined,
  metadata?: Record<string, unknown>
): string | null {
  const fromMeta = metadata?.tcgplayer_id;
  if (fromMeta != null && String(fromMeta).trim()) return String(fromMeta);
  if (isDigimonTcgPlayerExternalId(externalId, "digimon")) return externalId!;
  return null;
}

/** CardTrader pricing fields derived from a Digimon catalog search result. */
export function digimonCardPriceFields(result: {
  externalId: string;
  collectorNumber?: string | null;
  rarity?: string | null;
  edition?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return {
    tcgPlayerId: digimonTcgPlayerIdFromResult(result.externalId, result.metadata),
    collectorNumber: result.collectorNumber ?? null,
    variantLabel:
      (result.metadata?.variantLabel as string | null | undefined) ??
      result.edition ??
      null,
    rarity:
      (result.metadata?.cardTraderRarityHint as string | null | undefined) ??
      result.rarity ??
      null,
  };
}

/** Infer CardTrader pricing fields for owned Digimon cards (no catalog metadata). */
/** CardTrader expansion hint: prefer set prefix from collector (BT3) over unrelated codes (AD-01 reprints). */
export function digimonEffectiveSetCodeForPricing(card: {
  setCode?: string | null;
  collectorNumber?: string | null;
}): string | null {
  const collector = card.collectorNumber?.trim();
  const collectorPrefix =
    collector && /^[A-Za-z]+\d+-\d/i.test(collector)
      ? collector.match(/^([A-Za-z]+\d+)/i)?.[1]?.toUpperCase() ?? null
      : null;

  const stored = card.setCode?.trim() ?? null;
  if (!collectorPrefix) return stored;

  if (!stored) return collectorPrefix;

  const normStored = normalizeDigimonSetCode(stored);
  const normCollector = normalizeDigimonSetCode(collectorPrefix);
  if (normStored && normCollector && normStored !== normCollector) {
    return collectorPrefix;
  }

  return stored;
}

export function digimonOwnedCardPriceFields(card: {
  externalId?: string | null;
  collectorNumber?: string | null;
  rarity?: string | null;
}) {
  const collectorNumber = card.collectorNumber ?? null;
  const { suffix } = splitDigimonCardId(collectorNumber ?? "");
  const tcgplayerName =
    suffix === "a"
      ? "(Alternate Art)"
      : suffix === "p"
        ? "(Rare Pull)"
        : suffix === "u"
          ? "(Ultimate Cup"
          : null;
  const variant = parseDigimonVariant(collectorNumber ?? "", tcgplayerName);

  return {
    tcgPlayerId: digimonTcgPlayerIdFromResult(card.externalId, undefined),
    collectorNumber,
    variantLabel: variant.label,
    rarity: resolveDigimonCardTraderRarity(card.rarity ?? "", variant),
  };
}
