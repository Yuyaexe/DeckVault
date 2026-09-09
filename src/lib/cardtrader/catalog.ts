import { resolveRarityStyle } from "@/lib/rarity/resolve-rarity";
import { isDigimonTcgPlayerExternalId } from "@/features/catalog/services/card-api/digimon.utils";
import { isYugiohLostArtCode } from "@/lib/yugioh/set-code";

const blueprintSlugCache = new Map<number, string>();

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugifyForCardTrader(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** CardTrader catalog spelling differs from Konami/YGOPRODeck on some cards. */
function normalizeCardTraderCardName(name: string): string {
  return name.trim().replace(/\bAzathot\b/gi, "Azathoth");
}

function cardTraderRaritySlugPart(
  rarity: string | null | undefined,
  gameSlug?: string | null
): string | null {
  if (!rarity?.trim()) return null;
  const label = resolveRarityStyle(rarity, gameSlug ?? "yugioh").label;
  return slugifyForCardTrader(label !== "?" ? label : rarity);
}

function buildCardTraderSlugParts(input: {
  name: string;
  setName?: string | null;
  rarity?: string | null;
  gameSlug?: string | null;
}): string[] {
  const parts = [slugifyForCardTrader(normalizeCardTraderCardName(input.name))];
  const raritySlug = cardTraderRaritySlugPart(input.rarity, input.gameSlug);
  if (raritySlug) parts.push(raritySlug);
  if (input.setName?.trim()) parts.push(slugifyForCardTrader(input.setName));
  return parts;
}

/** Extract numeric blueprint id from CardTrader CDN image URLs. */
export function extractBlueprintIdFromImageUrl(
  imageUrl: string | null | undefined
): number | null {
  const slug = extractCardTraderSlugFromImageUrl(imageUrl);
  if (!slug) return null;
  const id = Number(slug.split("-")[0]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function parseCardTraderBlueprintId(externalId: string | null | undefined): number | null {
  if (!externalId || !/^\d+$/.test(externalId)) return null;
  const id = Number(externalId);
  return Number.isFinite(id) ? id : null;
}

function isLikelyYugiohPasscodeDigits(externalId: string, imageUrl?: string | null): boolean {
  if (!/^\d{7,10}$/.test(externalId)) return false;
  if (imageUrl && /cardtrader\.com|product-images\.cardtrader/i.test(imageUrl)) return false;
  if (imageUrl?.includes("ygoprodeck.com")) return true;
  return externalId.length >= 8;
}

function isPlausibleCardTraderBlueprintId(id: number): boolean {
  if (!Number.isFinite(id) || id <= 0) return false;
  if (id >= 10_000_000 && id <= 99_999_999) return false;
  return true;
}

/**
 * Blueprint id stored on owned cards — ignores Yu-Gi-Oh passcodes mistaken for blueprint ids.
 */
export function resolveStoredBlueprintId(
  externalId: string | null | undefined,
  imageUrl?: string | null,
  cardTraderBlueprintId?: string | null,
  gameSlug?: string | null
): number | null {
  const explicit = parseCardTraderBlueprintId(cardTraderBlueprintId);
  if (explicit != null && isPlausibleCardTraderBlueprintId(explicit)) {
    if (
      gameSlug === "digimon" &&
      isDigimonTcgPlayerExternalId(cardTraderBlueprintId, "digimon") &&
      explicit === Number(cardTraderBlueprintId)
    ) {
      // Previously saved tcgplayer id as blueprint id — ignore.
    } else {
      return explicit;
    }
  }

  const fromImage = extractBlueprintIdFromImageUrl(imageUrl);
  if (fromImage != null) return fromImage;

  if (!externalId || !/^\d+$/.test(externalId)) return null;
  if (isLikelyYugiohPasscodeDigits(externalId, imageUrl)) return null;
  if (gameSlug === "digimon" && isDigimonTcgPlayerExternalId(externalId, gameSlug)) {
    return null;
  }

  const id = Number(externalId);
  return isPlausibleCardTraderBlueprintId(id) ? id : null;
}

/** Extract `{id}-{slug}` from CardTrader CDN blueprint image URLs. */
export function extractCardTraderSlugFromImageUrl(
  imageUrl: string | null | undefined
): string | null {
  if (!imageUrl) return null;
  const match = imageUrl.match(/blueprints\/(\d+-[^/?#]+)/i);
  return match?.[1] ?? null;
}

function cacheBlueprintSlug(blueprintId: number, imageUrl?: string | null): void {
  const slug = extractCardTraderSlugFromImageUrl(imageUrl);
  if (slug) blueprintSlugCache.set(blueprintId, slug);
}

export function getBlueprintProductSlug(blueprintId: number): string | null {
  return blueprintSlugCache.get(blueprintId) ?? null;
}

function encodeCardTraderManaSearchIds(blueprintIds: number[]): string {
  const payload = blueprintIds.join(",");
  if (typeof Buffer !== "undefined") {
    return Buffer.from(payload, "utf8").toString("base64");
  }
  return btoa(payload);
}

/** Multi-version search — lists every printing of the same card name. */
export function buildCardTraderManaSearchUrl(
  name: string,
  blueprintIds: number[],
  page = 1
): string {
  const ids = [...new Set(blueprintIds.filter((id) => Number.isFinite(id) && id > 0))];
  const cardName = normalizeCardTraderCardName(name);
  if (ids.length === 0) {
    return buildCardTraderSlugUrl({ name: cardName });
  }
  const q = encodeURIComponent(cardName);
  const idsParam = encodeURIComponent(encodeCardTraderManaSearchIds(ids));
  return `https://www.cardtrader.com/en/manasearch_results?ids=${idsParam}&q=${q}&page=${page}`;
}

export interface CardTraderBlueprintMeta {
  id: number;
}

export interface CardTraderBlueprintPayload {
  id: number;
  name: string;
  same_meta?: CardTraderBlueprintMeta[] | null;
}

export function collectCardTraderBlueprintGroupIds(
  blueprint: CardTraderBlueprintPayload
): number[] {
  const ids = new Set<number>([blueprint.id]);
  for (const meta of blueprint.same_meta ?? []) {
    if (meta?.id > 0) ids.add(meta.id);
  }
  return [...ids];
}

/** Direct product page — e.g. /en/cards/201101-speedroid-scratch-secret-rare-brothers-of-legend */
export function buildCardTraderCardUrl(input: {
  blueprintId: number;
  name: string;
  setName?: string | null;
  rarity?: string | null;
  imageUrl?: string | null;
  gameSlug?: string | null;
}): string {
  const cached = getBlueprintProductSlug(input.blueprintId);
  const fromImage = cached ?? extractCardTraderSlugFromImageUrl(input.imageUrl);
  if (fromImage) {
    return `https://www.cardtrader.com/en/cards/${fromImage}`;
  }

  const parts = buildCardTraderSlugParts({
    name: input.name,
    setName: input.setName,
    rarity: input.rarity,
    gameSlug: input.gameSlug,
  });

  return `https://www.cardtrader.com/en/cards/${input.blueprintId}-${parts.join("-")}`;
}

/** Slug-only product page — works when blueprint id is unknown. */
export function buildCardTraderSlugUrl(input: {
  name: string;
  setName?: string | null;
  rarity?: string | null;
  gameSlug?: string | null;
}): string {
  return `https://www.cardtrader.com/en/cards/${buildCardTraderSlugParts(input).join("-")}`;
}

export function buildCardTraderSearchUrl(
  name: string,
  _setName?: string | null,
  _setCode?: string | null,
  options?: {
    rarity?: string | null;
    gameSlug?: string | null;
    blueprintIds?: number[];
  }
): string {
  if (options?.blueprintIds?.length) {
    return buildCardTraderManaSearchUrl(name, options.blueprintIds);
  }
  return buildCardTraderManaSearchUrl(name, []);
}

function storedBlueprintMatchesInput(
  blueprintId: number,
  input: {
    rarity?: string | null;
    gameSlug?: string | null;
    imageUrl?: string | null;
    setCode?: string | null;
  }
): boolean {
  if (input.gameSlug !== "yugioh" || !input.rarity?.trim()) return true;

  const slug =
    getBlueprintProductSlug(blueprintId) ?? extractCardTraderSlugFromImageUrl(input.imageUrl);
  if (!slug) return false;

  const slugNorm = slug.toLowerCase().replace(/-/g, " ");

  if (isYugiohLostArtCode(input.setCode)) {
    if (/\b20\d{2}\b/.test(slugNorm)) return false;
    if (!slugNorm.includes("lost art promo")) return false;
    return true;
  }

  const inputCode = resolveRarityStyle(input.rarity, "yugioh").code;
  if (inputCode === "QSCR") return slugNorm.includes("quarter century");
  if (inputCode === "SCR") {
    return slugNorm.includes("secret") && !slugNorm.includes("quarter century");
  }

  const inputNorm = normalize(input.rarity);
  return slugNorm.includes(inputNorm.replace(/\s+/g, " "));
}

/** Validates a stored blueprint id against card set/rarity (URL fallback). */
export function cardTraderBlueprintMatchesCard(
  blueprintId: number,
  card: {
    rarity?: string | null;
    gameSlug?: string | null;
    imageUrl?: string | null;
    setCode?: string | null;
  }
): boolean {
  return storedBlueprintMatchesInput(blueprintId, {
    rarity: card.rarity,
    gameSlug: card.gameSlug ?? "",
    imageUrl: card.imageUrl,
    setCode: card.setCode,
  });
}

export function resolveCardTraderProductUrl(params: {
  name: string;
  gameSlug?: string | null;
  externalId?: string | null;
  cardTraderBlueprintId?: string | null;
  setName?: string | null;
  setCode?: string | null;
  rarity?: string | null;
  imageUrl?: string | null;
}): string {
  if (params.imageUrl) {
    const fromImage = extractBlueprintIdFromImageUrl(params.imageUrl);
    if (fromImage != null) cacheBlueprintSlug(fromImage, params.imageUrl);
  }

  let blueprintId = resolveStoredBlueprintId(
    params.externalId,
    params.imageUrl,
    params.cardTraderBlueprintId,
    params.gameSlug
  );
  if (
    blueprintId != null &&
    !cardTraderBlueprintMatchesCard(blueprintId, {
      rarity: params.rarity,
      gameSlug: params.gameSlug,
      imageUrl: params.imageUrl,
      setCode: params.setCode,
    })
  ) {
    blueprintId = null;
  }
  if (blueprintId != null) {
    return buildCardTraderManaSearchUrl(params.name, [blueprintId]);
  }
  return buildCardTraderManaSearchUrl(params.name, []);
}
