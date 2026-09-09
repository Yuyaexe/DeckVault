import { yugiohSetNumberRef } from "@/lib/yugioh/lookup";

/** YGOPRODeck site + image URL helpers */

export function slugifyCardName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildYgoProDeckUrl(name: string, externalId?: string | null): string {
  if (externalId && name) {
    return `https://ygoprodeck.com/card/${slugifyCardName(name)}-${externalId}`;
  }
  return `https://ygoprodeck.com/card-database/?search=${encodeURIComponent(name)}`;
}

export function buildYgoImageUrl(
  externalId: string | null | undefined,
  size: "full" | "small" | "cropped" = "full"
): string | null {
  if (!externalId) return null;
  const folder = size === "small" ? "cards_small" : size === "cropped" ? "cards_cropped" : "cards";
  return `https://images.ygoprodeck.com/images/${folder}/${externalId}.jpg`;
}

/** Always use full framed card scans — `cards_cropped` is landscape art-only and breaks grid layout. */
export function pickYgoImageSizeForRarity(_rarity: string | null | undefined): "full" {
  return "full";
}

export function isYgoCroppedImageUrl(url: string | null | undefined): boolean {
  return Boolean(url?.includes("/cards_cropped/"));
}

export function buildLigaYugiohSearchUrl(name: string): string {
  return `https://www.ligayugioh.com.br/?view=cards/search&card=${encodeURIComponent(name.trim())}`;
}

export function buildMyPCardsSearchUrl(
  name: string,
  options?: { collectorNumber?: string | null; setCode?: string | null }
): string {
  const setRef = yugiohSetNumberRef(options?.setCode, options?.collectorNumber);
  const query = (setRef ?? name).trim();
  const params = new URLSearchParams();
  params.set("ProdutoSearch[query]", query);
  return `https://mypcards.com/yugioh?${params.toString()}`;
}
