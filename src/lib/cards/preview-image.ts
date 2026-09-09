import type { DemoCard } from "@/lib/demo/types";
import { isCardTraderPlaceholderImage } from "@/lib/cardtrader/images";
import { buildYgoImageUrl, pickYgoImageSizeForRarity } from "@/lib/yugioh/urls";
import { isYugiohPasscodeId, resolveYugiohPasscode } from "@/lib/yugioh/passcode";

type CardImageFields = Pick<
  DemoCard,
  "imageUrl" | "gameSlug" | "externalId" | "rarity" | "cardTraderBlueprintId"
>;

function upgradePokemonImageUrl(url: string, preferLarge: boolean): string {
  if (!preferLarge || !url.includes("pokemontcg.io") || url.includes("_hires")) {
    return url;
  }
  return url.replace(/(\.[a-z]+)$/i, "_hires$1");
}

function pokemonImageFromExternalId(externalId: string, preferLarge: boolean): string | null {
  const dash = externalId.lastIndexOf("-");
  if (dash <= 0) return null;
  const setId = externalId.slice(0, dash);
  const number = externalId.slice(dash + 1);
  if (!setId || !number) return null;
  const suffix = preferLarge ? "_hires.png" : ".png";
  return `https://images.pokemontcg.io/${setId}/${number}${suffix}`;
}

function yugiohStoredImageUrl(card: CardImageFields): string | null {
  const storedPasscode = resolveYugiohPasscode(card.externalId, card.imageUrl, null);
  if (storedPasscode) {
    return buildYgoImageUrl(storedPasscode, pickYgoImageSizeForRarity(card.rarity));
  }
  if (card.imageUrl && !isCardTraderPlaceholderImage(card.imageUrl)) {
    return card.imageUrl;
  }
  return null;
}

function yugiohPreviewUrl(
  card: CardImageFields,
  detailPasscode?: string | null | undefined
): string | null {
  if (detailPasscode) {
    return buildYgoImageUrl(detailPasscode, pickYgoImageSizeForRarity(card.rarity));
  }
  const stored = yugiohStoredImageUrl(card);
  if (stored) return stored;
  if (detailPasscode === undefined) return null;
  return null;
}

function storedPreviewUrl(
  card: CardImageFields,
  preferLarge: boolean,
  detailPasscode?: string | null
): string | null {
  if (card.gameSlug === "yugioh") {
    return yugiohPreviewUrl(card, detailPasscode);
  }
  if (card.imageUrl) {
    return card.gameSlug === "pokemon"
      ? upgradePokemonImageUrl(card.imageUrl, preferLarge)
      : card.imageUrl;
  }
  if (card.gameSlug === "pokemon" && card.externalId) {
    return pokemonImageFromExternalId(card.externalId, preferLarge);
  }
  return null;
}

/** Full framed card for hover popover. */
export function getCardHoverPreviewUrl(
  card: CardImageFields,
  detailPasscode?: string | null | undefined
): string | null {
  if (card.gameSlug === "yugioh") {
    if (detailPasscode) {
      return buildYgoImageUrl(detailPasscode, "full");
    }
    const storedPasscode = resolveYugiohPasscode(card.externalId, card.imageUrl, null);
    if (storedPasscode) return buildYgoImageUrl(storedPasscode, "full");
    if (detailPasscode === undefined) return null;
    return null;
  }
  return storedPreviewUrl(card, card.gameSlug === "pokemon", detailPasscode);
}

/** YGOPRODeck art URL — used as CardImage fallback. */
export function getYugiohPasscodeFallbackUrl(
  card: CardImageFields,
  detailPasscode?: string | null
): string | null {
  const passcode = resolveYugiohPasscode(card.externalId, card.imageUrl, detailPasscode);
  if (!passcode) return null;
  return buildYgoImageUrl(passcode, pickYgoImageSizeForRarity(card.rarity));
}

/** Collection thumbnail — YGOPRODeck passcode art when available. */
export function resolveCollectionThumbUrl(
  card: CardImageFields,
  passcode: string | null | undefined
): string | null {
  return getCardPreviewImageUrl(card, passcode);
}

export function getCardPreviewImageUrl(
  card: CardImageFields,
  detailPasscode?: string | null
): string | null {
  return storedPreviewUrl(card, false, detailPasscode);
}

export interface CardDisplayImageSources {
  variantImage?: string | null;
  detailImage?: string | null;
  detailPasscode?: string | null | undefined;
}

/** Best image URL for detail modals — YGOPRODeck first. */
export function resolveCardDisplayImage(
  card: CardImageFields,
  sources: CardDisplayImageSources = {}
): string | null {
  if (card.gameSlug === "yugioh") {
    if (sources.detailPasscode === undefined) return null;
    if (sources.detailPasscode) {
      const ygoUrl = buildYgoImageUrl(sources.detailPasscode, "full");
      if (ygoUrl) return ygoUrl;
    }
    return sources.detailImage ?? null;
  }

  const preferLarge = card.gameSlug === "pokemon";
  const candidates = [
    sources.variantImage,
    sources.detailImage,
    storedPreviewUrl(card, preferLarge, sources.detailPasscode),
  ];

  for (const url of candidates) {
    if (!url) continue;
    return preferLarge ? upgradePokemonImageUrl(url, true) : url;
  }

  return null;
}

export { isYugiohPasscodeId };

