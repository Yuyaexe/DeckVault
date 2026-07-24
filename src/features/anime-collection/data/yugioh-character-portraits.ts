/**
 * @deprecated Prefer editing `character-portraits.catalog.ts`.
 * Kept for backwards-compatible imports of DM portrait helpers.
 */
import { getCharacterPortraitConfig } from "@/features/anime-collection/data/character-portrait-manifest";

const dm = getCharacterPortraitConfig("yu-gi-oh");

export const YUGIOH_PORTRAIT_BASE_PATH =
  dm?.basePath ?? "/anime-characters/yu-gi-oh";

export const YUGIOH_PORTRAIT_SLUGS = (dm?.slugs ?? []) as readonly string[];

export type YugiohPortraitSlug = string;

export const YUGIOH_PORTRAIT_ALIASES: Record<string, string> = {
  ...(dm?.aliases ?? {}),
};

const PORTRAIT_SLUG_SET = new Set<string>(YUGIOH_PORTRAIT_SLUGS);

export function isBundledYugiohPortraitSlug(slug: string): slug is YugiohPortraitSlug {
  return PORTRAIT_SLUG_SET.has(slug);
}
