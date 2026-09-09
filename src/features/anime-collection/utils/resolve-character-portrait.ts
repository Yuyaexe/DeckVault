import {
  getCharacterPortraitConfig,
  listCharacterPortraitSeriesKeys,
} from "@/features/anime-collection/data/character-portrait-manifest";
import type { AnimeSeriesAssetKey } from "@/features/anime-collection/data/anime-series-key";
import { resolveAnimeSeriesAssetKey } from "@/features/anime-collection/data/anime-series-key";
import { slugifyAnimeName } from "@/features/anime-collection/utils/slugify-anime-name";

function resolveBundledPortraitPath(
  seriesKey: AnimeSeriesAssetKey,
  characterName: string
): string | null {
  const config = getCharacterPortraitConfig(seriesKey);
  if (!config) return null;

  const nameSlug = slugifyAnimeName(characterName);
  if (!nameSlug) return null;

  const portraitSlug = config.aliases[nameSlug] ?? nameSlug;
  if (!config.slugs.includes(portraitSlug)) return null;

  return `${config.basePath}/${portraitSlug}.png`;
}

/** Landscape group shots (e.g. Team Unicorn) need a wider frame than circular portraits. */
export function isWideCharacterPortrait(imageUrl: string | null | undefined): boolean {
  if (!imageUrl) return false;
  const path = imageUrl.split("?")[0]?.toLowerCase() ?? "";
  const file = path.slice(path.lastIndexOf("/") + 1);
  return file.startsWith("team-");
}

/** User override first, then bundled local portrait for supported series. */
export function resolveCharacterPortraitUrl(
  seriesSlug: string | undefined,
  seriesName: string | undefined,
  characterName: string,
  storedImageUrl: string | null | undefined
): string | null {
  const trimmed = storedImageUrl?.trim();
  if (trimmed) return trimmed;

  if (!seriesSlug?.trim() && !seriesName?.trim()) return null;

  const seriesKey = resolveAnimeSeriesAssetKey(seriesSlug ?? "", seriesName);
  if (seriesKey) {
    const primary = resolveBundledPortraitPath(seriesKey, characterName);
    if (primary) return primary;
  }

  // Misnamed series (e.g. slug "yu-gi-oh" without spinoff in the title) — try other manifests.
  for (const key of listCharacterPortraitSeriesKeys()) {
    if (key === seriesKey) continue;
    const fallback = resolveBundledPortraitPath(key, characterName);
    if (fallback) return fallback;
  }

  return null;
}

/** @deprecated Use resolveAnimeSeriesAssetKey from anime-series-key.ts */
export function isYugiohAnimeSeries(seriesSlug: string, seriesName?: string): boolean {
  return resolveAnimeSeriesAssetKey(seriesSlug, seriesName) === "yu-gi-oh";
}
